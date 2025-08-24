
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';
import { eq } from 'drizzle-orm';

const router = Router();

interface SendGridEvent {
  event: string;
  email: string;
  timestamp: number;
  'smtp-id'?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  reason?: string;
  status?: string;
  response?: string;
  useragent?: string;
  ip?: string;
  url?: string;
  custom_args?: Record<string, any>;
}

// SendGrid Event Webhook endpoint
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[sg-webhook] Received webhook payload');
    
    // Verify payload is an array
    if (!Array.isArray(req.body)) {
      if (process.env.SG_WEBHOOK_VERIFY_DISABLED !== 'true') {
        console.warn('[sg-webhook] Invalid payload - not an array');
        return res.status(400).json({ error: 'Invalid payload format' });
      }
    }

    const events: SendGridEvent[] = req.body;
    let processedCount = 0;

    for (const event of events) {
      try {
        await processWebhookEvent(event);
        processedCount++;
      } catch (eventError) {
        console.error('[sg-webhook] Error processing event:', event.sg_event_id, eventError);
        // Continue processing other events
      }
    }

    console.log(`[sg-webhook] Processed ${processedCount}/${events.length} events successfully`);
    res.status(200).json({ 
      success: true, 
      processed: processedCount,
      total: events.length 
    });

  } catch (error) {
    console.error('[sg-webhook] Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function processWebhookEvent(event: SendGridEvent): Promise<void> {
  const { 
    event: eventType, 
    sg_message_id, 
    timestamp, 
    reason, 
    custom_args 
  } = event;

  console.log(`[sg-webhook] Processing event: ${eventType} for message: ${sg_message_id}`);

  // Skip if no message ID to correlate with
  if (!sg_message_id && !custom_args?.logId) {
    console.log('[sg-webhook] Skipping event - no sg_message_id or logId');
    return;
  }

  // Map SendGrid events to our status
  let newStatus: string | null = null;
  
  switch (eventType) {
    case 'delivered':
      newStatus = 'sent';
      break;
    case 'bounce':
    case 'dropped':
      newStatus = 'failed';
      break;
    case 'processed':
    case 'deferred':
      // Keep existing status unless it's failed
      break;
    default:
      // For open, click, spamreport, unsubscribe, etc. - don't change status
      break;
  }

  if (!db) {
    console.log('[sg-webhook] Database not available, skipping log update');
    return;
  }

  try {
    // Find log entry by sg_message_id or logId
    let whereClause;
    if (sg_message_id) {
      whereClause = eq(emailLogs.sgMessageId, sg_message_id);
    } else if (custom_args?.logId) {
      whereClause = eq(emailLogs.logId, custom_args.logId);
    } else {
      return;
    }

    const existing = await db.select()
      .from(emailLogs)
      .where(whereClause)
      .limit(1);

    if (existing.length === 0) {
      console.log(`[sg-webhook] No log entry found for message: ${sg_message_id || custom_args?.logId}`);
      return;
    }

    const logEntry = existing[0];
    const updates: any = {};

    // Update status if we have a mapping and it's not already failed
    if (newStatus && logEntry.status !== 'failed') {
      updates.status = newStatus;
    }

    // Update sg_message_id if we found by logId but don't have it yet
    if (custom_args?.logId && !logEntry.sgMessageId && sg_message_id) {
      updates.sgMessageId = sg_message_id;
    }

    // Add event info to meta
    if (logEntry.meta) {
      try {
        const meta = JSON.parse(logEntry.meta);
        if (!meta.events) meta.events = [];
        meta.events.push({
          event: eventType,
          timestamp,
          reason: reason || null
        });
        updates.meta = JSON.stringify(meta);
      } catch (parseError) {
        console.warn('[sg-webhook] Failed to parse existing meta, creating new');
        updates.meta = JSON.stringify({
          events: [{
            event: eventType,
            timestamp,
            reason: reason || null
          }]
        });
      }
    } else {
      updates.meta = JSON.stringify({
        events: [{
          event: eventType,
          timestamp,
          reason: reason || null
        }]
      });
    }

    // Only update if we have changes
    if (Object.keys(updates).length > 0) {
      await db.update(emailLogs)
        .set(updates)
        .where(whereClause);

      console.log(`[sg-webhook] Updated log entry for ${eventType}: ${sg_message_id || custom_args?.logId}`);
    }

  } catch (dbError) {
    console.error('[sg-webhook] Database update failed:', dbError);
    throw dbError;
  }
}

export default router;
