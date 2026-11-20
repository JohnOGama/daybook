CREATE TABLE "space_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "space_groups" ADD CONSTRAINT "space_groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "space_groups_user_idx" ON "space_groups" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_group_id_space_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."space_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "space_groups" ("user_id", "title", "position") SELECT DISTINCT "user_id", 'Spaces', 0 FROM "spaces";--> statement-breakpoint
UPDATE "spaces" SET "group_id" = g."id" FROM "space_groups" g WHERE g."user_id" = "spaces"."user_id" AND "spaces"."parent_id" IS NULL;