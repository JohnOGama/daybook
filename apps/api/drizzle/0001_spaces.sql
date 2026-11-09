CREATE TYPE "public"."space_kind" AS ENUM('folder', 'space');--> statement-breakpoint
CREATE TYPE "public"."space_tool" AS ENUM('list');--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"kind" "space_kind" NOT NULL,
	"title" text NOT NULL,
	"tool" "space_tool",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spaces_tool_only_on_space" CHECK (("spaces"."kind" = 'space') = ("spaces"."tool" IS NOT NULL)),
	CONSTRAINT "spaces_folder_top_level" CHECK ("spaces"."kind" = 'space' OR "spaces"."parent_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "space_id" uuid;--> statement-breakpoint
INSERT INTO "spaces" ("user_id", "kind", "title", "tool")
  SELECT DISTINCT "user_id", 'space'::"space_kind", 'My List', 'list'::"space_tool" FROM "tasks";--> statement-breakpoint
UPDATE "tasks" SET "space_id" = "spaces"."id" FROM "spaces" WHERE "spaces"."user_id" = "tasks"."user_id";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "space_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_parent_id_spaces_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spaces_user_idx" ON "spaces" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_space_idx" ON "tasks" USING btree ("space_id");