CREATE TABLE "deck_baselines" (
	"deck_id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"cards" jsonb NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_baselines_source_check" CHECK ("deck_baselines"."source" in ('complete','owner'))
);
--> statement-breakpoint
ALTER TABLE "deck_baselines" ADD CONSTRAINT "deck_baselines_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;