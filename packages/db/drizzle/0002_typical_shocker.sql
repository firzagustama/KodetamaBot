ALTER TABLE "budgets" ALTER COLUMN "needs_percentage" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "needs_percentage" SET DEFAULT '50';--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "wants_percentage" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "wants_percentage" SET DEFAULT '30';--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "savings_percentage" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "savings_percentage" SET DEFAULT '20';