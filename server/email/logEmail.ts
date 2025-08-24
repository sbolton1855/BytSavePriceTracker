
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
    console.error('[email-log] failed:', { error: error.message, data });
    throw error;
  }
}
