
-- Migration 0009: Comprehensive Email Logging System
-- Purpose: Standardize email logging with proper SendGrid webhook support
-- 
-- This migration creates a robust email logging system that:
-- 1. Logs every email attempt locally when sent
-- 2. Updates status when SendGrid webhooks fire
-- 3. Supports all major email events (sent, delivered, bounced, opened, etc.)
-- 4. Links emails to products when applicable (price drops, etc.)

-- Drop existing email_logs table if it exists and recreate with standardized schema
DROP TABLE IF EXISTS email_logs CASCADE;

CREATE TABLE email_logs (
    -- Primary key and identification
    id SERIAL PRIMARY KEY,
    
    -- Recipient information (standardized naming)
    recipient_email VARCHAR(255) NOT NULL,
    
    -- Optional product association (nullable for non-product emails like password resets)
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    
    -- Email content metadata
    subject TEXT NOT NULL,
    preview_html TEXT, -- First 500 chars of HTML for preview/debugging
    
    -- SendGrid tracking
    sg_message_id VARCHAR(255) UNIQUE, -- SendGrid's unique message identifier
    
    -- Status tracking
    -- pending: Just sent, waiting for SendGrid confirmation
    -- sent: SendGrid accepted the email
    -- delivered: Email reached recipient's inbox
    -- bounced: Email bounced (hard or soft)
    -- opened: Recipient opened the email
    -- clicked: Recipient clicked a link
    -- spam_reported: Recipient marked as spam
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at DESC); -- Most recent first
CREATE INDEX idx_email_logs_sg_message_id ON email_logs(sg_message_id);
CREATE INDEX idx_email_logs_product_id ON email_logs(product_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at when row is modified
CREATE TRIGGER email_logs_updated_at_trigger
    BEFORE UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_email_logs_updated_at();

-- Add some sample data for testing (optional)
-- This helps verify the schema works correctly
INSERT INTO email_logs (recipient_email, subject, preview_html, status, sg_message_id) VALUES
('test@example.com', '[TEST] Welcome to BytSave', '<p>Welcome to BytSave price tracking...</p>', 'delivered', 'test-msg-001'),
('admin@bytsave.com', '[TEST] Password Reset', '<p>Click here to reset your password...</p>', 'opened', 'test-msg-002');
