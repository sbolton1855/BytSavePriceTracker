
-- Add price_drop_alerts_enabled column to users table
ALTER TABLE users ADD COLUMN price_drop_alerts_enabled BOOLEAN DEFAULT true;

-- Update existing users to have price drop alerts enabled by default
UPDATE users SET price_drop_alerts_enabled = true WHERE price_drop_alerts_enabled IS NULL;
