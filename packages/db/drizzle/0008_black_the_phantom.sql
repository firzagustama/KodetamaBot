CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "buckets" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buckets_embedding_idx" ON "buckets" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_embedding_idx" ON "transactions" USING hnsw ("embedding" vector_cosine_ops);