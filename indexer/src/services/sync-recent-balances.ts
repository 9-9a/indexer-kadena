/**
 * Recent Balance Synchronization Service
 *
 * This service synchronizes only recently modified balances from the blockchain.
 * Instead of syncing all balances in the database, it targets only those that
 * have been updated recently (based on the updatedAt timestamp), making it
 * much more efficient for real-time systems.
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
 * Create a concurrency limiter
 */
const limitFetch = pLimit(CONCURRENCY_LIMIT);

/**
 * Syncs balance values for recently modified accounts
 *
 * This function:
 * 1. Queries balances that were updated in the last X minutes
 * 2. Fetches current balance values from the blockchain node
 * 3. Updates the database with actual balance values
 *
 * This is much more efficient than syncing all balances, as it only
 * updates accounts that have had recent transfer activity.
 *
 * @param lookbackMinutes - How many minutes back to look for modified balances (default: 10)
 * @returns Promise that resolves when sync is complete
 */
export async function syncRecentBalances(lookbackMinutes: number = 10) {
  const startTime = Date.now();
  console.info(
    `[INFO][WORKER][BIZ_FLOW] Starting recent balance sync (lookback: ${lookbackMinutes} minutes)...`,
  );

  // Query balances modified in the last X minutes (only fungible tokens)
  const res = await rootPgPool.query(
    `
      SELECT b.id, b.account, b."chainId", b.module
      FROM "Balances" b
      WHERE b."updatedAt" > NOW() - INTERVAL '${lookbackMinutes} minutes'
        AND b."hasTokenId" = false
      ORDER BY b."updatedAt" DESC
    `,
  );

  const rows = res.rows;

  if (rows.length === 0) {
    console.info('[INFO][WORKER][BIZ_FLOW] No recently modified balances to sync.');
    return;
  }

  console.info(
    `[INFO][WORKER][BIZ_FLOW] Found ${rows.length} recently modified balances to sync...`,
  );

  let successCount = 0;
  let errorCount = 0;

  // Fetch balances from the node with controlled concurrency
  const fetchPromises = rows.map(row =>
    limitFetch(async () => {
      try {
        // Query balance from the node
        const query = {
          chainId: String(row.chainId),
          code: `(${row.module}.details "${row.account}")`,
        };

        const result = await handleSingleQuery(query);

        if (result.status !== 'success' || !result.result) {
          errorCount++;
          return;
        }

        const balance = formatBalance_NODE(result);

        // Update the balance in the database
        await rootPgPool.query(
          `UPDATE "Balances" SET balance = $1, "updatedAt" = NOW() WHERE id = $2`,
          [balance.toString(), row.id],
        );

        successCount++;
      } catch (error) {
        errorCount++;
        console.error(
          `[ERROR][WORKER][BIZ_FLOW] Failed to sync balance for account ${row.account} on chain ${row.chainId}:`,
          error,
        );
      }
    }),
  );

  await Promise.all(fetchPromises);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.info(
    `[INFO][WORKER][BIZ_FLOW] Recent balance sync complete in ${duration}s. ` +
      `Updated: ${successCount}, Errors: ${errorCount}`,
  );
}
