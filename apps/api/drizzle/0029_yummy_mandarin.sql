ALTER TYPE "public"."space_tool" ADD VALUE 'focus';--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"minutes" integer NOT NULL,
	"task_id" uuid,
	"task_title" text
);
--> statement-breakpoint
CREATE TABLE "focus_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"focus_minutes" integer NOT NULL,
	"short_break_minutes" integer NOT NULL,
	"long_break_minutes" integer NOT NULL,
	"long_break_every" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_settings" ADD CONSTRAINT "focus_settings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_settings" ADD CONSTRAINT "focus_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "focus_sessions_space_day_idx" ON "focus_sessions" USING btree ("space_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "focus_settings_space_idx" ON "focus_settings" USING btree ("space_id");