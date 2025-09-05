
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
  
  // DEBUG: Confirm sendEmail() is firing
  console.log(`🔥 [DEBUG] sendEmail() FIRING - recipient: ${to}, subject: ${subject}`);
  
  let logId: number | undefined;
  
  try {
    // Step 1: Log email attempt to database BEFORE sending
    // This ensures we capture all attempts, even if SendGrid fails
    console.log(`📧 [DB] Logging email attempt to database: ${to} - ${subject}`);
    
    try {
      const emailLogEntry = await db.insert(emailLogs).values({
        recipientEmail: to,
        productId: productId || null, // Explicitly set null if no product
        subject: subject,
        previewHtml: html.substring(0, 500), // First 500 chars for preview
        status: 'pending',
        sentAt: new Date()
      }).returning();
      
      logId = emailLogEntry[0]?.id;
      console.log(`📋 [DB] Email logged to database with ID: ${logId}`);
      console.log(`📋 [DB] Inserted into email_logs - recipient: ${to}, subject: ${subject}, status: pending`);
    } catch (dbError) {
      console.error(`❌ [DB] Failed to insert into email_logs:`, dbError);
      throw dbError; // Re-throw to handle properly
    }

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

    console.log(`📤 [SendGrid] Preparing email to: ${to}, subject: ${subject}`);
    console.log(`📤 [SendGrid] Message payload:`, { to: msg.to, from: msg.from, subject: msg.subject });

    // Step 4: Send email via SendGrid
    console.log(`📤 [SendGrid] Calling sgMail.send()...`);
    const response = await sgMail.send(msg);
    
    console.log(`✅ [SendGrid] Response received - statusCode: ${response[0]?.statusCode}`);
    console.log(`✅ [SendGrid] Response headers:`, response[0]?.headers);
    console.log(`✅ [SendGrid] Full response:`, JSON.stringify(response, null, 2));
    
    // Step 5: Extract message ID from SendGrid response
    // Important: SendGrid returns message ID in response body, not headers
    // Response structure: [{ statusCode, body, headers }, ...]
    let messageId = 'unknown';
    
    if (response && response[0]) {
      // Try to get message ID from response headers first
      const messageIdHeader = response[0].headers?.['x-message-id'];
      if (messageIdHeader) {
        messageId = messageIdHeader;
      } else {
        // Fallback: generate a unique ID if SendGrid doesn't provide one
        messageId = `sg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
    }

    console.log(`✅ Email sent successfully via SendGrid. Message ID: ${messageId}`);

    // Step 6: Update database log with SendGrid message ID
    if (logId) {
      await db.update(emailLogs)
        .set({
          sgMessageId: messageId,
          status: 'sent', // Update to "sent" since SendGrid accepted it
          updatedAt: new Date()
        })
        .where(emailLogs.id.eq(logId));
      
      console.log(`📋 Updated email log ${logId} with SendGrid message ID: ${messageId}`);
    }

    return { success: true, messageId, logId };

  } catch (error: any) {
    console.error('❌ [SendGrid] Failed to send email via SendGrid:', error);
    console.error('❌ [SendGrid] Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.body,
      stack: error.stack
    });

    // Log the error but keep the database entry for debugging
    let errorMessage = 'Unknown SendGrid error';
    if (error.response?.body?.errors) {
      errorMessage = error.response.body.errors.map((e: any) => e.message).join(', ');
      console.error('❌ [SendGrid] API Errors:', error.response.body.errors);
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Update database log with error status if we have a log ID
    if (logId) {
      try {
        await db.update(emailLogs)
          .set({
            status: 'failed',
            updatedAt: new Date()
          })
          .where(emailLogs.id.eq(logId));
        
        console.log(`📋 Updated email log ${logId} with failed status`);
      } catch (dbError) {
        console.error('❌ Failed to update email log with error status:', dbError);
      }
    }

    return { success: false, error: errorMessage, logId };
  }
}

/**
 * Convenience function for sending emails with just basic parameters
 * Maintains backward compatibility with existing code
 */
export async function sendEmailSimple(to: string, subject: string, html: string) {
  return sendEmail(to, subject, html);
}
