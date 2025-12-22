#!/usr/bin/env node
/**
 * Run a single migration or manage migrations individually
 *
 * Usage:
 *   node run-single-migration.js list                    - List all migrations
 *   node run-single-migration.js run <filename>          - Run specific migration
 *   node run-single-migration.js disable <filename>      - Disable a migration
 *   node run-single-migration.js enable <filename>       - Enable a migration
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

function listMigrations() {
  console.log('\n=== Available Migrations ===');
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });

  console.log('\n=== Disabled Migrations ===');
  const disabled = fs.existsSync(DISABLED_DIR)
    ? fs.readdirSync(DISABLED_DIR).filter(f => f.endsWith('.js')).sort()
    : [];

  if (disabled.length === 0) {
    console.log('(none)');
  } else {
    disabled.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
  }
  console.log('');
}

function runMigration(filename) {
  const sourcePath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Migration not found: ${filename}`);
    process.exit(1);
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
  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}\n`);
    process.exit(1);
  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function disableMigration(filename) {
  const sourcePath = path.join(MIGRATIONS_DIR, filename);
  const destPath = path.join(DISABLED_DIR, filename);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Migration not found: ${filename}`);
    process.exit(1);
  }

  fs.renameSync(sourcePath, destPath);
  console.log(`✅ Disabled: ${filename}`);
}

function enableMigration(filename) {
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
  list                    - List all available and disabled migrations
  status                  - Check which migrations have been run
  run <filename>          - Run a specific migration
  disable <filename>      - Disable a migration (move to .disabled/)
  enable <filename>       - Enable a disabled migration

Examples:
  node run-single-migration.js list
  node run-single-migration.js status
  node run-single-migration.js run 20250722170139-create-counter-table.js
  node run-single-migration.js disable 20250722170139-create-counter-table.js
  node run-single-migration.js enable 20250722170139-create-counter-table.js
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
