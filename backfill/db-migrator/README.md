# DB Migrator

This tool provides various database migration utilities for the Kadena indexer.

Use this only in case you already running a indexer solution and some breaking changes were introduced in the changelog.

## Available Commands

The migrator supports the following commands:

- `code-to-text`: Convert code fields to text type
- `creation-time`: Add creation time to events and transfers
- `reconcile`: Run process to insert transfers through the reconcile event

## Usage

### Local Development

To run a migration locally:

```bash
go run ./db-migrator/*.go -command=<command_name> -env=.env
```

For example:

```bash
cd backfill/
go run ./db-migrator/*.go -command=code-to-text -env=.env
```

### Using Docker

Build the image:

```bash
cd backfill/
docker build -f Dockerfile.migrator -t db-image .
```

Run a specific migration:

```bash
docker run -it --rm -env=.env db-image -command=code-to-text
```
