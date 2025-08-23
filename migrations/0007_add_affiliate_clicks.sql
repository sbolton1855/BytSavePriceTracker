
CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"asin" text NOT NULL,
	"clicked_at" timestamp DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"referrer" text
);
