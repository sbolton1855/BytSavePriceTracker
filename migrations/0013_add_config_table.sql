
-- Create config table for global application settings
CREATE TABLE IF NOT EXISTS "config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "config_key_unique" UNIQUE("key")
);

-- Insert default cooldown configuration
INSERT INTO "config" ("key", "value") VALUES ('cooldown_hours', '72') 
ON CONFLICT (key) DO NOTHING;
