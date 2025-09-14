
<old_str>import { Product, TrackedProduct } from '@shared/schema';
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

    console.log(`🔍 Found ${trackedProducts.length} tracked products to check for alerts`);

    for (const trackedProduct of trackedProducts) {
      try {
        const shouldAlert = shouldTriggerAlert(trackedProduct.product, trackedProduct);
        
        console.log(`📋 Checking product ${trackedProduct.product.asin}:`);
        console.log(`   Title: ${trackedProduct.product.title}`);
        console.log(`   Current Price: $${trackedProduct.product.currentPrice}`);
        console.log(`   Target Price: $${trackedProduct.targetPrice}`);
        console.log(`   Already Notified: ${trackedProduct.notified}`);
        console.log(`   Should Alert: ${shouldAlert}`);

        // Check if this tracked product requires an alert
        if (shouldAlert) {
          console.log(`🚨 Preparing to send alert for product ${trackedProduct.product.asin} to ${trackedProduct.email}`);

          // Send the notification
          const success = await sendPriceDropAlert(
            trackedProduct.email,
            trackedProduct.product,
            trackedProduct
          );

          if (success) {
            console.log(`✅ Successfully sent price drop alert to ${trackedProduct.email} for ${trackedProduct.product.title}`);
            // Mark as notified to prevent duplicate emails
            await storage.updateTrackedProduct(trackedProduct.id, { notified: true });
            alertCount++;
          } else {
            console.error(`❌ Failed to send price drop alert to ${trackedProduct.email}`);
          }
        } else {
          console.log(`⏭️  No alert needed for product ${trackedProduct.product.asin}`);
        }
      } catch (error) {
        console.error(`❌ Error processing alert for product ${trackedProduct.productId}:`, error);
      }
    }

    console.log(`📊 Processing complete: ${alertCount} alerts sent out of ${trackedProducts.length} tracked products`);
    return alertCount;
  } catch (error) {
    console.error('❌ Error processing price alerts:', error);
    return 0;
  }
}</old_str>
<new_str>import { Product, TrackedProduct } from '@shared/schema';
import { storage } from './storage';
import { sendPriceDropAlert } from './emailService';
import nodemailer from 'nodemailer';

// This function checks if a product price meets the alert criteria
export function shouldTriggerAlert(
  product: Product, 
  trackedProduct: TrackedProduct
): boolean {
  console.log(`🔍 QA: Checking alert criteria for tracked product ID ${trackedProduct.id}`);
  
  // Check if cooldown is still active
  if (trackedProduct.lastAlertSent) {
    const cooldownHours = trackedProduct.cooldownHours || 48;
    const lastAlertTime = new Date(trackedProduct.lastAlertSent);
    const currentTime = new Date();
    const hoursSinceLastAlert = (currentTime.getTime() - lastAlertTime.getTime()) / (1000 * 60 * 60);
    
    console.log(`⏰ QA: Cooldown Check:`);
    console.log(`   - Last Alert: ${lastAlertTime.toISOString()}`);
    console.log(`   - Current Time: ${currentTime.toISOString()}`);
    console.log(`   - Hours Since Last Alert: ${hoursSinceLastAlert.toFixed(2)}`);
    console.log(`   - Cooldown Period: ${cooldownHours} hours`);
    
    if (hoursSinceLastAlert < cooldownHours) {
      // Check if price has rebounded significantly (>5% above last notified price)
      if (trackedProduct.lastNotifiedPrice) {
        const reboundThreshold = trackedProduct.lastNotifiedPrice * 1.05; // 5% above last alert price
        const hasRebounded = product.currentPrice > reboundThreshold;
        
        console.log(`📈 QA: Rebound Check:`);
        console.log(`   - Last Notified Price: $${trackedProduct.lastNotifiedPrice}`);
        console.log(`   - Rebound Threshold (5%): $${reboundThreshold.toFixed(2)}`);
        console.log(`   - Current Price: $${product.currentPrice}`);
        console.log(`   - Has Rebounded: ${hasRebounded}`);
        
        if (hasRebounded) {
          console.log(`🔄 QA: Price rebounded >5% - cooldown reset allowed`);
          return false; // Will reset cooldown in processPriceAlerts if price conditions are met
        }
      }
      
      console.log(`⏭️  QA: Skipping - still in cooldown (${(cooldownHours - hoursSinceLastAlert).toFixed(1)} hours remaining)`);
      return false;
    } else {
      console.log(`✅ QA: Cooldown expired - proceeding with alert check`);
    }
  } else {
    console.log(`🆕 QA: No previous alert sent - proceeding with alert check`);
  }
  
  // Legacy notified flag check (keeping for backward compatibility)
  if (trackedProduct.notified && !trackedProduct.lastAlertSent) {
    console.log(`⏭️  QA: Skipping - legacy notified flag set (no timestamp)`);
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
        
        // Check for price rebound reset first
        if (trackedProduct.lastAlertSent && trackedProduct.lastNotifiedPrice) {
          const reboundThreshold = trackedProduct.lastNotifiedPrice * 1.05; // 5% above last alert price
          const hasRebounded = trackedProduct.product.currentPrice > reboundThreshold;
          
          if (hasRebounded) {
            console.log(`🔄 QA: Price rebounded >5% above last alert price - resetting cooldown`);
            console.log(`   - Last Alert Price: $${trackedProduct.lastNotifiedPrice}`);
            console.log(`   - Current Price: $${trackedProduct.product.currentPrice}`);
            console.log(`   - Rebound Threshold: $${reboundThreshold.toFixed(2)}`);
            
            // Reset cooldown flags
            await storage.updateTrackedProduct(trackedProduct.id, { 
              notified: false,
              lastAlertSent: null,
              lastNotifiedPrice: null
            });
            console.log(`✅ QA: Cooldown reset completed`);
            continue; // Skip to next product - will be eligible next cycle
          }
        }

        const shouldAlert = shouldTriggerAlert(trackedProduct.product, trackedProduct);

        // Check if this tracked product requires an alert
        if (shouldAlert) {
          console.log(`🚨 QA: ALERT TRIGGERED! Preparing to send email alert`);
          console.log(`   📧 Recipient: ${trackedProduct.email}`);
          console.log(`   📦 Product: ${trackedProduct.product.title} (${trackedProduct.product.asin})`);

          // Send the notification
          console.log(`📤 QA: Calling sendPriceDropAlert...`);
          const success = await sendPriceDropAlert(
            trackedProduct.email,
            trackedProduct.product,
            trackedProduct
          );

          if (success) {
            console.log(`✅ QA: EMAIL SENT SUCCESSFULLY!`);
            console.log(`   📧 To: ${trackedProduct.email}`);
            console.log(`   📦 Product: ${trackedProduct.product.title}`);
            
            // Update cooldown tracking
            const currentTime = new Date();
            console.log(`🔄 QA: Updating cooldown tracking...`);
            await storage.updateTrackedProduct(trackedProduct.id, { 
              notified: true,
              lastAlertSent: currentTime,
              lastNotifiedPrice: trackedProduct.product.currentPrice
            });
            console.log(`✅ QA: Cooldown tracking updated successfully`);
            console.log(`   - Alert Sent At: ${currentTime.toISOString()}`);
            console.log(`   - Price When Alerted: $${trackedProduct.product.currentPrice}`);
            console.log(`   - Next Alert Available After: ${new Date(currentTime.getTime() + (trackedProduct.cooldownHours || 48) * 60 * 60 * 1000).toISOString()}`);
            
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
}</old_str>
