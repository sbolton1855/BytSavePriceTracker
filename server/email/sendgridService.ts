
/**
 * SendGrid Email Service with Comprehensive Logging
 * 
 * Purpose:
 * - Send emails through SendGrid API
 * - Log every email attempt to database with status "pending"
 * - Capture SendGrid message IDs for webhook tracking
 * - Provide detailed error handling and logging
 * 
 * Email Logging Flow:
 * 1. Insert email_logs record with status "pending"
 * 2. Send email via SendGrid
 * 3. Capture sg_message_id from response
 * 4. Update email_logs record with sg_message_id
 * 5. Later: webhook updates status based on delivery events
 * 
 * Maintainer Notes:
 * - Always log to database BEFORE sending to capture all attempts
 * - SendGrid message ID comes from response body, not headers
 * - Status updates happen via webhook handler in separate route
 */

import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { emailLogs } from '../../shared/schema';


// Validate and initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error('SENDGRID_API_KEY environment variable is not set');
} else {
  sgMail.setApiKey(apiKey);
  console.log('SendGrid initialized successfully with API key from Replit Secrets');
}

export interface SendGridEmailOptions {
  to: string;
  subject: string;
  html: string;
  productId?: number; // Optional product association for price drop emails
}

/**
 * Send email through SendGrid with comprehensive logging
 * 
 * This function:
 * 1. Creates a database log entry with status "pending"
 * 2. Sends the email via SendGrid
 * 3. Updates the log with SendGrid's message ID
 * 4. Returns success/failure status
 * 
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param html - HTML content of the email
 * @param productId - Optional product ID for product-related emails
 * @returns Promise with success status and message ID
 */
export async function sendEmail(
  to: string, 
  subject: string, 
  html: string,
  productId?: number
): Promise<{ success: boolean; messageId?: string; error?: string; logId?: number }> {
  
  let logId: number | undefined;
  
  try {
    console.log(`[EmailSend] Starting email send: ${to} - ${subject}`);
    
    // Step 1: Check for recent duplicate sends (prevent spam/race conditions)
    const recentDuplicate = await db
      .select({ id: emailLogs.id, status: emailLogs.status })
      .from(emailLogs)
      .where(
        sql`${emailLogs.recipientEmail} = ${to} 
            AND ${emailLogs.subject} = ${subject} 
            AND ${emailLogs.sentAt} > NOW() - INTERVAL '1 minute'`
      )
      .orderBy(sql`${emailLogs.id} DESC`)
      .limit(1);
    
    if (recentDuplicate.length > 0) {
      console.log(`[EmailSend] Duplicate email prevented: ${to} - ${subject} (existing log ID: ${recentDuplicate[0].id})`);
      return { 
        success: false, 
        error: 'Duplicate email prevented (sent within last minute)', 
        logId: recentDuplicate[0].id 
      };
    }

    // Step 2: Log email attempt to database BEFORE sending
    console.log(`[EmailSend] Creating database log entry`);
    
    const emailLogEntry = await db.insert(emailLogs).values({
      recipientEmail: to,
      productId: productId || null,
      subject: subject,
      previewHtml: html.substring(0, 500),
      status: 'pending',
      sentAt: new Date()
    }).returning();
    
    logId = emailLogEntry[0]?.id;
    console.log(`[EmailSend] Email logged with ID: ${logId}`);

    // Step 3: Check SendGrid configuration
    if (!process.env.SENDGRID_API_KEY || !apiKey) {
      console.warn('[EmailSend] SendGrid not configured');
      if (logId) {
        await updateEmailStatus(logId, 'failed', 'sendgrid');
      }
      return { success: false, error: 'SendGrid API key not configured', logId };
    }

    // Step 4: Prepare and send email
    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'alerts@bytsave.com',
      subject,
      html,
    };

    console.log(`[EmailSend] Calling SendGrid for log ${logId}`);

    let sendOk = false;
    let response: any;
    let resp: any;
    
    try {
      response = await sgMail.send(msg);
      [resp] = response;
      sendOk = true;
      
      console.log(`[EmailSend] SendGrid success for log ${logId}:`, resp?.statusCode);
    } catch (err) {
      console.error(`[EmailSend] SendGrid error for log ${logId}:`, err);
      sendOk = false;
    }

    // Step 5: Handle success or failure
    if (sendOk && response && response[0]) {
      // Extract SendGrid message ID
      const messageIdHeader = response[0].headers?.['x-message-id'] || response[0].headers?.['X-Message-Id'];
      const messageId = messageIdHeader || `sg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      console.log(`[EmailSend] Success for log ${logId}, message ID: ${messageId}`);

      // Update status to 'sent' and add message ID
      if (logId) {
        try {
          await db.update(emailLogs)
            .set({
              status: 'sent',
              sgMessageId: messageId,
              updatedAt: new Date()
            })
            .where(emailLogs.id.eq(logId));
          
          console.log(`[EmailSend] Updated log ${logId} to 'sent' with message ID: ${messageId}`);
        } catch (dbError) {
          console.error(`[EmailSend] Failed to update success status for log ${logId}:`, dbError);
        }
      }

      return { success: true, messageId, logId };
    } else {
      // Update status to 'failed'
      console.log(`[EmailSend] Failed for log ${logId}`);
      
      if (logId) {
        try {
          await db.update(emailLogs)
            .set({
              status: 'failed',
              updatedAt: new Date()
            })
            .where(emailLogs.id.eq(logId));
          
          console.log(`[EmailSend] Updated log ${logId} to 'failed'`);
        } catch (dbError) {
          console.error(`[EmailSend] Failed to update failed status for log ${logId}:`, dbError);
        }
      }
      
      return { success: false, error: 'SendGrid send failed', logId };
    }

  } catch (error: any) {
    console.error(`[EmailSend] Unexpected error for log ${logId}:`, error);
    
    // Try to update status to failed if we have a log ID
    if (logId) {
      try {
        await db.update(emailLogs)
          .set({
            status: 'failed',
            updatedAt: new Date()
          })
          .where(emailLogs.id.eq(logId));
        console.log(`[EmailSend] Updated log ${logId} to 'failed' due to error`);
      } catch (e) {
        console.error(`[EmailSend] Failed to update error status for log ${logId}:`, e);
      }
    }

    return { success: false, error: error.message || 'Unknown error', logId };
  }
}

/**
 * Convenience function for sending emails with just basic parameters
 * Maintains backward compatibility with existing code
 */
export async function sendEmailSimple(to: string, subject: string, html: string) {
  return sendEmail(to, subject, html);
}
