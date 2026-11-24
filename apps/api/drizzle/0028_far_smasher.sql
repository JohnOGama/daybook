CREATE TABLE "fitness_water" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"glasses" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fitness_water" ADD CONSTRAINT "fitness_water_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_water" ADD CONSTRAINT "fitness_water_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fitness_water_day_idx" ON "fitness_water" USING btree ("space_id","day");