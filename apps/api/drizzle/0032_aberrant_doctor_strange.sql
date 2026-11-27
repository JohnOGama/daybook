CREATE TABLE "security_findings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"target" text,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"cvss" integer,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_findings_space_idx" ON "security_findings" USING btree ("space_id");