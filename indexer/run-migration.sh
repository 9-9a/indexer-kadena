#!/bin/bash
# Script to run migrations one by one or manage them

set -e

MIGRATIONS_DIR="./migrations"
DISABLED_DIR="./migrations/.disabled"

# Create disabled directory if it doesn't exist
mkdir -p "$DISABLED_DIR"

# Function to list all migrations
list_migrations() {
    echo "=== Available Migrations ==="
    ls -1 "$MIGRATIONS_DIR"/*.js 2>/dev/null | sort | nl
    echo ""
}

# Function to list disabled migrations
list_disabled() {
    echo "=== Disabled Migrations ==="
    if [ -d "$DISABLED_DIR" ] && [ "$(ls -A $DISABLED_DIR/*.js 2>/dev/null)" ]; then
        ls -1 "$DISABLED_DIR"/*.js 2>/dev/null | xargs -n 1 basename | sort | nl
    else
        echo "(none)"
    fi
    echo ""
}

# Function to run a specific migration
run_migration() {
    local migration_file="$1"
    echo "Running migration: $migration_file"

    # Create a temporary migration directory with only this file
    TEMP_DIR=$(mktemp -d)
    cp "$MIGRATIONS_DIR/$migration_file" "$TEMP_DIR/"

    # Run the migration using sequelize-cli
    npx sequelize-cli db:migrate --migrations-path "$TEMP_DIR" --config config/config.js

    # Cleanup
    rm -rf "$TEMP_DIR"
    echo "✓ Migration completed: $migration_file"
}

# Function to disable a migration
disable_migration() {
    local migration_file="$1"
    if [ -f "$MIGRATIONS_DIR/$migration_file" ]; then
        mv "$MIGRATIONS_DIR/$migration_file" "$DISABLED_DIR/"
        echo "✓ Disabled: $migration_file"
    else
        echo "✗ Migration not found: $migration_file"
        exit 1
    fi
}

# Function to enable a migration
enable_migration() {
    local migration_file="$1"
    if [ -f "$DISABLED_DIR/$migration_file" ]; then
        mv "$DISABLED_DIR/$migration_file" "$MIGRATIONS_DIR/"
        echo "✓ Enabled: $migration_file"
    else
        echo "✗ Disabled migration not found: $migration_file"
        exit 1
    fi
}

# Function to check migration status
check_status() {
    echo "=== Migration Status ==="
    npx sequelize-cli db:migrate:status --config config/config.js 2>/dev/null || echo "Error checking status. Make sure database is running."
}

# Main script
case "$1" in
    list)
        list_migrations
        list_disabled
        ;;
    status)
        check_status
        ;;
    run)
        if [ -z "$2" ]; then
            echo "Usage: $0 run <migration-filename>"
            echo "Example: $0 run 20250722170139-create-counter-table.js"
            exit 1
        fi
        run_migration "$2"
        ;;
    disable)
        if [ -z "$2" ]; then
            echo "Usage: $0 disable <migration-filename>"
            exit 1
        fi
        disable_migration "$2"
        ;;
    enable)
        if [ -z "$2" ]; then
            echo "Usage: $0 enable <migration-filename>"
            exit 1
        fi
        enable_migration "$2"
        ;;
    all)
        echo "Running all migrations..."
        npm run migrate:up
        ;;
    *)
        echo "Migration Management Script"
        echo ""
        echo "Usage: $0 {list|status|run|disable|enable|all} [migration-file]"
        echo ""
        echo "Commands:"
        echo "  list                    - List all available and disabled migrations"
        echo "  status                  - Check which migrations have been run"
        echo "  run <file>              - Run a specific migration"
        echo "  disable <file>          - Disable a migration (move to .disabled/)"
        echo "  enable <file>           - Enable a disabled migration"
        echo "  all                     - Run all pending migrations"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 status"
        echo "  $0 run 20250722170139-create-counter-table.js"
        echo "  $0 disable 20250722170139-create-counter-table.js"
        echo "  $0 enable 20250722170139-create-counter-table.js"
        exit 1
        ;;
esac
