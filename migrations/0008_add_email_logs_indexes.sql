
-- Add email logs table if not exists
CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"template_id" varchar(100),
	"subject" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'success' NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"preview_html" text,
	"type" varchar(50) DEFAULT 'other',
	"sent_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_email_logs_created_at" ON "email_logs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_email_logs_recipient" ON "email_logs" ("recipient_email");
CREATE INDEX IF NOT EXISTS "idx_email_logs_template" ON "email_logs" ("template_id");
CREATE INDEX IF NOT EXISTS "idx_email_logs_status" ON "email_logs" ("status");
CREATE INDEX IF NOT EXISTS "idx_email_logs_is_test" ON "email_logs" ("is_test");
