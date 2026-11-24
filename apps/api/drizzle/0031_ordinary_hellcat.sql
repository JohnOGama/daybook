ALTER TABLE "jobs" ADD COLUMN "next_step_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "reminder_sent_for" timestamp with time zone;