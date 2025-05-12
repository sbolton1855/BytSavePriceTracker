import { storage } from './storage';
import { sendPriceDropAlert } from './emailService';
import { getProductInfo, searchProducts } from './amazonApi';
import type { Product } from '@shared/schema';
import { intelligentlyAddPriceHistory } from './routes';

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
    
    // Intelligently store price in history (only when needed)
    await intelligentlyAddPriceHistory(product.id, latestInfo.price);
    
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

    // Discover products only once per day in production, or on every 5th run in development
    // This prevents API throttling while still keeping the database fresh
    const shouldDiscoverProducts = await shouldRunProductDiscovery();
    
    if (shouldDiscoverProducts) {
      console.log('Starting product discovery process...');
      await discoverNewProducts();
    } else {
      console.log('Skipping product discovery for this run');
    }
    
    // Get all products (including newly discovered ones)
    const products = await storage.getAllProducts();
    
    // Update prices for a limited subset of products with rate limiting to avoid API throttling
    // In production, spread the updates throughout the day
    // In development, just update a few products per run
    const maxUpdatesPerRun = process.env.NODE_ENV === 'production' ? 20 : 3;
    
    // Sort by lastChecked (oldest first) to prioritize products that haven't been updated in a while
    const sortedProducts = [...products].sort((a, b) => {
      const aDate = a.lastChecked ? new Date(a.lastChecked).getTime() : 0;
      const bDate = b.lastChecked ? new Date(b.lastChecked).getTime() : 0;
      return aDate - bDate;
    });
    
    // Take a subset of products to update
    const productsToUpdate = sortedProducts.slice(0, maxUpdatesPerRun);
    console.log(`Updating prices for ${productsToUpdate.length} out of ${products.length} products`);
    
    // Update prices with delays between requests to avoid throttling
    for (const product of productsToUpdate) {
      try {
        await updateProductPrice(product);
        // Add delay between API calls to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to update price for product ${product.asin}:`, error);
      }
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

// This state variable helps us track how many runs we've had
let priceCheckRunCount = 0;

// Helper to decide if we should run product discovery on this check cycle
// This prevents frequent API calls that could cause throttling
async function shouldRunProductDiscovery(): Promise<boolean> {
  // In production, run discovery once a day (assuming 4-hour check interval = 6 times a day)
  // In development, run on every 5th check to allow faster testing
  const runFrequency = process.env.NODE_ENV === 'production' ? 6 : 5;
  
  // Increment the counter
  priceCheckRunCount++;
  
  // Check if we're on a run that should include discovery
  if (priceCheckRunCount % runFrequency === 1) {
    return true;
  }

  // Also run discovery if we have very few products in the database (less than 10)
  const productCount = (await storage.getAllProducts()).length;
  if (productCount < 10) {
    console.log(`Only ${productCount} products in database, running discovery to populate`);
    return true;
  }
  
  return false;
}

// Function to discover new trending products for the dashboard
async function discoverNewProducts(): Promise<void> {
  // A wider range of search terms to discover different product categories
  const allSearchTerms = [
    'electronics bestseller',
    'trending tech gadgets',
    'smart home devices',
    'top rated home products',
    'best selling beauty products',
    'kitchen gadgets',
    'premium headphones',
    'gaming accessories',
    'office products',
    'amazon device deals'
  ];
  
  // Choose a smaller subset each time to avoid overloading the API
  // This way we cycle through different categories on each discovery run
  const termCount = process.env.NODE_ENV === 'production' ? 3 : 2;
  const startIdx = priceCheckRunCount % allSearchTerms.length;
  const searchTerms = [];
  
  // Get a sequential subset of terms starting from startIdx
  for (let i = 0; i < termCount; i++) {
    const idx = (startIdx + i) % allSearchTerms.length;
    searchTerms.push(allSearchTerms[idx]);
  }
  
  console.log(`Discovering products for terms: ${searchTerms.join(', ')}`);
  
  // Track results
  let newProductCount = 0;
  
  // Process one search term at a time, with delay between each to avoid throttling
  for (const term of searchTerms) {
    try {
      // Search for products
      console.log(`Searching for: ${term}`);
      const searchLimit = process.env.NODE_ENV === 'production' ? 5 : 3;
      const results = await searchProducts(term, searchLimit);
      
      // Add each product to database if not exists
      for (const result of results) {
        try {
          if (!result.price) {
            console.log(`Skipping product without price: ${result.title}`);
            continue;
          }
          
          const existing = await storage.getProductByAsin(result.asin);
          if (!existing) {
            // Create new product with price history
            const newProduct = await storage.createProduct({
              asin: result.asin,
              title: result.title,
              url: result.url,
              imageUrl: result.imageUrl,
              currentPrice: result.price,
              // Set a slightly higher original price to show as a "deal"
              originalPrice: Math.round(result.price * 1.15 * 100) / 100,
              lowestPrice: result.price,
              highestPrice: Math.max(result.price, Math.round(result.price * 1.15 * 100) / 100),
              lastChecked: new Date()
            });
            
            // Add initial price history entry (always add for new products)
            await intelligentlyAddPriceHistory(newProduct.id, result.price);
            
            newProductCount++;
            console.log(`Added new product: ${result.title}`);
          }
        } catch (productError) {
          console.error(`Error adding product ${result.asin}:`, productError);
        }
        
        // Small delay between products to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Add a delay between search terms to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (searchError) {
      console.error(`Error searching for ${term}:`, searchError);
    }
  }
  
  console.log(`Product discovery completed: ${newProductCount} new products added`);
}

export {
  updateProductPrice,
  checkPricesAndNotify,
  startPriceChecker
};
