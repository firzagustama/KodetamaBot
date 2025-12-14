ALTER TABLE "buckets" ADD COLUMN "category" varchar(50);--> statement-breakpoint
ALTER TABLE "buckets" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "buckets" SET "category" = 'needs' WHERE "category" IS NULL;