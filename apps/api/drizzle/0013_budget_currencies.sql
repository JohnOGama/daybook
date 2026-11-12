ALTER TABLE "budget_accounts" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD COLUMN "to_amount" bigint;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "rates" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_to_amount_on_transfer" CHECK ("budget_entries"."to_amount" IS NULL OR ("budget_entries"."kind" = 'transfer' AND "budget_entries"."to_amount" > 0));