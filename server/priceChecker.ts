import { storage } from './storage';
import { sendPriceDropAlert } from './emailService';
import { getProductInfo } from './amazonApi';
import type { Product } from '@shared/schema';

// Interval for checking prices (in ms)
// 4 hours in production, shorter for development
const CHECK_INTERVAL = process.env.NODE_ENV === 'production' 
  ? 4 * 60 * 60 * 1000 
  : 5 * 60 * 1000; // 5 minutes for dev

// Function to update a product's price
async function updateProductPrice(product: Product): Promise<Product | undefined> {
  try {
    // Fetch latest product info from Amazon API
    const latestInfo = await getProductInfo(product.asin);
    
    // Prepare price history entry
    const priceHistoryEntry = {
      productId: product.id,
      price: latestInfo.price,
      timestamp: new Date()
    };
    
    // Store price in history
    await storage.createPriceHistory(priceHistoryEntry);
    
    // Update product data
    const updatedProduct = await storage.updateProduct(product.id, {
      currentPrice: latestInfo.price,
      originalPrice: latestInfo.originalPrice || product.originalPrice,
      lastChecked: new Date(),
      lowestPrice: product.lowestPrice ? Math.min(product.lowestPrice, latestInfo.price) : latestInfo.price,
      highestPrice: product.highestPrice ? Math.max(product.highestPrice, latestInfo.price) : latestInfo.price
    });
    
    return updatedProduct;
  } catch (error) {
    console.error(`Failed to update price for product ${product.asin}:`, error);
    return undefined;
  }
}

// Function to check prices and send notifications
async function checkPricesAndNotify(): Promise<void> {
  try {
    console.log('Starting price check routine...');
    
    // Get all products
    const products = await storage.getAllProducts();
    
    // Update prices for all products
    for (const product of products) {
      await updateProductPrice(product);
    }
    
    // Find tracked products that need alerts
    const needAlerts = await storage.getTrackedProductsNeedingAlerts();
    
    console.log(`Found ${needAlerts.length} products requiring price drop alerts`);
    
    // Send notifications for each
    for (const trackedProduct of needAlerts) {
      const success = await sendPriceDropAlert(
        trackedProduct.email,
        trackedProduct.product,
        trackedProduct
      );
      
      if (success) {
        // Mark as notified
        await storage.updateTrackedProduct(trackedProduct.id, { notified: true });
      }
    }
    
    console.log('Price check routine completed');
  } catch (error) {
    console.error('Error in price check routine:', error);
  }
}

// Start the price checker
function startPriceChecker(): NodeJS.Timeout {
  console.log(`Starting price checker (interval: ${CHECK_INTERVAL / 60000} minutes)`);
  
  // Run immediately on startup
  checkPricesAndNotify();
  
  // Then schedule recurring checks
  return setInterval(checkPricesAndNotify, CHECK_INTERVAL);
}

export {
  updateProductPrice,
  checkPricesAndNotify,
  startPriceChecker
};
