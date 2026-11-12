ALTER TYPE "public"."budget_account_type" ADD VALUE 'loan';--> statement-breakpoint
CREATE TABLE "budget_goal_contributions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"day" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_goal_contributions_amount_nonzero" CHECK ("budget_goal_contributions"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "budget_goals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target" bigint NOT NULL,
	"target_day" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_goals_target_positive" CHECK ("budget_goals"."target" > 0)
);
--> statement-breakpoint
ALTER TABLE "budget_accounts" ADD COLUMN "apr_bps" integer;--> statement-breakpoint
ALTER TABLE "budget_accounts" ADD COLUMN "due_day" integer;--> statement-breakpoint
ALTER TABLE "budget_accounts" ADD COLUMN "minimum_payment" bigint;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "low_balance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_goal_contributions" ADD CONSTRAINT "budget_goal_contributions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_goal_contributions" ADD CONSTRAINT "budget_goal_contributions_goal_id_budget_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."budget_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_goal_contributions_goal_idx" ON "budget_goal_contributions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "budget_goals_space_idx" ON "budget_goals" USING btree ("space_id");