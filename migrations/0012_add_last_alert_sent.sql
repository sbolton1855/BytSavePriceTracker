
-- Add last_alert_sent column to tracked_products table
ALTER TABLE tracked_products 
ADD COLUMN last_alert_sent TIMESTAMP WITH TIME ZONE;

-- Update existing records to have a default value (null means never sent)
-- This allows the cooldown logic to work properly for existing products
