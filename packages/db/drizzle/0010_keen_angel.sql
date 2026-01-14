UPDATE "buckets" SET "embedding" = NULL;--> statement-breakpoint
UPDATE "transactions" SET "embedding" = NULL;--> statement-breakpoint
ALTER TABLE "buckets" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "embedding" SET DATA TYPE vector(768);