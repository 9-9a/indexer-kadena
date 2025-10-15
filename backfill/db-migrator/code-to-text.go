package main

import (
	"database/sql"
	"flag"
	"fmt"
	"go-backfill/config"
	"log"

	_ "github.com/lib/pq" // PostgreSQL driver
)

const (
	codeBatchSize             = 500
	startTransactionIdForCode = 1
)

// This script was created to convert the code column in the TransactionDetails table to text.
// Use it ONLY if the migration 20251010161634-change-code-column-type-in-transactiondetails doesn't work
// properly due lack of memory in the machine.

func updateCodeToText() error {
	envFile := flag.String("env", ".env", "Path to the .env file")
	flag.Parse()
	config.InitEnv(*envFile)
	env := config.GetConfig()
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		env.DbHost, env.DbPort, env.DbUser, env.DbPassword, env.DbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Connected to database")

	// Test database connection
	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	// Get max transaction ID to determine processing range
	var maxTransactionID int
	if err := db.QueryRow(`SELECT COALESCE(MAX(id), 0) FROM "TransactionDetails"`).Scan(&maxTransactionID); err != nil {
		return fmt.Errorf("failed to get max transaction ID: %v", err)
	}

	if maxTransactionID == 0 {
		log.Println("No transaction details found; nothing to update")
		return nil
	}

	// Process transactions in batches
	if err := processTransactionsBatchForCode(db, startTransactionIdForCode, maxTransactionID); err != nil {
		return fmt.Errorf("failed to process transactions: %v", err)
	}

	log.Println("Successfully updated all TransactionDetails code values to text")
	log.Printf("Max(TransactionDetails.id) processed: %d", maxTransactionID)
	return nil
}

func processTransactionsBatchForCode(db *sql.DB, startId, endId int) error {
	currentMaxId := endId
	totalProcessed := 0
	totalTransactions := endId - startId + 1
	lastProgressPrinted := -1.0

	log.Printf("Starting to process transactions from ID %d down to %d", endId, startId)
	log.Printf("Total transactions to process: %d", totalTransactions)

	for currentMaxId >= startId {
		// Calculate this batch's lower bound (inclusive)
		batchMinId := currentMaxId - codeBatchSize + 1
		if batchMinId < startId {
			batchMinId = startId
		}

		// Process this batch [batchMinId, currentMaxId]
		processed, err := processBatchForCode(db, batchMinId, currentMaxId)
		if err != nil {
			return fmt.Errorf("failed to process batch %d-%d: %v", batchMinId, currentMaxId, err)
		}

		totalProcessed += processed

		// Move to next window (just below the batch we processed)
		currentMaxId = batchMinId - 1

		// Calculate progress percentage based on covered ID space
		processedSpan := endId - currentMaxId // how many IDs from the top have been covered
		if processedSpan > totalTransactions {
			processedSpan = totalTransactions
		}
		progressPercent := (float64(processedSpan) / float64(totalTransactions)) * 100.0

		// Only print progress if it has increased by at least 0.1%
		if progressPercent-lastProgressPrinted >= 0.1 {
			log.Printf("Progress: %.1f%%, currentMaxId: %d", progressPercent, currentMaxId)
			lastProgressPrinted = progressPercent
		}
	}

	log.Printf("Completed processing. Total TransactionDetails updated: %d (100.0%%)", totalProcessed)
	return nil
}

func processBatchForCode(db *sql.DB, startId, endId int) (int, error) {
	// Begin transaction for atomic operation
	tx, err := db.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback() // Will be ignored if tx.Commit() succeeds

	// Get all records in this batch and validate them
	rows, err := tx.Query(`
		SELECT id, code
		FROM "TransactionDetails"
		WHERE id >= $1 AND id <= $2
		ORDER BY id DESC
	`, startId, endId)
	if err != nil {
		log.Fatalf("Failed to query records: %v", err)
	}
	defer rows.Close()

	// Check each record in the batch
	for rows.Next() {
		var (
			id   int
			code []byte
		)
		if err := rows.Scan(&id, &code); err != nil {
			log.Fatalf("Failed to scan record: %v", err)
		}

		// Skip NULL values
		if code == nil {
			continue
		}

		// Check if it's a string or {}
		isString := false
		isEmptyObject := string(code) == "{}"

		if !isEmptyObject {
			// If it's not {}, check if it's a string
			isString = string(code)[0] == '"' && string(code)[len(string(code))-1] == '"'
		}

		// If neither string nor {}, abort
		if !isString && !isEmptyObject {
			log.Fatalf("ABORTING: Found invalid code value at id %d", id)
		}
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("Error iterating records: %v", err)
	}
	rows.Close()

	// If we get here, all values in this batch are valid (string or {})
	log.Printf("About to update batch: startId=%d, endId=%d", startId, endId)

	updateQuery := `
		UPDATE "TransactionDetails"
		SET codetext = CASE
			WHEN code IS NULL OR code = '{}'::jsonb THEN NULL
			ELSE code #>> '{}'
		END
		WHERE id >= $1 AND id <= $2
		RETURNING id
	`

	updateRows, err := tx.Query(updateQuery, startId, endId)
	if err != nil {
		log.Fatalf("Failed to update records: %v", err)
	}
	defer updateRows.Close()

	var processed int
	for updateRows.Next() {
		processed++
	}

	log.Printf("Processed %d records in this batch", processed)

	if err := updateRows.Err(); err != nil {
		log.Fatalf("Error iterating update rows: %v", err)
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		log.Fatalf("Failed to commit transaction: %v", err)
	}

	return processed, nil
}

func mainCodeText() {
	if err := updateCodeToText(); err != nil {
		log.Fatalf("Error: %v", err)
	}
}
