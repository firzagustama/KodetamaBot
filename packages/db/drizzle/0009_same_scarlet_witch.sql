DROP TABLE IF EXISTS "google_drive_folders";
DROP TABLE IF EXISTS "google_sheets";
DROP TABLE IF EXISTS "google_tokens";

-- 1. Add target_id columns (nullable first)
ALTER TABLE "categories" ADD COLUMN "target_id" uuid;
ALTER TABLE "date_periods" ADD COLUMN "target_id" uuid;
ALTER TABLE "transactions" ADD COLUMN "target_id" uuid;

-- 2. Backfill data
UPDATE "categories" SET "target_id" = COALESCE("user_id", "group_id");
UPDATE "date_periods" SET "target_id" = COALESCE("user_id", "group_id");
-- For transactions: if group_id is present, use it. Otherwise use user_id (private chat).
UPDATE "transactions" SET "target_id" = COALESCE("group_id", "user_id");

-- 3. Enforce NOT NULL
ALTER TABLE "categories" ALTER COLUMN "target_id" SET NOT NULL;
ALTER TABLE "date_periods" ALTER COLUMN "target_id" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "target_id" SET NOT NULL;

-- 4. Drop old constraints and columns
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_user_id_users_id_fk";
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_group_id_groups_id_fk";
ALTER TABLE "date_periods" DROP CONSTRAINT IF EXISTS "date_periods_user_id_users_id_fk";
ALTER TABLE "date_periods" DROP CONSTRAINT IF EXISTS "date_periods_group_id_groups_id_fk";
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_group_id_groups_id_fk";

DROP INDEX IF EXISTS "date_periods_user_id_idx";
DROP INDEX IF EXISTS "date_periods_group_id_idx";
DROP INDEX IF EXISTS "transactions_user_period_idx";
DROP INDEX IF EXISTS "transactions_group_period_idx";

CREATE INDEX IF NOT EXISTS "date_periods_target_id_idx" ON "date_periods" USING btree ("target_id");
CREATE INDEX IF NOT EXISTS "transactions_target_period_idx" ON "transactions" USING btree ("target_id","period_id");

ALTER TABLE "categories" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "group_id";
ALTER TABLE "date_periods" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "date_periods" DROP COLUMN IF EXISTS "group_id";
ALTER TABLE "files" DROP COLUMN IF EXISTS "google_drive_id";
ALTER TABLE "files" DROP COLUMN IF EXISTS "google_drive_url";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "group_id";