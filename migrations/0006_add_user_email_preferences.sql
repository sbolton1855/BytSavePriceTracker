
CREATE TABLE IF NOT EXISTS user_email_preferences (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    alert_frequency VARCHAR(20) NOT NULL DEFAULT 'instant',
    categories JSONB DEFAULT '["amazon"]',
    digest_enabled BOOLEAN DEFAULT true,
    marketing_enabled BOOLEAN DEFAULT false,
    coupon_alerts_enabled BOOLEAN DEFAULT true,
    auto_buy_confirmations BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_preferences_email ON user_email_preferences(email);
CREATE INDEX idx_email_preferences_frequency ON user_email_preferences(alert_frequency);
