ALTER TYPE "public"."space_tool" ADD VALUE 'fitness';--> statement-breakpoint
CREATE TABLE "fitness_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid,
	"user_id" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"equipment" text,
	"primary_muscles" jsonb NOT NULL,
	"secondary_muscles" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_food_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"meal" text NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"quantity_milli" integer NOT NULL,
	"serving_label" text NOT NULL,
	"amount_mg" integer NOT NULL,
	"kcal" integer NOT NULL,
	"protein_mg" integer NOT NULL,
	"carbs_mg" integer NOT NULL,
	"fat_mg" integer NOT NULL,
	"fiber_mg" integer NOT NULL,
	"eaten" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_food_servings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"space_id" uuid,
	"user_id" text,
	"label" text NOT NULL,
	"amount_mg" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid,
	"user_id" text,
	"fdc_id" integer,
	"name" text NOT NULL,
	"category" text,
	"kcal" integer NOT NULL,
	"protein_mg" integer NOT NULL,
	"carbs_mg" integer NOT NULL,
	"fat_mg" integer NOT NULL,
	"fiber_mg" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fitness_foods_fdc_id_unique" UNIQUE("fdc_id")
);
--> statement-breakpoint
CREATE TABLE "fitness_meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_profiles" (
	"space_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"weight_g" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fitness_exercises" ADD CONSTRAINT "fitness_exercises_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_exercises" ADD CONSTRAINT "fitness_exercises_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_food_logs" ADD CONSTRAINT "fitness_food_logs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_food_logs" ADD CONSTRAINT "fitness_food_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_food_logs" ADD CONSTRAINT "fitness_food_logs_food_id_fitness_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."fitness_foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_food_servings" ADD CONSTRAINT "fitness_food_servings_food_id_fitness_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."fitness_foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_food_servings" ADD CONSTRAINT "fitness_food_servings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_food_servings" ADD CONSTRAINT "fitness_food_servings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_foods" ADD CONSTRAINT "fitness_foods_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_foods" ADD CONSTRAINT "fitness_foods_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_meal_plans" ADD CONSTRAINT "fitness_meal_plans_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_meal_plans" ADD CONSTRAINT "fitness_meal_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_profiles" ADD CONSTRAINT "fitness_profiles_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_profiles" ADD CONSTRAINT "fitness_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_weights" ADD CONSTRAINT "fitness_weights_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_weights" ADD CONSTRAINT "fitness_weights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_workout_templates" ADD CONSTRAINT "fitness_workout_templates_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_workout_templates" ADD CONSTRAINT "fitness_workout_templates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_workouts" ADD CONSTRAINT "fitness_workouts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_workouts" ADD CONSTRAINT "fitness_workouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fitness_exercises_space_idx" ON "fitness_exercises" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fitness_exercises_builtin_name_idx" ON "fitness_exercises" USING btree ("name") WHERE "fitness_exercises"."space_id" IS NULL;--> statement-breakpoint
CREATE INDEX "fitness_food_logs_day_idx" ON "fitness_food_logs" USING btree ("space_id","day");--> statement-breakpoint
CREATE INDEX "fitness_food_servings_food_idx" ON "fitness_food_servings" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "fitness_foods_space_idx" ON "fitness_foods" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "fitness_meal_plans_space_idx" ON "fitness_meal_plans" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fitness_weights_day_idx" ON "fitness_weights" USING btree ("space_id","day");--> statement-breakpoint
CREATE INDEX "fitness_workout_templates_space_idx" ON "fitness_workout_templates" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "fitness_workouts_day_idx" ON "fitness_workouts" USING btree ("space_id","day");