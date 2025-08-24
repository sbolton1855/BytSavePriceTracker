import { Product, TrackedProduct } from '@shared/schema';
import { storage } from './storage';
import { emailService } from './email/service'; // Assumed replacement for sendPriceDropAlert
import nodemailer from 'nodemailer';

// This function checks if a product price meets the alert criteria
export function shouldTriggerAlert(
  product: Product,
  trackedProduct: TrackedProduct
): boolean {
  console.log(`🔍 QA: Checking alert criteria for tracked product ID ${trackedProduct.id}`);

  // If already notified, don't send again
  if (trackedProduct.notified) {
    console.log(`⏭️  QA: Skipping - already notified (notified=${trackedProduct.notified})`);
    return false;
  }

  // Get the target price based on alert type
  if (trackedProduct.percentageAlert && trackedProduct.percentageThreshold) {
    // Percentage-based alert
    const originalPrice = product.originalPrice || product.highestPrice || product.currentPrice;
    if (originalPrice <= 0) {
      console.log(`❌ QA: Invalid original price (${originalPrice}) - preventing division by zero`);
      return false; // Prevent division by zero
    }

    const discountPercentage = ((originalPrice - product.currentPrice) / originalPrice) * 100;
    const shouldAlert = discountPercentage >= (trackedProduct.percentageThreshold || 0);

    console.log(`📊 QA: Percentage Alert Check:`);
    console.log(`   - Original Price: $${originalPrice}`);
    console.log(`   - Current Price: $${product.currentPrice}`);
    console.log(`   - Discount: ${discountPercentage.toFixed(2)}%`);
    console.log(`   - Threshold: ${trackedProduct.percentageThreshold}%`);
    console.log(`   - Should Alert: ${shouldAlert}`);

    return shouldAlert;
  } else {
    // Fixed price alert
    const shouldAlert = product.currentPrice <= trackedProduct.targetPrice;

    console.log(`💰 QA: Fixed Price Alert Check:`);
    console.log(`   - Current Price: $${product.currentPrice}`);
    console.log(`   - Target Price: $${trackedProduct.targetPrice}`);
    console.log(`   - Price <= Target: ${shouldAlert}`);
    console.log(`   - Should Alert: ${shouldAlert}`);

    return shouldAlert;
  }
}

// This function processes price alerts
export async function processPriceAlerts(): Promise<number> {
  try {
    console.log(`🔔 QA: Starting price alerts processing...`);

    // Get tracked products that need to be checked for alerts
    const trackedProducts = await storage.getAllTrackedProductsWithDetails();
    let alertCount = 0;

    console.log(`🔍 QA: Found ${trackedProducts.length} tracked products to check for alerts`);

    for (let i = 0; i < trackedProducts.length; i++) {
      const trackedProduct = trackedProducts[i];

      try {
        console.log(`\n📋 QA: [${i + 1}/${trackedProducts.length}] Processing tracked product ID ${trackedProduct.id}`);
        console.log(`   📦 Product: ${trackedProduct.product.title}`);
        console.log(`   🔗 ASIN: ${trackedProduct.product.asin}`);
        console.log(`   💰 Current Price: $${trackedProduct.product.currentPrice}`);
        console.log(`   🎯 Target Price: $${trackedProduct.targetPrice}`);
        console.log(`   📧 Email: ${trackedProduct.email}`);
        console.log(`   🔔 Already Notified: ${trackedProduct.notified}`);

        const shouldAlert = shouldTriggerAlert(trackedProduct.product, trackedProduct);

        // Check if this tracked product requires an alert
        if (shouldAlert) {
          console.log(`🚨 QA: ALERT TRIGGERED! Preparing to send email alert`);
          console.log(`   📧 Recipient: ${trackedProduct.email}`);
          console.log(`   📦 Product: ${trackedProduct.product.title} (${trackedProduct.product.asin})`);

          // Send the notification using centralized service
          console.log('[email-send]', {
            to: trackedProduct.email,
            templateId: 'price-drop',
            isTest: false,
            path: 'daily'
          });

          const result = await emailService.sendTemplate({
            to: trackedProduct.email,
            templateId: 'price-drop',
            data: {
              productTitle: trackedProduct.product.title,
              oldPrice: trackedProduct.targetPrice.toString(),
              newPrice: trackedProduct.product.currentPrice.toString(),
              productUrl: trackedProduct.product.url,
              imageUrl: trackedProduct.product.imageUrl,
              asin: trackedProduct.product.asin
            },
            isTest: false,
            meta: {
              path: 'daily',
              userProductId: trackedProduct.id,
              productId: trackedProduct.product.id
            }
          });

          const emailSent = result.success;

          if (emailSent) {
            console.log(`✅ QA: EMAIL SENT SUCCESSFULLY!`);
            console.log(`   📧 To: ${trackedProduct.email}`);
            console.log(`   📦 Product: ${trackedProduct.product.title}`);

            // Mark as notified to prevent duplicate emails
            console.log(`🔄 QA: Updating notified flag to true...`);
            await storage.updateTrackedProduct(trackedProduct.id, { notified: true });
            console.log(`✅ QA: Notified flag updated successfully`);

            alertCount++;
          } else {
            console.error(`❌ QA: EMAIL SEND FAILED!`);
            console.error(`   📧 Failed recipient: ${trackedProduct.email}`);
            console.error(`   📦 Product: ${trackedProduct.product.title}`);
          }
        } else {
          console.log(`⏭️  QA: No alert needed - conditions not met`);
        }
      } catch (error) {
        console.error(`❌ QA: Error processing tracked product ${trackedProduct.id}:`, error);
        console.error(`   📦 Product: ${trackedProduct.product?.title || 'Unknown'}`);
        console.error(`   📧 Email: ${trackedProduct.email}`);
      }
    }

    console.log(`\n📊 QA: Processing complete!`);
    console.log(`   ✅ Alerts sent: ${alertCount}`);
    console.log(`   📋 Total products checked: ${trackedProducts.length}`);
    console.log(`   📈 Success rate: ${trackedProducts.length > 0 ? ((alertCount / trackedProducts.length) * 100).toFixed(1) : 0}%`);

    return alertCount;
  } catch (error) {
    console.error('❌ QA: CRITICAL ERROR in processPriceAlerts:', error);
    return 0;
  }
}