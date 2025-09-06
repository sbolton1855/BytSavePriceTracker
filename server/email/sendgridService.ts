/**
 * Email System: SendGrid Service Layer
 * - Entry point: Called by server/emailService.ts
 * - Output: Sends emails via SendGrid API, returns success/failure with messageId
 * - Dependencies: SENDGRID_API_KEY (from Replit Secrets), EMAIL_FROM (optional, defaults to alerts@bytsave.com)
 * - Future: Add webhook handling for delivery status, bounce tracking, branded domain setup
 */

import sgMail from '@sendgrid/mail';

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
export async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
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

    console.log(`Sending email via SendGrid to: ${to}`);
    console.log(`Subject: ${subject}`);

    // Send via SendGrid API
    const response = await sgMail.send(msg);
    
    // Extract message ID for tracking (used for webhooks later)
    const messageId = response[0]?.headers?.['x-message-id'] || 'unknown';

    console.log(`Email sent successfully via SendGrid. Message ID: ${messageId}`);

    return { success: true, messageId };
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

    return { success: false, error: errorMessage };
  }
}