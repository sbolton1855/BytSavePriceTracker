
-- Migration 0012: Add global config table
-- This replaces per-user cooldown settings with a global admin-configurable setting

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed with current cooldown setting
INSERT INTO config (key, value) VALUES ('cooldown_hours', '72')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);
