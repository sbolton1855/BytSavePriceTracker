/**
 * Email System: SendGrid Service Layer
 * - Entry point: Admin email test forms, price drop notifications
 * - Output: Sends emails via SendGrid API, logs to database, returns success/failure
 * - Dependencies: SENDGRID_API_KEY (required), FROM_EMAIL (required), BASE_URL (optional)
 * - Future: Add webhook status tracking, branded links, delivery confirmation
 * - Logging: Best-effort only - never blocks email sending
 */

import sgMail from '@sendgrid/mail';
import { createEmailTemplate } from './templates';
import { ensureEmailLogsTable } from '../db/ensureEmailLogs';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Validate and initialize SendGrid with API key from Replit Secrets
const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error('SENDGRID_API_KEY environment variable is not set');
} else {
  // SendGrid API keys can start with 'SG.' but Replit Secrets may modify the format
  // Just verify it's a non-empty string and initialize
  sgMail.setApiKey(apiKey);
  console.log('SendGrid initialized successfully with API key from Replit Secrets');
}

export interface SendGridEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Core SendGrid email sending function
 * This is the lowest level email sender - all emails flow through here
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string; statusCode?: number }> {
  try {
    // Guard: Ensure SendGrid API key is configured in Replit Secrets
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email not sent.');
      return { success: false, error: 'SendGrid API key not configured' };
    }

    // Double-check API key validation (redundant but safe)
    if (!apiKey) {
        console.warn('SendGrid API key is invalid or not set. Email not sent.');
        return { success: false, error: 'SendGrid API key is invalid or not configured' };
    }

    // Build SendGrid message object
    // FROM address: Uses EMAIL_FROM env var or defaults to alerts@bytsave.com
    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'alerts@bytsave.com',
      subject,
      html,
    };

    console.log(`[SendGrid] Attempting to send email:`, { 
      to, 
      subject, 
      from: msg.from,
      hasHtml: !!html,
      htmlLength: html?.length || 0
    });

    const response = await sgMail.send(msg);
    
    // Extract message ID from multiple possible locations
    let messageId = null;
    const responseHeaders = response[0].headers || {};
    
    // SendGrid can return message ID in different header formats
    messageId = responseHeaders['x-message-id'] || 
                responseHeaders['X-Message-Id'] || 
                responseHeaders['message-id'] ||
                response[0].messageId;

    console.log('[SendGrid] Email sent successfully:', {
      statusCode: response[0].statusCode,
      messageId: messageId,
      allHeaders: Object.keys(responseHeaders),
      actualHeaders: responseHeaders,
      to: msg.to,
      subject: msg.subject
    });

    // Log warning if no message ID found
    if (!messageId) {
      console.warn('[SendGrid] ⚠️ No message ID found in SendGrid response - webhook matching may fail');
      console.warn('[SendGrid] Response headers:', responseHeaders);
      messageId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Best-effort database logging - never block email success
    try {
      await ensureEmailLogsTable();

      // Guard against duplicate inserts using SendGrid message ID
      if (messageId && messageId !== 'null' && !messageId.startsWith('fallback-')) {
        const existingLogs = await db.execute(sql`
          SELECT id FROM email_logs WHERE sg_message_id = ${messageId} LIMIT 1
        `);
        
        if (existingLogs.rows && existingLogs.rows.length > 0) {
          console.log(`[EmailLog] ⚠️ Skipping duplicate log for message ID ${messageId}`);
          return {
            success: true,
            messageId: messageId,
            statusCode: response[0].statusCode
          };
        }
      }

      const recipientEmail = msg.to;
      const subject = msg.subject;
      const previewHtml = html ? html.substring(0, 500) : null;

      await db.execute(sql`
        INSERT INTO email_logs (recipient_email, subject, status, sg_message_id, preview_html, sent_at, updated_at)
        VALUES (${recipientEmail}, ${subject}, ${'sent'}, ${messageId}, ${previewHtml}, ${new Date()}, ${new Date()})
      `);

      console.log('[EmailLog] ✅ Email logged successfully:', {
        recipient: recipientEmail,
        subject: subject,
        messageId: messageId,
        status: 'sent'
      });
    } catch (logError) {
      console.error('[SendGrid] ❌ Failed to log email (non-blocking):', logError);
    }

    return {
      success: true,
      messageId: messageId,
      statusCode: response[0].statusCode
    };
  } catch (error: any) {
    console.error('Failed to send email via SendGrid:', error);

    // Parse SendGrid-specific error responses
    // SendGrid returns structured error objects with detailed messages
    let errorMessage = 'Unknown SendGrid error';
    if (error.response?.body?.errors) {
      // Multiple errors possible (e.g., invalid email + content issues)
      errorMessage = error.response.body.errors.map((e: any) => e.message).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Attempt to log the failure to the database as well
    try {
      await ensureEmailLogsTable();
      const recipientEmail = to;
      const emailSubject = subject;
      const previewHtml = html ? html.substring(0, 500) : null;
      const failureId = `failed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await db.execute(sql`
        INSERT INTO email_logs (recipient_email, subject, status, sg_message_id, error_message, preview_html, sent_at, updated_at)
        VALUES (${recipientEmail}, ${emailSubject}, ${'failed'}, ${failureId}, ${errorMessage}, ${previewHtml}, ${new Date()}, ${new Date()})
      `);
      console.log('[EmailLog] ✅ Email failure logged:', {
        recipient: recipientEmail,
        error: errorMessage,
        failureId: failureId
      });
    } catch (logError) {
      console.error('[SendGrid] ❌ Failed to log email failure (non-blocking):', logError);
    }

    return { success: false, error: errorMessage };
  }
}