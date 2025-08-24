
-- Add SendGrid integration fields to email_logs table
ALTER TABLE email_logs ADD COLUMN provider VARCHAR(50) DEFAULT 'fallback';
ALTER TABLE email_logs ADD COLUMN sg_message_id VARCHAR(255);
ALTER TABLE email_logs ADD COLUMN log_id VARCHAR(255);

-- Add index for log_id lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_log_id ON email_logs(log_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sg_message_id ON email_logs(sg_message_id);
