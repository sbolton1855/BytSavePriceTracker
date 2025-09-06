
/**
 * Email Logging Database Setup
 * - Purpose: Ensure email_logs table exists for tracking email sends
 * - Uses existing DB client from server/db.ts
 * - Future: Add webhook status updates, more detailed tracking
 */

import { db } from '../db';

export async function ensureEmailLogsTable() {
  try {
    console.log('[ensureEmailLogs] Creating email_logs table if not exists...');
    
    // Create the table with all required fields
    await db.execute(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id BIGSERIAL PRIMARY KEY,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        sg_message_id TEXT,
        preview_html TEXT,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for performance
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email)
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC)
    `);

    console.log('[ensureEmailLogs] email_logs table and indexes created successfully');
    return true;
  } catch (error) {
    console.error('[ensureEmailLogs] Failed to create email_logs table:', error);
    throw error;
  }
}
