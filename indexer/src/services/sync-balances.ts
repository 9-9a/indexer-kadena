/**
 * Balance Synchronization Service
 *
 * This service synchronizes the balance column in the Balances table by querying
 * actual balance values from the Kadena blockchain node. It processes balances
 * in batches to efficiently update the database with current on-chain balances.
 */

import pLimit from 'p-limit';
import { rootPgPool } from '../config/database';
import { handleSingleQuery } from '../utils/raw-query';
import { formatBalance_NODE } from '../utils/chainweb-node';

/**
 * Maximum number of concurrent blockchain API requests
 */
const CONCURRENCY_LIMIT = 50;

/**
 * Number of balance records to process in each batch
 */
const BATCH_SIZE = 1000;

/**
 * Create a concurrency limiter
 */
const limitFetch = pLimit(CONCURRENCY_LIMIT);

/**
 * Syncs balance values from the Kadena node to the database
 *
 * This function:
 * 1. Fetches balance records from the database in batches
 * 2. Queries each balance's actual value from the blockchain node
 * 3. Updates the database with the current balance values
 *
 * @returns Promise that resolves when sync is complete
 */
export async function syncBalances() {
  console.info('[INFO][WORKER][BIZ_FLOW] Starting balance sync...');

  let currentId = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  while (true) {
    // Fetch next batch of balances
    const res = await rootPgPool.query(
      `
        SELECT b.id, b.account, b."chainId", b.module, b."hasTokenId", b."tokenId"
        FROM "Balances" b
        WHERE b.id > $1
        ORDER BY b.id
        LIMIT $2
      `,
      [currentId, BATCH_SIZE],
    );

    const rows = res.rows;

    if (rows.length === 0) {
      console.info('[INFO][DB][DATA_MISSING] No more balance rows to process.');
      break;
    }

    // Fetch balances from the node with controlled concurrency
    const fetchPromises = rows.map(row =>
      limitFetch(async () => {
        try {
          // Skip NFTs with token IDs - only process fungible tokens
          if (row.hasTokenId) {
            return { id: row.id, balance: '0', skipped: true };
          }

          // Query balance from the node
          const query = {
            chainId: String(row.chainId),
            code: `(${row.module}.details "${row.account}")`,
          };

          const result = await handleSingleQuery(query);
          const balance = formatBalance_NODE(result);

          return {
            id: row.id,
            balance: balance.toString(),
            skipped: false,
          };
        } catch (error) {
          console.error(
            `[ERROR][NODE][QUERY_FAIL] Failed to fetch balance for account ${row.account} on chain ${row.chainId}:`,
            error,
          );
          return { id: row.id, balance: '0', skipped: true };
        }
      }),
    );

    const results = await Promise.all(fetchPromises);

    // Update balances in database
    for (const result of results) {
      if (!result.skipped) {
        await rootPgPool.query(
          `UPDATE "Balances" SET balance = $1, "updatedAt" = NOW() WHERE id = $2`,
          [result.balance, result.id],
        );
        totalUpdated++;
      }
    }

    totalProcessed += rows.length;
    currentId = rows[rows.length - 1].id;

    console.info(
      `[INFO][WORKER][PROGRESS] Processed ${totalProcessed} balances, updated ${totalUpdated}`,
    );
  }

  console.info(
    `[INFO][WORKER][BIZ_FLOW] Balance sync complete. Total processed: ${totalProcessed}, Total updated: ${totalUpdated}`,
  );
}
