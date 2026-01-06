#!/usr/bin/env node
/**
 * Run a single migration or manage migrations individually
 *
 * Usage:
 *   node run-single-migration.js list                      - List all migrations
 *   node run-single-migration.js run <number|range|filename> - Run migration(s)
 *   node run-single-migration.js disable <number|filename> - Disable a migration
 *   node run-single-migration.js enable <number|filename>  - Enable a migration
 *
 * Examples:
 *   node run-single-migration.js run 1       - Run migration #1
 *   node run-single-migration.js run 1-20    - Run migrations #1 through #20
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const DISABLED_DIR = path.join(__dirname, 'migrations', '.disabled');

// Ensure disabled directory exists
if (!fs.existsSync(DISABLED_DIR)) {
  fs.mkdirSync(DISABLED_DIR, { recursive: true });
}

function getAvailableMigrations() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();
}

function getDisabledMigrations() {
  return fs.existsSync(DISABLED_DIR)
    ? fs.readdirSync(DISABLED_DIR).filter(f => f.endsWith('.js')).sort()
    : [];
}

function resolveToFilename(input, fromDisabled = false) {
  // If it's a number, get the file by index
  if (/^\d+$/.test(input)) {
    const index = parseInt(input, 10) - 1; // Convert to 0-based index
    const migrations = fromDisabled ? getDisabledMigrations() : getAvailableMigrations();

    if (index < 0 || index >= migrations.length) {
      console.error(`❌ Invalid migration number: ${input}. Valid range: 1-${migrations.length}`);
      process.exit(1);
    }

    return migrations[index];
  }

  // Otherwise assume it's a filename
  return input;
}

function listMigrations() {
  console.log('\n=== Available Migrations ===');
  const files = getAvailableMigrations();

  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });

  console.log('\n=== Disabled Migrations ===');
  const disabled = getDisabledMigrations();

  if (disabled.length === 0) {
    console.log('(none)');
  } else {
    disabled.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
  }
  console.log('');
}

function runSingleMigration(filename) {
  const sourcePath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Migration not found: ${filename}`);
    return false;
  }

  console.log(`\n🔄 Running migration: ${filename}\n`);

  // Create temporary directory with only this migration
  const tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-migration-'));
  const tempMigrationPath = path.join(tempDir, filename);

  try {
    fs.copyFileSync(sourcePath, tempMigrationPath);

    // Run migration using sequelize-cli
    const cmd = `npx sequelize-cli db:migrate --migrations-path "${tempDir}" --config config/config.js`;
    execSync(cmd, {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env }
    });

    console.log(`\n✅ Migration completed: ${filename}\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}\n`);

    // Print the migration code for debugging
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration code that failed:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      const migrationCode = fs.readFileSync(sourcePath, 'utf8');
      console.log(migrationCode);
    } catch (readError) {
      console.error('Could not read migration file:', readError.message);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return false;
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runMigration(input) {
  // Check if it's a range (e.g., "1-20")
  const rangeMatch = input.match(/^(\d+)-(\d+)$/);

  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    const migrations = getAvailableMigrations();

    if (start < 1 || end > migrations.length || start > end) {
      console.error(`❌ Invalid range: ${input}. Valid range: 1-${migrations.length}`);
      process.exit(1);
    }

    console.log(`\n📦 Running migrations ${start} to ${end} (${end - start + 1} total)\n`);

    let successCount = 0;
    let failedAt = null;

    for (let i = start; i <= end; i++) {
      const filename = migrations[i - 1];
      const success = runSingleMigration(filename);

      if (success) {
        successCount++;
      } else {
        failedAt = i;
        break;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`Summary: ${successCount}/${end - start + 1} migrations completed`);

    if (failedAt) {
      console.log(`❌ Stopped at migration #${failedAt}`);
      console.log(`   To continue: node run-single-migration.js run ${failedAt}-${end}`);
      console.log('═══════════════════════════════════════════════════════\n');
      process.exit(1);
    } else {
      console.log('✅ All migrations completed successfully');
      console.log('═══════════════════════════════════════════════════════\n');
    }

    return;
  }

  // Single migration
  const filename = resolveToFilename(input);
  const success = runSingleMigration(filename);

  if (!success) {
    process.exit(1);
  }
}

function disableMigration(input) {
  const filename = resolveToFilename(input);
  const sourcePath = path.join(MIGRATIONS_DIR, filename);
  const destPath = path.join(DISABLED_DIR, filename);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Migration not found: ${filename}`);
    process.exit(1);
  }

  fs.renameSync(sourcePath, destPath);
  console.log(`✅ Disabled: ${filename}`);
}

function enableMigration(input) {
  const filename = resolveToFilename(input, true); // true = from disabled
  const sourcePath = path.join(DISABLED_DIR, filename);
  const destPath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Disabled migration not found: ${filename}`);
    process.exit(1);
  }

  fs.renameSync(sourcePath, destPath);
  console.log(`✅ Enabled: ${filename}`);
}

function checkStatus() {
  console.log('\n=== Migration Status ===\n');
  try {
    execSync('npx sequelize-cli db:migrate:status --config config/config.js', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('\n❌ Error checking status. Make sure database is running.\n');
  }
}

function showHelp() {
  console.log(`
Migration Management Script

Usage: node run-single-migration.js {command} [options]

Commands:
  list                           - List all available and disabled migrations
  status                         - Check which migrations have been run
  run <number|range|filename>    - Run migration(s)
  disable <number|filename>      - Disable a migration (move to .disabled/)
  enable <number|filename>       - Enable a disabled migration

Examples:
  node run-single-migration.js list
  node run-single-migration.js status

  # Run single migration by number
  node run-single-migration.js run 30

  # Run multiple migrations by range
  node run-single-migration.js run 1-20
  node run-single-migration.js run 5-10

  # Run by filename
  node run-single-migration.js run 20250722170139-create-counter-table.js

  # Disable by number
  node run-single-migration.js disable 17

  # Enable by number (from disabled list)
  node run-single-migration.js enable 1
`);
}

// Main
const [,, command, arg] = process.argv;

switch (command) {
  case 'list':
    listMigrations();
    break;
  case 'status':
    checkStatus();
    break;
  case 'run':
    if (!arg) {
      console.error('❌ Please specify a migration filename');
      process.exit(1);
    }
    runMigration(arg);
    break;
  case 'disable':
    if (!arg) {
      console.error('❌ Please specify a migration filename');
      process.exit(1);
    }
    disableMigration(arg);
    break;
  case 'enable':
    if (!arg) {
      console.error('❌ Please specify a migration filename');
      process.exit(1);
    }
    enableMigration(arg);
    break;
  default:
    showHelp();
    break;
}
