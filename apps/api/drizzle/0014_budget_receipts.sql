CREATE TABLE "budget_receipts" (
	"entry_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"media_type" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_receipts" ADD CONSTRAINT "budget_receipts_entry_id_budget_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."budget_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_receipts" ADD CONSTRAINT "budget_receipts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;