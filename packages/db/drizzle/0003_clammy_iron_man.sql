-- Convert timestamp without timezone to timestamp with timezone, treating existing values as UTC
ALTER TABLE "ai_usage" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "updated_at" TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "date_periods" ALTER COLUMN "start_date" TYPE timestamptz USING start_date AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "date_periods" ALTER COLUMN "end_date" TYPE timestamptz USING end_date AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "date_periods" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "family_members" ALTER COLUMN "joined_at" TYPE timestamptz USING joined_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "google_drive_folders" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "google_sheets" ALTER COLUMN "last_sync_at" TYPE timestamptz USING last_sync_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "google_sheets" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "google_tokens" ALTER COLUMN "expires_at" TYPE timestamptz USING expires_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "google_tokens" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "google_tokens" ALTER COLUMN "updated_at" TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pending_registrations" ALTER COLUMN "processed_at" TYPE timestamptz USING processed_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pending_registrations" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "telegram_accounts" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "transaction_date" TYPE timestamptz USING transaction_date AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "voice_transcripts" ALTER COLUMN "created_at" TYPE timestamptz USING created_at AT TIME ZONE 'UTC';