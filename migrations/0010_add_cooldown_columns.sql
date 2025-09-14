
-- Add cooldown management columns to tracked_products table
ALTER TABLE tracked_products 
ADD COLUMN last_alert_sent TIMESTAMP,
ADD COLUMN cooldown_hours INTEGER DEFAULT 48,
ADD COLUMN last_notified_price DOUBLE PRECISION;

-- Add comment for documentation
COMMENT ON COLUMN tracked_products.last_alert_sent IS 'Timestamp when the last alert email was sent';
COMMENT ON COLUMN tracked_products.cooldown_hours IS 'Hours to wait before sending another alert (default 48)';
COMMENT ON COLUMN tracked_products.last_notified_price IS 'Price when last alert was sent, used for rebound detection';
