/**
 * Email System: High-Level Email Service
 * - Entry point: Called by admin routes, price checkers, auth flows
 * - Output: Orchestrates template rendering + SendGrid sending + database logging
 * - Dependencies: SendGrid service, email templates, database, affiliate link utils
 * - Future: Add email preferences, unsubscribe handling, delivery webhooks
 */

import { sendEmail as sendGridEmail } from './email/sendgridService';
import { addAffiliateTag } from './utils/affiliateLinks';
import { db } from './db';
import { emailLogs } from '@shared/schema';
import type { Product, TrackedProduct } from '@shared/schema';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default affiliate tag
const AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || 'bytsave-20';

/**
 * Creates price drop alert email content
 * Builds HTML email with product details, pricing, affiliate links
 * Used when automated price checker detects a target price hit
 */
function createPriceDropEmail(
  to: string,
  product: Product,
  trackedProduct: TrackedProduct
): { to: string; subject: string; html: string } {
  const affiliateUrl = addAffiliateTag(product.url, AFFILIATE_TAG);
  const percentOff = product.originalPrice
    ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100)
    : 0;

  const emailContent = `
    <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <div style="color: #3B82F6; font-size: 24px; margin-right: 10px;">📉</div>
        <h2 style="color: #1F2937; margin: 0; font-size: 20px;">BytSave Price Alert</h2>
      </div>

      <p style="color: #4B5563; font-size: 16px; line-height: 24px; margin-bottom: 20px;">
        Good news! A product you're tracking has dropped in price ${trackedProduct.percentageAlert
          ? `by at least ${trackedProduct.percentageThreshold}%`
          : `below your target of $${trackedProduct.targetPrice.toFixed(2)}`}.
      </p>

      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: flex-start;">
          ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-right: 16px;">` : ''}
          <div>
            <h3 style="color: #1F2937; margin: 0 0 8px 0; font-size: 16px;">${product.title}</h3>
            <div style="margin-bottom: 4px;">
              <span style="color: #10B981; font-weight: bold; font-size: 18px;">$${product.currentPrice.toFixed(2)}</span>
              ${product.originalPrice ? `<span style="color: #9CA3AF; text-decoration: line-through; margin-left: 8px; font-size: 14px;">$${product.originalPrice.toFixed(2)}</span>` : ''}
              ${percentOff > 0 ? `<span style="color: #10B981; font-size: 12px; margin-left: 8px;">-${percentOff}%</span>` : ''}
            </div>
            <p style="color: #6B7280; margin: 4px 0; font-size: 14px;">
              Your target: $${trackedProduct.targetPrice.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${affiliateUrl}" style="display: inline-block; background-color: #3B82F6; color: white; font-weight: 500; padding: 8px 16px; border-radius: 4px; text-decoration: none;">
          Buy Now on Amazon
        </a>
      </div>

      <p style="color: #4B5563; font-size: 14px; line-height: 20px; margin: 20px 0; border-top: 1px solid #E5E7EB; padding-top: 20px;">
        You're receiving this alert because you set up a ${trackedProduct.percentageAlert
          ? `percentage-based alert for ${trackedProduct.percentageThreshold}% discount`
          : `price target of $${trackedProduct.targetPrice.toFixed(2)}`}
        for this product on ${new Date(trackedProduct.createdAt).toLocaleDateString()}.
      </p>

      <hr style="margin: 30px 0; border: 0; border-top: 1px solid #E5E7EB;">
      <p style="color: #999; font-size: 11px; text-align: center; font-style: italic; margin: 10px 0;">
        As an Amazon Associate, BytSave earns from qualifying purchases.
      </p>
      <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 10px;">
        This email was sent by BytSave. <a href="#" style="color: #3B82F6;">Unsubscribe</a> or <a href="#" style="color: #3B82F6;">Manage Preferences</a>
      </p>
    </div>
  `;

  return {
    to,
    subject: `Price Drop Alert: ${product.title} now $${product.currentPrice.toFixed(2)}`,
    html: emailContent
  };
}

/**
 * Sends price drop alert to user
 * Flow: Create email content → Send via SendGrid → Log to database
 * Called by automated price checker when target price is hit
 */
async function sendPriceDropAlert(
  to: string,
  product: Product,
  trackedProduct: TrackedProduct
): Promise<boolean> {
  try {
    // Step 1: Generate email content with affiliate links
    const emailData = createPriceDropEmail(to, product, trackedProduct);
    
    // Step 2: Send via SendGrid
    const result = await sendGridEmail(emailData.to, emailData.subject, emailData.html);

    if (result.success) {
      console.log(`Price drop alert sent to ${to} via SendGrid - Message ID: ${result.messageId}`);

      // Step 3: Log successful send to database for admin visibility
      try {
        console.log(`📝 Attempting to log price drop email to database for ${to}`);
        const logResult = await db.insert(emailLogs).values({
          recipientEmail: emailData.to,
          subject: emailData.subject,
          previewHtml: emailData.html,
          productId: product.id, // Add product ID reference
          sentAt: new Date(),
          createdAt: new Date()
        });
        console.log(`✅ Price drop alert logged to database for ${to}`, logResult);
      } catch (logError) {
        console.error('❌ Failed to log price drop alert to database:', logError);
        console.error('📄 Log error details:', {
          error: logError,
          recipient: emailData.to,
          subject: emailData.subject,
          productId: product.id
        });
      }

      return true;
    } else {
      console.error(`Failed to send price drop alert via SendGrid: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('Failed to send price drop alert email:', error);
    return false;
  }
}

/**
 * Generic email sending interface
 * Used by admin test emails, auth emails, and other one-off sends
 * Provides consistent logging and error handling
 */
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  templateId?: string; // Optional template tracking for analytics
}

async function sendEmail(options: EmailOptions): Promise<any> {
  try {
    // Send via SendGrid service
    const result = await sendGridEmail(options.to, options.subject, options.html);

    if (result.success) {
      console.log(`Email sent to ${options.to} via SendGrid - Message ID: ${result.messageId}`);

      // Log all emails to database for admin monitoring
      try {
        console.log(`📝 Attempting to log generic email to database for ${options.to}`);
        const logResult = await db.insert(emailLogs).values({
          recipientEmail: options.to,
          subject: options.subject,
          previewHtml: options.html,
          sentAt: new Date(),
          createdAt: new Date()
        });
        console.log(`✅ Generic email logged to database for ${options.to}`, logResult);
      } catch (logError) {
        console.error('❌ Failed to log email to database:', logError);
        console.error('📄 Email log error details:', {
          error: logError,
          recipient: options.to,
          subject: options.subject,
          templateId: options.templateId
        });
        // Don't fail the email send if logging fails
      }

      return { messageId: result.messageId };
    } else {
      throw new Error(result.error || 'SendGrid email failed');
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// Re-export the SendGrid sendEmail function for password resets and other generic emails
export { sendEmail as sendGridEmail } from './email/sendgridService';

/**
 * Sends password reset email using template system
 * Flow: Import templates → Render with data → Send via SendGrid → Log
 * Called by auth routes when user requests password reset
 */
async function sendPasswordResetEmail(
  to: string,
  firstName: string | null,
  resetUrl: string
): Promise<boolean> {
  try {
    // Dynamic import to avoid circular dependencies
    const { renderTemplate } = await import('./email/templates');
    
    // Render password-reset template with user data
    const emailContent = renderTemplate('password-reset', {
      firstName,
      resetUrl,
      expirationTime: '15 minutes'
    });

    if (!emailContent) {
      console.error('Password reset template not found');
      return false;
    }

    const result = await sendGridEmail(to, emailContent.subject, emailContent.html);

    if (result.success) {
      console.log(`Password reset email sent to ${to} via SendGrid - Message ID: ${result.messageId}`);

      // Log the email to database
      try {
        await db.insert(emailLogs).values({
          recipientEmail: to,
          subject: emailContent.subject,
          previewHtml: emailContent.html,
          sentAt: new Date(),
          createdAt: new Date()
        });
        console.log(`✅ Password reset email logged to database for ${to}`);
      } catch (logError) {
        console.error('❌ Failed to log password reset email to database:', logError);
        // Don't fail the email send if logging fails
      }

      return true;
    } else {
      console.error(`Failed to send password reset email via SendGrid: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

export {
  sendPriceDropAlert,
  sendEmail,
  createPriceDropEmail,
  sendPasswordResetEmail
};