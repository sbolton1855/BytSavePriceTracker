
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';

interface EmailLogData {
  recipientEmail: string;
  templateId?: string;
  subject: string;
  status?: 'success' | 'fail';
  isTest?: boolean;
  previewHtml?: string;
  type?: string;
}

export async function logEmail(data: EmailLogData) {
  try {
    const [result] = await db.insert(emailLogs).values({
      recipientEmail: data.recipientEmail,
      templateId: data.templateId,
      subject: data.subject,
      status: data.status || 'success',
      isTest: data.isTest || false,
      previewHtml: data.previewHtml,
      type: data.type || 'other'
    }).returning();
    
    console.log('[email-log] logged:', { id: result.id, to: data.recipientEmail, subject: data.subject });
    return result;
  } catch (error) {
    console.error('[email-log] failed:', { error: error.message, data });
    throw error;
  }
}
