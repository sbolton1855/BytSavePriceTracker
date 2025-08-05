
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    product_id INTEGER REFERENCES products(id),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subject TEXT,
    preview_html TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_product_id ON email_logs(product_id);
