CREATE TABLE "notebook_page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebook_page_versions" ADD CONSTRAINT "notebook_page_versions_page_id_notebook_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."notebook_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_page_versions" ADD CONSTRAINT "notebook_page_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebook_page_versions_page_idx" ON "notebook_page_versions" USING btree ("page_id","created_at");