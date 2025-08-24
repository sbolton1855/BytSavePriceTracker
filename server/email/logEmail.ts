
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';

interface EmailLogData {
  to: string;
  templateId?: string;
  subject: string;
  status?: 'success' | 'fail' | 'sent' | 'failed';
  isTest?: boolean;
  previewHtml?: string;
  meta?: any;
}

export async function logEmail(data: EmailLogData) {
  try {
    const [result] = await db.insert(emailLogs).values({
      to: data.to,
      templateId: data.templateId,
      subject: data.subject,
      status: data.status || 'success',
      isTest: data.isTest || false,
      previewHtml: data.previewHtml,
      meta: data.meta
    }).returning();
    
    console.log('[email-log] logged:', { id: result.id, to: data.to, subject: data.subject });
    return result;
  } catch (error) {
    console.error('[email-log] failed, trying memory fallback:', { error: error.message, data });
    
    // Fallback to in-memory storage
    try {
      const memoryLog = {
        id: Date.now(),
        to: data.to,
        templateId: data.templateId,
        subject: data.subject,
        status: data.status || 'success',
        isTest: data.isTest || false,
        previewHtml: data.previewHtml,
        meta: data.meta,
        createdAt: new Date().toISOString()
      };
      
      // Store in app.locals if available
      const app = require('../index').app;
      if (app?.locals) {
        if (!app.locals.emailLogs) {
          app.locals.emailLogs = [];
        }
        app.locals.emailLogs.unshift(memoryLog);
        // Keep only last 100 entries in memory
        if (app.locals.emailLogs.length > 100) {
          app.locals.emailLogs = app.locals.emailLogs.slice(0, 100);
        }
      }
      
      console.log('[email-log] memory fallback logged:', { id: memoryLog.id, to: data.to, subject: data.subject });
      return memoryLog;
    } catch (memoryError) {
      console.error('[email-log] memory fallback also failed:', memoryError);
      throw error; // Throw original DB error
    }
  }
}
