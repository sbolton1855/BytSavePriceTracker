
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';
import { eq } from 'drizzle-orm';

interface LogEmailOptions {
  logId?: string;
  to: string;
  subject: string;
  html?: string;
  status: 'sent' | 'failed' | 'processed' | 'stubbed';
  isTest?: boolean;
  templateId?: string;
  error?: string;
  meta?: Record<string, any>;
  provider?: 'sendgrid' | 'fallback';
  sgMessageId?: string;
}

export async function logEmail(options: LogEmailOptions): Promise<void> {
  console.log(`[logEmail] logging: ${options.status} - ${options.to} (${options.provider || 'unknown'})`);

  try {
    const logEntry = {
      logId: options.logId || null,
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
      createdAt: new Date(),
    };

    if (db) {
      try {
        // Check if we're updating an existing log entry by logId
        if (options.logId) {
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
                meta: options.meta ? JSON.stringify(options.meta) : existing[0].meta,
                previewHtml: options.html || existing[0].previewHtml
              })
              .where(eq(emailLogs.logId, options.logId));

            console.log(`[logEmail] updated DB entry: ${options.logId} - ${options.status}`);
            return;
          }
        }

        // Create new entry
        await db.insert(emailLogs).values(logEntry);
        console.log(`[logEmail] created DB entry: ${options.status} - ${options.to}`);
        return;
      } catch (dbError) {
        console.error(`[logEmail] DB error, falling back to memory:`, dbError);
      }
    }

    // Fallback to in-memory logging
    let app: any = null;
    
    // Try to get app from global context
    if ((global as any).app) {
      app = (global as any).app;
    } else if (require.cache) {
      // Try to find the app instance from require cache
      const indexModule = Object.values(require.cache).find(
        (mod: any) => mod && mod.exports && mod.exports.app
      );
      if (indexModule) {
        app = (indexModule as any).exports.app;
      }
    }

    if (app && app.locals) {
      if (!app.locals.emailLogs) {
        app.locals.emailLogs = [];
      }

      // Check for existing entry by logId
      if (options.logId) {
        const existingIndex = app.locals.emailLogs.findIndex((log: any) => log.logId === options.logId);
        if (existingIndex >= 0) {
          // Update existing
          app.locals.emailLogs[existingIndex] = {
            ...app.locals.emailLogs[existingIndex],
            ...logEntry,
            id: app.locals.emailLogs[existingIndex].id // Keep original ID
          };
          console.log(`[logEmail] updated memory entry: ${options.logId} - ${options.status}`);
          return;
        }
      }

      // Create new
      app.locals.emailLogs.unshift({ id: Date.now(), ...logEntry });
      console.log(`[logEmail] created memory entry: ${options.status} - ${options.to}`);
      return;
    }

    // Last resort - use global object
    if (!(global as any).emailLogs) {
      (global as any).emailLogs = [];
    }

    // Check for existing entry by logId
    if (options.logId) {
      const existingIndex = (global as any).emailLogs.findIndex((log: any) => log.logId === options.logId);
      if (existingIndex >= 0) {
        // Update existing
        (global as any).emailLogs[existingIndex] = {
          ...(global as any).emailLogs[existingIndex],
          ...logEntry,
          id: (global as any).emailLogs[existingIndex].id // Keep original ID
        };
        console.log(`[logEmail] updated global entry: ${options.logId} - ${options.status}`);
        return;
      }
    }

    // Create new
    (global as any).emailLogs.unshift({ id: Date.now(), ...logEntry });
    console.log(`[logEmail] created global entry: ${options.status} - ${options.to}`);

  } catch (error) {
    console.error('[logEmail] Critical error (non-throwing):', error);
    // Never throw from logEmail to avoid breaking the email sending process
  }
}
