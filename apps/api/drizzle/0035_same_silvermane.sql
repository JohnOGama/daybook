CREATE TABLE "vault_space_keys" (
	"space_id" uuid PRIMARY KEY NOT NULL,
	"salt" text NOT NULL,
	"iterations" integer NOT NULL,
	"wrapped_key" text NOT NULL,
	"owner_wrapped_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_space_keys" ADD CONSTRAINT "vault_space_keys_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;