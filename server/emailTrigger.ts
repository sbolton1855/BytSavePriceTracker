import { Product, TrackedProduct } from '@shared/schema';
import { storage } from './storage';
import { sendPriceDropAlert } from './emailService';
import nodemailer from 'nodemailer';

// This function checks if a product price meets the alert criteria
export function shouldTriggerAlert(
  product: Product, 
  trackedProduct: TrackedProduct
): boolean {
  // If already notified, don't send again
  if (trackedProduct.notified) {
    return false;
  }

  // Get the target price based on alert type
  if (trackedProduct.percentageAlert && trackedProduct.percentageThreshold) {
    // Percentage-based alert
    const originalPrice = product.originalPrice || product.highestPrice || product.currentPrice;
    if (originalPrice <= 0) return false; // Prevent division by zero

    const discountPercentage = ((originalPrice - product.currentPrice) / originalPrice) * 100;

    return discountPercentage >= (trackedProduct.percentageThreshold || 0);
  } else {
    // Fixed price alert
    return product.currentPrice <= trackedProduct.targetPrice;
  }
}

// This function processes price alerts
export async function processPriceAlerts(): Promise<number> {
  try {
    // Get tracked products that need to be checked for alerts
    const trackedProducts = await storage.getAllTrackedProductsWithDetails();
    let alertCount = 0;

    for (const trackedProduct of trackedProducts) {
      try {
        // Check if this tracked product requires an alert
        if (shouldTriggerAlert(trackedProduct.product, trackedProduct)) {
          console.log(`Preparing to send alert for product ${trackedProduct.product.asin}`);

          // Send the notification
          const success = await sendPriceDropAlert(
            trackedProduct.email,
            trackedProduct.product,
            trackedProduct
          );

          if (success) {
            console.log(`Successfully sent price drop alert to ${trackedProduct.email} for ${trackedProduct.product.title}`);
            // Mark as notified to prevent duplicate emails
            await storage.updateTrackedProduct(trackedProduct.id, { notified: true });
            alertCount++;
          } else {
            console.error(`Failed to send price drop alert to ${trackedProduct.email}`);
          }
        }
      } catch (error) {
        console.error(`Error processing alert for product ${trackedProduct.productId}:`, error);
      }
    }

    return alertCount;
  } catch (error) {
    console.error('Error processing price alerts:', error);
    return 0;
  }
}

// Utility function to reset notification flags when prices go back up
export async function resetNotificationsForPriceIncreases(): Promise<number> {
  let resetCount = 0;

  try {
    const trackedProducts = await storage.getAllTrackedProductsWithDetails();

    for (const trackedProduct of trackedProducts) {
      // If already notified, check if the price is now above the threshold again
      if (trackedProduct.notified) {
        const shouldReset = !shouldTriggerAlert(trackedProduct.product, trackedProduct);

        if (shouldReset) {
          await storage.updateTrackedProduct(trackedProduct.id, { notified: false });
          resetCount++;
        }
      }
    }
  } catch (error) {
    console.error('Error resetting notification flags:', error);
  }

  return resetCount;
}

// This function can be called to manually test the email functionality
export async function testEmailNotification(email: string): Promise<boolean> {
  try {
    const { sendEmail } = await import('./email/sendgridService');

    const result = await sendEmail(
      email,
      'BytSave Email System Test',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a56e2;">BytSave Email System Test</h2>
          <p>This is a test email to verify that your BytSave price alert notification system is correctly configured.</p>
          <p>If you're receiving this email, it means your email alert system is working properly!</p>
          <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
            <p style="margin: 0; color: #666;">This is a system test email, no action is required.</p>
          </div>
        </div>
      `
    );

    if (result.success) {
      console.log('Test email sent via SendGrid:', result.messageId);
      return true;
    } else {
      console.error('Failed to send test email via SendGrid:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Failed to send test email:', error);
    return false;
  }
}