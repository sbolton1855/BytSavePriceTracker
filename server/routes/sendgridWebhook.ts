/**
 * SendGrid Webhook Handler
 * 
 * Purpose:
 * - Receive webhook events from SendGrid about email delivery status
 * - Update email_logs table with real-time delivery information
 * - Handle all major email events: delivered, bounced, opened, clicked, etc.
 * 
 * Webhook Flow:
 * 1. SendGrid sends HTTP POST to /webhook/sendgrid when email events occur
 * 2. We parse the JSON payload containing event data
 * 3. Match events to our email_logs records using sg_message_id
 * 4. Update status in database accordingly
 * 
 * Security Notes:
 * - TODO: Implement SendGrid webhook signature verification for production
 * - For now, accepting all requests without authentication (forced decision)
 * - In production, verify requests are actually from SendGrid
 * 
 * Maintainer Notes:
 * - SendGrid sends multiple events for same email (sent -> delivered -> opened)
 * - We keep the "highest priority" status (delivered > sent, opened > delivered)
 * - All events are logged for debugging purposes
 * - Webhook endpoint must be publicly accessible (no auth middleware)
 */

import express from 'express';
import { db } from '../db';
import { emailLogs } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

/**
 * SendGrid Webhook Event Types and Priority
 * 
 * SendGrid sends various events throughout email lifecycle:
 * - processed: Email was received by SendGrid
 * - sent: Email was sent from SendGrid to receiving server
 * - delivered: Email was accepted by receiving server
 * - bounced: Email bounced (permanent or temporary failure)
 * - opened: Recipient opened the email (tracking pixel loaded)
 * - clicked: Recipient clicked a link in the email
 * - spamreport: Recipient marked email as spam
 * - unsubscribe: Recipient unsubscribed
 * 
 * We map these to our simplified status system
 */
const EVENT_STATUS_MAP: Record<string, string> = {
  'processed': 'sent',
  'sent': 'sent',
  'delivered': 'delivered',
  'bounce': 'bounced',
  'dropped': 'bounced',
  'open': 'opened',
  'click': 'clicked',
  'spamreport': 'spam_reported',
  'unsubscribe': 'clicked' // Still counts as engagement
};

/**
 * Status Priority (higher number = higher priority)
 * This prevents "downgrading" status when multiple events arrive
 * Example: Don't change "opened" back to "delivered"
 */
const STATUS_PRIORITY: Record<string, number> = {
  'pending': 1,
  'failed': 2,
  'sent': 3,
  'bounced': 4,     // Bounced is worse than sent
  'delivered': 5,
  'spam_reported': 6, // Spam is worse than delivered but shows engagement
  'opened': 7,
  'clicked': 8      // Highest engagement
};

/**
 * Centralized Email Status Manager
 * 
 * This function manages the logic for updating email statuses consistently
 * across different parts of the application (e.g., webhooks, direct sends).
 * It ensures that status transitions follow the defined priority.
 */
async function updateEmailStatusByMessageId(sgMessageId: string, newStatus: string): Promise<boolean> {
  try {
    const existingLogs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.sgMessageId, sgMessageId))
      .limit(1);

    if (existingLogs.length === 0) {
      console.warn(`[StatusManager] No email log found for SendGrid message ID: ${sgMessageId}`);
      return false;
    }

    const emailLog = existingLogs[0];
    const currentStatus = emailLog.status;

    const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
    const newPriority = STATUS_PRIORITY[newStatus] || 0;

    // If new status has lower or equal priority, and it's not a 'pending' update
    // (pending can be overwritten by any valid status), we don't update.
    if (newPriority <= currentPriority && currentStatus !== 'pending') {
      console.log(`[StatusManager] Skipping status update: keeping ${currentStatus} (priority ${currentPriority}) over ${newStatus} (priority ${newPriority}) for message ${sgMessageId}`);
      return false;
    }

    console.log(`[StatusManager] Updating status: ${currentStatus} (priority ${currentPriority}) -> ${newStatus} (priority ${newPriority}) for message ${sgMessageId}`);

    await db
      .update(emailLogs)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(emailLogs.sgMessageId, sgMessageId));

    console.log(`[StatusManager] ✅ Successfully updated status for message ${sgMessageId}`);
    return true;

  } catch (error) {
    console.error(`[StatusManager] Failed to update email status for message ${sgMessageId}:`, error);
    return false;
  }
}


/**
 * Main webhook endpoint for SendGrid events
 * 
 * SendGrid POSTs an array of events to this endpoint
 * Each event contains sg_message_id and event type
 * We update our email_logs accordingly
 */
router.post('/webhook/sendgrid', express.json(), async (req, res) => {
  try {
    console.log('📨 SendGrid webhook received');

    // TODO: Implement SendGrid webhook signature verification
    // For production security, verify the request is actually from SendGrid
    // Example: const signature = req.headers['x-twilio-email-event-webhook-signature'];
    // if (!verifySignature(req.body, signature)) { return res.status(401).send('Unauthorized'); }

    const events = req.body;

    if (!Array.isArray(events)) {
      console.warn('⚠️ SendGrid webhook: Expected array of events, got:', typeof events);
      return res.status(400).json({ error: 'Expected array of events' });
    }

    console.log(`📊 Processing ${events.length} SendGrid events`);

    // Process each event in the webhook payload
    for (const event of events) {
      await processWebhookEvent(event);
    }

    // SendGrid expects a 200 response to confirm we processed the webhook
    res.status(200).json({ 
      success: true, 
      processed: events.length,
      message: 'Webhook events processed successfully'
    });

  } catch (error) {
    console.error('❌ SendGrid webhook processing error:', error);

    // Return 500 so SendGrid knows to retry the webhook
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process individual SendGrid webhook event
 * 
 * @param event - SendGrid event object containing sg_message_id and event type
 */
async function processWebhookEvent(event: any) {
  try {
    // Extract key fields from SendGrid event
    const sgMessageId = event.sg_message_id;
    const eventType = event.event;
    const timestamp = event.timestamp; // Not directly used but good to log if needed

    console.log(`[Webhook] Processing event: ${eventType} for message: ${sgMessageId}`);

    if (!sgMessageId) {
      console.warn('[Webhook] SendGrid event missing sg_message_id:', event);
      return;
    }

    if (!eventType) {
      console.warn('[Webhook] SendGrid event missing event type:', event);
      return;
    }

    // Map SendGrid event type to our status system
    const newStatus = EVENT_STATUS_MAP[eventType];
    if (!newStatus) {
      console.log(`[Webhook] Unknown SendGrid event type: ${eventType}, ignoring`);
      return;
    }

    // Use centralized status manager for consistent updates
    const updated = await updateEmailStatusByMessageId(sgMessageId, newStatus);

    if (!updated) {
      console.log(`[Webhook] Status not updated for message ${sgMessageId}`);
    }

    // Log additional event details for debugging
    if (event.reason) {
      console.log(`[Webhook] Event reason: ${event.reason}`);
    }
    if (event.url && eventType === 'click') {
      console.log(`[Webhook] Clicked URL: ${event.url}`);
    }

  } catch (error) {
    console.error(`[Webhook] Failed to process webhook event:`, error);
    console.error(`[Webhook] Event data:`, event);
    // Don't throw - we want to continue processing other events
  }
}

export default router;