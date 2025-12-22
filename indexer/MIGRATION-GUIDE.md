# Database Migration Management Guide

## Quick Reference

### List All Migrations
```bash
node run-single-migration.js list
```

### Check Migration Status
```bash
node run-single-migration.js status
```

### Run a Single Migration
```bash
node run-single-migration.js run 20250722170139-create-counter-table.js
```

### Disable a Migration (Skip It)
```bash
# Move migration to .disabled/ folder
node run-single-migration.js disable 20250722170139-create-counter-table.js
```

### Enable a Disabled Migration
```bash
# Move migration back from .disabled/ folder
node run-single-migration.js enable 20250722170139-create-counter-table.js
```

### Run All Pending Migrations
```bash
npm run migrate:up
```

---

## Step-by-Step: Run Migrations One by One

### 1. List all migrations
```bash
node run-single-migration.js list
```

### 2. Run migrations in order (one at a time)
```bash
# Run the first migration
node run-single-migration.js run 20241105002409-enable-pg-trgm-and-btree-gin.js

# Run the second migration
node run-single-migration.js run 20241105002410-add-blocks-table.js

# Continue with each migration...
```

### 3. Check status after each migration
```bash
node run-single-migration.js status
```

---

## Important Migrations for Your Use Case

### Core Tables (Must Run)
1. `20241105002409-enable-pg-trgm-and-btree-gin.js` - PostgreSQL extensions
2. `20241105002410-add-blocks-table.js` - Blocks table
3. `20241105002411-add-transactions-table.js` - Transactions table
4. `20241105002413-add-events-table.js` - Events table
5. `20241105002414-add-transfers-table.js` - Transfers table
6. `20241105002416-add-balances-table.js` - Balances table

### DEX/Pool Tables (For Pool Data)
17. `20250520121820-create-token-table.js` - Tokens table
18. `20250520121826-create-pair-table.js` - Pairs table
19. `20250520121829-create-liquidity-balance-table.js` - **LiquidityBalances table**
20. `20250520121833-create-pool-chart-table.js` - PoolCharts table
21. `20250520121837-create-pool-stats-table.js` - PoolStats table
22. `20250520200419-create-pool-transaction-table.js` - PoolTransactions table

### Counters Table (For Backfill)
30. `20250722170139-create-counter-table.js` - **Counters table** (initializes 20 rows)

---

## Common Scenarios

### Scenario 1: Skip an Index Migration (Too Slow)
```bash
# Disable the migration
node run-single-migration.js disable 20250825181017-add-indexes-to-transfers.js

# Run all other migrations
npm run migrate:up

# Re-enable later if needed
node run-single-migration.js enable 20250825181017-add-indexes-to-transfers.js
```

### Scenario 2: Run Only Core Migrations
```bash
# Run required migrations one by one
node run-single-migration.js run 20241105002409-enable-pg-trgm-and-btree-gin.js
node run-single-migration.js run 20241105002410-add-blocks-table.js
node run-single-migration.js run 20241105002411-add-transactions-table.js
# ... etc

# Disable optional ones
node run-single-migration.js disable 20250520121820-create-token-table.js
```

### Scenario 3: Only Run Counters Migration
```bash
# Run just the Counters table migration
node run-single-migration.js run 20250722170139-create-counter-table.js
```

---

## Troubleshooting

### Migration Fails
- Check database connection in `.env` file
- Ensure database is running: `docker ps` or check PostgreSQL service
- Check migration logs for specific error

### Want to Undo a Migration
```bash
# Undo the last migration
npm run migrate:down

# Or manually drop the table if needed
```

### Reset All Migrations
```bash
# WARNING: This will undo ALL migrations
npx sequelize-cli db:migrate:undo:all --config config/config.js
```

---

## Files Created

- `run-single-migration.js` - Node.js script for managing migrations
- `run-migration.sh` - Bash alternative (if you prefer shell scripts)
- `migrations/.disabled/` - Folder for disabled migrations

---

## Migration Order Matters!

Migrations must be run in chronological order (by timestamp in filename).
Dependencies:
- Blocks table must exist before Transactions
- Transactions must exist before Events/Transfers
- Events must exist before pair processing
- Pairs must exist before PoolTransactions/PoolStats

Running them one by one ensures you can stop if there's an issue.
