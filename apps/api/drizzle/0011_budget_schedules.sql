CREATE TYPE "public"."budget_frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TABLE "budget_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "budget_entry_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"category_id" uuid,
	"frequency" "budget_frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"month_days" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"start_day" date NOT NULL,
	"end_day" date,
	"active_from" date NOT NULL,
	"paused_from" date,
	"skipped_days" date[] DEFAULT '{}'::date[] NOT NULL,
	"auto_record" boolean DEFAULT false NOT NULL,
	"is_subscription" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_schedules_amount_positive" CHECK ("budget_schedules"."amount" > 0),
	CONSTRAINT "budget_schedules_transfer_shape" CHECK (("budget_schedules"."kind" = 'transfer') = ("budget_schedules"."to_account_id" IS NOT NULL) AND ("budget_schedules"."kind" <> 'transfer' OR "budget_schedules"."category_id" IS NULL)),
	CONSTRAINT "budget_schedules_interval_range" CHECK ("budget_schedules"."interval" BETWEEN 1 AND 365),
	CONSTRAINT "budget_schedules_end_after_start" CHECK ("budget_schedules"."end_day" IS NULL OR "budget_schedules"."end_day" >= "budget_schedules"."start_day")
);
--> statement-breakpoint
ALTER TABLE "budget_entries" ADD COLUMN "schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD COLUMN "occurrence_day" date;--> statement-breakpoint
ALTER TABLE "budget_schedules" ADD CONSTRAINT "budget_schedules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_schedules" ADD CONSTRAINT "budget_schedules_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_schedules" ADD CONSTRAINT "budget_schedules_account_id_budget_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."budget_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_schedules" ADD CONSTRAINT "budget_schedules_to_account_id_budget_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."budget_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_schedules" ADD CONSTRAINT "budget_schedules_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_schedules_space_idx" ON "budget_schedules" USING btree ("space_id");--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_schedule_id_budget_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."budget_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_entries_occurrence_idx" ON "budget_entries" USING btree ("schedule_id","occurrence_day");