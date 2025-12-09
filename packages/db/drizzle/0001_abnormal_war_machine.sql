ALTER TABLE "users" ADD COLUMN "income_date" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_income_uncertain" boolean DEFAULT false;