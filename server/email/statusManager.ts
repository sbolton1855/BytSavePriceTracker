
/**
 * Centralized Email Status Management
 * 
 * This module handles all email status transitions to ensure consistency
 * and prevent race conditions between direct sends and webhook updates.
 */

import { db } from '../db';
import { emailLogs } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export type EmailStatus = 
  | 'pending'    // Email logged but not yet sent
  | 'failed'     // Failed to send via SendGrid  
  | 'sent'       // Successfully sent to SendGrid
  | 'bounced'    // Email bounced (hard or soft)
  | 'delivered'  // Email delivered to recipient
  | 'opened'     // Recipient opened the email
  | 'clicked'    // Recipient clicked a link
  | 'spam_reported'; // Marked as spam

/**
 * Status priority for determining which status takes precedence
 * Higher number = higher priority (won't be overwritten by lower)
 */
export const STATUS_PRIORITY: Record<EmailStatus, number> = {
  'pending': 1,
  'failed': 2,
  'sent': 3,
  'bounced': 4,
  'delivered': 5,
  'spam_reported': 6,
  'opened': 7,
  'clicked': 8
};

/**
 * Update email status only if new status has higher priority
 */
export async function updateEmailStatus(
  logId: number,
  newStatus: EmailStatus,
  source: 'sendgrid' | 'webhook' = 'sendgrid'
): Promise<boolean> {
  try {
    // Get current status
    const currentLog = await db
      .select({ status: emailLogs.status })
      .from(emailLogs)
      .where(eq(emailLogs.id, logId))
      .limit(1);
    
    if (currentLog.length === 0) {
      console.log(`[StatusManager] Log ${logId} not found`);
      return false;
    }
    
    const currentStatus = currentLog[0].status as EmailStatus;
    const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
    const newPriority = STATUS_PRIORITY[newStatus] || 0;
    
    console.log(`[StatusManager] ${source}: ${currentStatus}(${currentPriority}) -> ${newStatus}(${newPriority}) for log ${logId}`);
    
    // Don't downgrade status
    if (newPriority <= currentPriority) {
      console.log(`[StatusManager] Keeping higher priority status: ${currentStatus}`);
      return false;
    }
    
    // Update status
    await db
      .update(emailLogs)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(emailLogs.id, logId));
    
    console.log(`[StatusManager] ✅ Updated status: ${currentStatus} -> ${newStatus} for log ${logId}`);
    return true;
    
  } catch (error) {
    console.error(`[StatusManager] Failed to update status for log ${logId}:`, error);
    return false;
  }
}

/**
 * Update email status by SendGrid message ID (for webhooks)
 */
export async function updateEmailStatusByMessageId(
  sgMessageId: string,
  newStatus: EmailStatus
): Promise<boolean> {
  try {
    // Find log by SendGrid message ID
    const logs = await db
      .select({ id: emailLogs.id, status: emailLogs.status })
      .from(emailLogs)
      .where(eq(emailLogs.sgMessageId, sgMessageId))
      .limit(1);
    
    if (logs.length === 0) {
      console.log(`[StatusManager] No log found for SendGrid message ${sgMessageId}`);
      return false;
    }
    
    return await updateEmailStatus(logs[0].id, newStatus, 'webhook');
    
  } catch (error) {
    console.error(`[StatusManager] Failed to update status for message ${sgMessageId}:`, error);
    return false;
  }
}
