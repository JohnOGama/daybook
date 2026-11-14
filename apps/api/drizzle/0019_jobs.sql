CREATE TYPE "public"."job_status" AS ENUM('saved', 'applied', 'interviewing', 'offer', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."job_work_mode" AS ENUM('remote', 'hybrid', 'onsite');--> statement-breakpoint
ALTER TYPE "public"."space_tool" ADD VALUE 'jobs';--> statement-breakpoint
CREATE TABLE "job_profiles" (
	"space_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cv_text" text,
	"cv_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"company" text NOT NULL,
	"url" text,
	"location" text,
	"work_mode" "job_work_mode",
	"salary" text,
	"employment_type" text,
	"posted_on" date,
	"description" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" "job_status" NOT NULL,
	"events" jsonb NOT NULL,
	"next_step_day" date,
	"next_step_note" text,
	"match_pct" integer,
	"match_summary" text,
	"skills_have" jsonb,
	"skills_missing" jsonb,
	"matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_profiles" ADD CONSTRAINT "job_profiles_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_profiles" ADD CONSTRAINT "job_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_space_idx" ON "jobs" USING btree ("space_id");