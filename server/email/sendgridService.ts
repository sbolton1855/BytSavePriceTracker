
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
    // Step 1: Log email attempt to database BEFORE sending
    // This ensures we capture all attempts, even if SendGrid fails
    console.log(`📧 Logging email attempt to database: ${to} - ${subject}`);
    
    const emailLogEntry = await db.insert(emailLogs).values({
      recipientEmail: to,
      productId: productId || null, // Explicitly set null if no product
      subject: subject,
      previewHtml: html.substring(0, 500), // First 500 chars for preview
      status: 'pending',
      sentAt: new Date()
    }).returning();
    
    logId = emailLogEntry[0]?.id;
    console.log(`📋 Email logged to database with ID: ${logId}`);

    // Step 2: Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SendGrid API key not configured. Email not sent.');
      // Note: Database log remains with status "pending" - this is intentional
      // for debugging purposes
      return { success: false, error: 'SendGrid API key not configured', logId };
    }

    if (!apiKey) {
      console.warn('⚠️ SendGrid API key is invalid or not set. Email not sent.');
      return { success: false, error: 'SendGrid API key is invalid or not configured', logId };
    }

    // Step 3: Prepare SendGrid message
    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'alerts@bytsave.com',
      subject,
      html,
    };

    console.log('[EmailSend] start', { to: to, subject });
    console.log('[EmailSend] calling SendGrid');

    // Step 4: Send email via SendGrid
    let sendOk = false;
    let response: any;
    let resp: any;
    
    try {
      response = await sgMail.send(msg);
      [resp] = response;
      sendOk = true;
      
      console.log('[EmailSend] SendGrid status:', resp?.statusCode, 'x-message-id:', resp?.headers?.['x-message-id'] || resp?.headers?.['X-Message-Id']);
    } catch (err) {
      console.error('[EmailSend] SendGrid error:', err);
      sendOk = false;
      
      // Best-effort: mark the newest matching log as 'failed' for SendGrid errors
      try {
        const result = await db.query(
          `
          UPDATE email_logs
             SET status = 'failed',
                 updated_at = NOW()
           WHERE id = (
             SELECT id FROM email_logs
              WHERE recipient_email = $1 AND subject = $2
              ORDER BY id DESC
              LIMIT 1
           );
          `,
          [to, subject]
        );
        console.log('[EmailLog] update->failed rowCount:', result.rowCount);
      } catch (e) {
        // Do not throw on DB update failure
      }
    }

    // Best-effort: mark the newest matching log as 'sent' ONLY if SendGrid succeeded
    if (sendOk === true) {
      try {
        const result = await db.query(
          `
          UPDATE email_logs
             SET status = 'sent',
                 updated_at = NOW()
           WHERE id = (
             SELECT id FROM email_logs
              WHERE recipient_email = $1 AND subject = $2
              ORDER BY id DESC
              LIMIT 1
           );
          `,
          [to, subject]
        );
        console.log('[EmailLog] update->sent rowCount:', result.rowCount);
      } catch (e) {
        // Do not throw on DB update failure
      }
    }
    
    // Step 5: Extract message ID from SendGrid response (only if send was successful)
    // Important: SendGrid returns message ID in response body, not headers
    // Response structure: [{ statusCode, body, headers }, ...]
    let messageId = 'unknown';
    
    if (sendOk && response && response[0]) {
      // Try to get message ID from response headers first
      const messageIdHeader = response[0].headers?.['x-message-id'];
      if (messageIdHeader) {
        messageId = messageIdHeader;
      } else {
        // Fallback: generate a unique ID if SendGrid doesn't provide one
        messageId = `sg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
      
      console.log(`✅ Email sent successfully via SendGrid. Message ID: ${messageId}`);

      // Step 6: Update database log with SendGrid message ID
      if (logId) {
        try {
          await db.update(emailLogs)
            .set({
              sgMessageId: messageId,
              updatedAt: new Date()
            })
            .where(emailLogs.id.eq(logId));
          
          console.log(`📋 Updated email log ${logId} with SendGrid message ID: ${messageId}`);
        } catch (dbError) {
          console.error('❌ Failed to update email log with message ID:', dbError);
        }
      }

      return { success: true, messageId, logId };
    } else {
      // SendGrid failed
      return { success: false, error: 'SendGrid send failed', logId };
    }

  } catch (error: any) {
    console.error('❌ Database or other error in sendEmail:', error);

    // This catch handles non-SendGrid errors (like database errors)
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
