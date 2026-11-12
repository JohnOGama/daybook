CREATE TYPE "public"."budget_account_type" AS ENUM('cash', 'bank', 'savings', 'ewallet', 'credit');--> statement-breakpoint
CREATE TYPE "public"."budget_category_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."budget_entry_kind" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
ALTER TYPE "public"."space_tool" ADD VALUE 'budget';--> statement-breakpoint
CREATE TABLE "budget_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "budget_account_type" NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "budget_category_kind" NOT NULL,
	"monthly_limit" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_categories_limit_on_expense" CHECK ("budget_categories"."monthly_limit" IS NULL OR ("budget_categories"."kind" = 'expense' AND "budget_categories"."monthly_limit" > 0))
);
--> statement-breakpoint
CREATE TABLE "budget_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"space_id" uuid NOT NULL,
	"kind" "budget_entry_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"category_id" uuid,
	"day" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_entries_amount_positive" CHECK ("budget_entries"."amount" > 0),
	CONSTRAINT "budget_entries_transfer_shape" CHECK (("budget_entries"."kind" = 'transfer') = ("budget_entries"."to_account_id" IS NOT NULL) AND ("budget_entries"."kind" <> 'transfer' OR "budget_entries"."category_id" IS NULL)),
	CONSTRAINT "budget_entries_transfer_accounts_differ" CHECK ("budget_entries"."to_account_id" IS NULL OR "budget_entries"."to_account_id" <> "budget_entries"."account_id")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"space_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_account_id_budget_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."budget_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_to_account_id_budget_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."budget_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_accounts_space_idx" ON "budget_accounts" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "budget_categories_space_idx" ON "budget_categories" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "budget_entries_space_day_idx" ON "budget_entries" USING btree ("space_id","day");