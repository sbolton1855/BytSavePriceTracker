import { db } from '../db';
import { emailLogs } from '../../migrations/schema';

interface LogEmailOptions {
  to: string;
  subject: string;
  html?: string;
  status: 'sent' | 'failed' | 'processed';
  isTest?: boolean;
  templateId?: string;
  error?: string;
  meta?: Record<string, any>;
  provider?: 'sendgrid' | 'fallback';
  sgMessageId?: string;
  logId?: string;
}

export async function logEmail(options: LogEmailOptions): Promise<void> {
  try {
    const logEntry = {
      to: options.to,
      subject: options.subject,
      status: options.status,
      isTest: options.isTest || false,
      templateId: options.templateId || null,
      previewHtml: options.html || null,
      meta: options.meta ? JSON.stringify(options.meta) : null,
      error: options.error || null,
      provider: options.provider || 'fallback',
      sgMessageId: options.sgMessageId || null,
      logId: options.logId || null,
      createdAt: new Date(),
    };

    if (db) {
      // Check if we're updating an existing log entry by logId
      if (options.logId) {
        try {
          const existing = await db.select()
            .from(emailLogs)
            .where(eq(emailLogs.logId, options.logId))
            .limit(1);

          if (existing.length > 0) {
            // Update existing entry
            await db.update(emailLogs)
              .set({
                status: options.status,
                sgMessageId: options.sgMessageId || existing[0].sgMessageId,
                error: options.error || existing[0].error,
                meta: options.meta ? JSON.stringify(options.meta) : existing[0].meta
              })
              .where(eq(emailLogs.logId, options.logId));

            console.log(`[email-log] Updated existing log entry: ${options.logId} - ${options.status}`);
            return;
          }
        } catch (updateError) {
          console.warn(`[email-log] Failed to update existing log, creating new entry:`, updateError);
        }
      }

      // Create new entry
      await db.insert(emailLogs).values(logEntry);
      console.log(`[email-log] Logged email to database: ${options.status} - ${options.to} (${options.provider})`);
    } else {
      // Fallback to in-memory logging if no database
      if (!global.emailLogs) {
        global.emailLogs = [];
      }

      // Check for existing entry by logId
      if (options.logId) {
        const existingIndex = global.emailLogs.findIndex((log: any) => log.logId === options.logId);
        if (existingIndex >= 0) {
          // Update existing
          global.emailLogs[existingIndex] = {
            ...global.emailLogs[existingIndex],
            ...logEntry,
            id: global.emailLogs[existingIndex].id // Keep original ID
          };
          console.log(`[email-log] Updated in-memory log: ${options.logId} - ${options.status}`);
          return;
        }
      }

      // Create new
      global.emailLogs.unshift({ id: Date.now(), ...logEntry });
      console.log(`[email-log] Logged email in-memory: ${options.status} - ${options.to} (${options.provider})`);
    }
  } catch (error) {
    console.error('[email-log] Failed to log email:', error);
  }
}