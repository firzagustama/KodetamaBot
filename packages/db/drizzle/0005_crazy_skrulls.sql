CREATE TABLE IF NOT EXISTS "buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"amount" numeric(15, 2) NOT NULL,
	"icon" varchar(50) DEFAULT 'Wallet',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buckets" ADD CONSTRAINT "buckets_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN IF EXISTS "needs_amount";--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN IF EXISTS "wants_amount";--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN IF EXISTS "savings_amount";--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN IF EXISTS "needs_percentage";--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN IF EXISTS "wants_percentage";--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN IF EXISTS "savings_percentage";