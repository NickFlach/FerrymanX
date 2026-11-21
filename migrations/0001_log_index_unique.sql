-- Hand-written: brings the database in line with shared/schema.ts, which 0000 predates.
-- (The drizzle journal in migrations/meta is not updated; regenerate it with drizzle-kit if you adopt its migrator.)
ALTER TABLE "signed_nft_transactions" ADD COLUMN IF NOT EXISTS "log_index" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "signed_nft_transactions" ADD CONSTRAINT "signed_nft_transactions_tx_hash_log_index_source_chain_unique" UNIQUE("tx_hash","log_index","source_chain");
