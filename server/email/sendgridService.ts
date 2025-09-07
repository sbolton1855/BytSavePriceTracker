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

    console.log(`[SendGrid] sending`, { to, subject });

    const response = await sgMail.send(msg);
    console.log('[SendGrid] Email sent successfully:', response[0].statusCode);

    // Best-effort database logging - never block email success
    try {
      await ensureEmailLogsTable();

      const messageId = response[0].headers?.['x-message-id'] || `no-header-${Date.now()}`;

      await db.execute(`
        INSERT INTO email_logs (recipient_email, subject, status, sg_message_id, preview_html)
        VALUES ($1, $2, $3, $4, $5)
      `, [to, subject, 'sent', messageId, html || null]);

      console.log('[SendGrid] Email logged successfully');
    } catch (logError) {
      console.error('[SendGrid] Failed to log email (non-blocking):', logError);
    }

    return {
      success: true,
      messageId: response[0].headers?.['x-message-id'] || 'no-message-id',
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
      await db.execute(`
        INSERT INTO email_logs (recipient_email, subject, status, error_message)
        VALUES ($1, $2, $3, $4)
      `, [to, subject, 'failed', errorMessage]);
      console.log('[SendGrid] Email failure logged successfully');
    } catch (logError) {
      console.error('[SendGrid] Failed to log email failure (non-blocking):', logError);
    }

    return { success: false, error: errorMessage };
  }
}