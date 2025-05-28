-- Add metadata column to price_history table
ALTER TABLE price_history ADD COLUMN metadata JSONB; 