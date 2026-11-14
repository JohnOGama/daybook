ALTER TYPE "public"."space_tool" ADD VALUE 'diagram';--> statement-breakpoint
CREATE TABLE "diagrams" (
	"space_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dbml" text DEFAULT '' NOT NULL,
	"positions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;