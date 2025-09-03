import { storage } from "./storage";
import { sendPriceDropAlert } from "./emailService";
import { getProductInfoSafe, searchProducts } from "./amazonApi";
import type { Product } from "@shared/schema";
import { intelligentlyAddPriceHistory } from "./routes";

// Interval for checking prices (in ms)
// 1 hour in production, shorter for development
const CHECK_INTERVAL = 1 * 60 * 60 * 1000; // Check every hour

// Track API failures to prevent spamming
let consecutiveApiFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

// Track individual product failure counts
const productFailureCounts = new Map<string, number>();

import { isValidPrice } from "../shared/utils";

// Function to increment failure count for a specific ASIN
async function incrementProductFailureCount(asin: string): Promise<void> {
  const currentCount = productFailureCounts.get(asin) || 0;
  productFailureCounts.set(asin, currentCount + 1);
}

// Function to get failure count for a specific ASIN
async function getProductFailureCount(asin: string): Promise<number> {
  return productFailureCounts.get(asin) || 0;
}

// Function to reset failure count for a specific ASIN
async function resetProductFailureCount(asin: string): Promise<void> {
  productFailureCounts.delete(asin);
}

// Function to update a product's price
async function updateProductPrice(
  product: Product,
): Promise<Product | undefined> {
  try {
    // Skip if we've had too many consecutive failures
    if (consecutiveApiFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(
        `Skipping price update for ${product.asin} - API appears to be down`,
      );
      return await storage.updateProduct(product.id, {
        lastChecked: new Date(),
      });
    }

    // Fetch latest product info from Amazon API
    const latestInfo = await getProductInfoSafe(product.asin);
    
    // Debug logging for TRUEplus product
    if (product.asin === 'B01DJGLYZQ') {
      console.log(`DEBUG: TRUEplus price update - Product ASIN: ${product.asin}`);
      console.log(`DEBUG: TRUEplus price update - Current stored price: $${product.currentPrice}`);
      console.log(`DEBUG: TRUEplus price update - API returned:`, latestInfo);
    }

    // If no valid data returned, increment failure count and skip
    if (!latestInfo) {
      consecutiveApiFailures++;
      await incrementProductFailureCount(product.asin);
      const failureCount = await getProductFailureCount(product.asin);
      
      console.warn(
        `Error: No product data returned for ASIN ${product.asin}. (API failure ${consecutiveApiFailures}/${MAX_CONSECUTIVE_FAILURES}, product failure ${failureCount}/5)`,
      );
      
      // If we've had many failures for this specific product, add a longer delay
      let nextCheckDelay = 0;
      if (failureCount >= 3) {
        // Add exponential backoff: 1 hour, 4 hours, 24 hours
        const backoffHours = Math.min(Math.pow(4, failureCount - 3), 24);
        nextCheckDelay = backoffHours * 60 * 60 * 1000;
        console.log(`⏰ Adding ${backoffHours}h delay for repeatedly failing ASIN ${product.asin}`);
      }
      
      return await storage.updateProduct(product.id, {
        lastChecked: new Date(Date.now() + nextCheckDelay),
      });
    }

    // Log the API response before validation
    console.log(`[DEBUG] Amazon API returned for ${product.asin} - currentPrice: ${latestInfo.price}, originalPrice: ${latestInfo.originalPrice}`);
    
    // Validate the received price - but be more permissive with valid price ranges
    if (!isValidPrice(latestInfo.price)) {
      await incrementProductFailureCount(product.asin);
      const failureCount = await getProductFailureCount(product.asin);
      
      // Determine the specific issue for better logging
      let issueType = 'UNKNOWN_PRICE_ISSUE';
      let issueDescription = `Invalid price data (price=${latestInfo.price})`;
      
      if (latestInfo.price === 0) {
        issueType = 'PRICE_ZERO';
        issueDescription = 'Amazon returned price=0';
      } else if (latestInfo.price === undefined || latestInfo.price === null) {
        issueType = 'PRICE_MISSING';
        issueDescription = 'Amazon returned no price data';
      } else if (isNaN(latestInfo.price)) {
        issueType = 'PRICE_NAN';
        issueDescription = `Amazon returned non-numeric price: ${latestInfo.price}`;
      }
      
      console.warn(
        `Warning: ASIN ${product.asin} - ${issueDescription}. Skipping update (failure ${failureCount}/5).`,
      );
      
      // Check if this product has failed too many times
      if (failureCount >= 5) {
        console.warn(
          `⚠️ ASIN ${product.asin} has failed ${failureCount} consecutive times. Marking for review.`,
        );
        
        // Mark product as problematic but don't delete it yet
        return await storage.updateProduct(product.id, {
          lastChecked: new Date(),
        });
      }
      
      // Update lastChecked timestamp to prevent immediate retry
      return await storage.updateProduct(product.id, {
        lastChecked: new Date(),
      });
    }
    
    console.log(`[DEBUG] No override applied for ${product.asin}, saving currentPrice: ${latestInfo.price}`);
    console.log(`[DEBUG] Stored price BEFORE update: ${product.currentPrice}, API price: ${latestInfo.price}`);

    // Reset failure counter on successful price fetch
    consecutiveApiFailures = 0;
    await resetProductFailureCount(product.asin);

    // Only store valid prices in history
    if (
      typeof latestInfo.price === "number" &&
      !isNaN(latestInfo.price) &&
      latestInfo.price > 0
    ) {
      // Calculate the real original price with improved logic
      let realOriginalPrice = latestInfo.originalPrice;

      // If Amazon provides an original price, use it
      if (
        latestInfo.originalPrice &&
        latestInfo.originalPrice > latestInfo.price
      ) {
       // console.log(
         // `Using Amazon-provided original price for ${product.asin}: $${latestInfo.originalPrice}`,
       // );
        realOriginalPrice = latestInfo.originalPrice;
      }
      // If no original price provided but we have a current original price that's higher
      else if (
        product.originalPrice &&
        product.originalPrice > latestInfo.price
      ) {
        // console.log(
        //   `Using existing original price for ${product.asin}: $${product.originalPrice}`,
        // );
        realOriginalPrice = product.originalPrice;
      }
      // If we have a higher price in history
      else if (
        product.highestPrice &&
        product.highestPrice > latestInfo.price
      ) {
      //  console.log(
      //    `Using highest historical price for ${product.asin}: $${product.highestPrice}`,
       // );
        realOriginalPrice = product.highestPrice;
      }
      // If still no original price, estimate it conservatively
      else {
        realOriginalPrice = Math.max(
          latestInfo.price * 1.15, // 15% markup
          product.originalPrice || 0,
          product.highestPrice || 0,
        );
      //  console.log(
        //  `Estimated original price for ${product.asin}: $${realOriginalPrice}`,
        //);
      }

      // Check if price has actually changed (use small threshold for floating point comparison)
      const priceChanged =
        Math.abs(product.currentPrice - latestInfo.price) > 0.01;
      const priceDropped = latestInfo.price < product.currentPrice;

      if (priceChanged) {
     //   console.log(
       //   `Price change detected for ${product.asin}: $${product.currentPrice} -> $${latestInfo.price} (${priceDropped ? "dropped" : "increased"})`,
     //   );
      } else {
      //  console.log(`No significant price change for ${product.asin}`);
      }

      // Update price history with detailed metadata
      const historyAdded = await intelligentlyAddPriceHistory(
        product.id,
        latestInfo.price,
      );
   //   console.log(
     //   `Price history ${historyAdded ? "updated" : "unchanged"} for ${product.asin}`,
     // );

      // Debug: Log current time vs last checked
      const now = new Date();
      const lastChecked = new Date(product.lastChecked);
      const hoursSinceLastCheck =
        (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
      //console.log(
     //   `DEBUG: Product ${product.asin} - Hours since last check: ${hoursSinceLastCheck.toFixed(2)}, Should force history: ${hoursSinceLastCheck > 6}`,
    //  );

      // Calculate new lowest and highest prices
      const newLowestPrice = product.lowestPrice
        ? Math.min(product.lowestPrice, latestInfo.price)
        : latestInfo.price;

      const newHighestPrice = Math.max(
        product.highestPrice || 0,
        realOriginalPrice,
        latestInfo.price,
      );

      // Update product data with improved price tracking
      const updatedProduct = await storage.updateProduct(product.id, {
        currentPrice: latestInfo.price,
        originalPrice: realOriginalPrice,
        lastChecked: new Date(),
        lowestPrice: newLowestPrice,
        highestPrice: newHighestPrice,
        priceDropped: priceDropped, // Add flag to indicate if price dropped
      });
      
      console.log(`[DEBUG] Database updated for ${product.asin} - Final stored currentPrice: ${latestInfo.price}, originalPrice: ${realOriginalPrice}`);

      // console.log(`Successfully updated price for ${product.asin}:`, {
      //   oldPrice: product.currentPrice,
      //   newPrice: latestInfo.price,
      //   oldOriginal: product.originalPrice,
      //   newOriginal: realOriginalPrice,
      //   lowestPrice: newLowestPrice,
      //   highestPrice: newHighestPrice,
      //   priceChanged,
      //   priceDropped,
      //   historyAdded,
      // });

      return updatedProduct;
    } else {
      console.warn(`Invalid price received for ${product.asin}:`, latestInfo);
      throw new Error(
        `Invalid price data received: ${JSON.stringify(latestInfo)}`,
      );
    }
  } catch (error) {
    // Increment failure count for tracking
    await incrementProductFailureCount(product.asin);
    const failureCount = await getProductFailureCount(product.asin);
    
    // Categorize the error type for better logging
    let errorType = 'UNKNOWN_ERROR';
    let errorDescription = 'Unknown error occurred';
    
    if (error instanceof Error) {
      if (error.message.includes('No product data found')) {
        errorType = 'ASIN_NOT_FOUND';
        errorDescription = 'Product not found on Amazon';
      } else if (error.message.includes('Network') || error.message.includes('timeout')) {
        errorType = 'NETWORK_ERROR';
        errorDescription = 'Network or timeout error';
      } else if (error.message.includes('API request quota exceeded')) {
        errorType = 'API_QUOTA_EXCEEDED';
        errorDescription = 'Amazon API quota exceeded';
      } else {
        errorDescription = error.message;
      }
    }
    
    console.error(`❌ Failed to update price for ASIN ${product.asin} (${errorType}): ${errorDescription} (failure ${failureCount}/5)`);

    // Log detailed error info in development
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      console.error(`Error details for ${product.asin}:`, {
        message: error.message,
        name: error.name,
        type: errorType,
      });
    }

    // Check for consecutive failures
    if (failureCount >= 5) {
      console.warn(`🔴 ASIN ${product.asin} has failed ${failureCount} consecutive times. Consider manual review.`);
    }

    // Even when API fails, update the lastChecked timestamp to prevent immediate retry
    const updatedProduct = await storage.updateProduct(product.id, {
      lastChecked: new Date(),
    });

    return updatedProduct;
  }
}

// Function to check prices and send notifications
async function checkPricesAndNotify(): Promise<void> {
  try {
    // console.log("Starting price check routine...");

    // Clean up stale products first
    await removeStaleProducts();
    
    // Clean up products that have consistently failed
    await cleanupFailedProducts();

    // Get all active products (excluding stale ones)
    const products = await storage.getAllProducts();

    // Sort by lastChecked (oldest first) to prioritize products that haven't been updated
    const sortedProducts = [...products].sort((a, b) => {
      const aDate = a.lastChecked ? new Date(a.lastChecked).getTime() : 0;
      const bDate = b.lastChecked ? new Date(b.lastChecked).getTime() : 0;
      return aDate - bDate;
    });

    // Update all products with delays between requests to avoid throttling
    // console.log(`Updating prices for all ${sortedProducts.length} products`);

    // Update prices with delays between requests to avoid throttling
    for (const product of sortedProducts) {
      try {
        const updated = await updateProductPrice(product);
        if (updated) {
          // console.log(`Successfully updated price for ${product.asin}`);
        } else {
          console.warn(
            `Skipped price update for ${product.asin} - no data returned`,
          );
        }
        // Increased delay between API calls to reduce throttling
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(
          `Failed to update price for product ${product.asin}:`,
          error,
        );
        // Skip remaining retries for this product if we hit API limits
        if (
          error instanceof Error &&
          error.message?.includes("API request quota exceeded")
        ) {
          console.warn("API quota exceeded, pausing price updates");
          break;
        }
      }
    }

    // Process notifications for products that dropped below target price
    const needAlerts = await storage.getTrackedProductsNeedingAlerts();

    // console.log(
    //   `Found ${needAlerts.length} products requiring price drop alerts`,
    // );

    // Send notifications for each
    for (const trackedProduct of needAlerts) {
      const success = await sendPriceDropAlert(
        trackedProduct.email,
        trackedProduct.product,
        trackedProduct,
      );

      if (success) {
        // Mark as notified
        await storage.updateTrackedProduct(trackedProduct.id, {
          notified: true,
        });
      }
    }

    // console.log("Price check routine completed");
  } catch (error) {
    console.error("Error in price check routine:", error);
  }
}

// Start the price checker
function startPriceChecker(): NodeJS.Timeout {
  // console.log(`Starting price checker (interval: ${CHECK_INTERVAL / 60000} minutes)`);

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
  const runFrequency = process.env.NODE_ENV === "production" ? 6 : 5;

  // Increment the counter
  priceCheckRunCount++;

  // Check if we're on a run that should include discovery
  if (priceCheckRunCount % runFrequency === 1) {
    return true;
  }

  // Also run discovery if we have very few products in the database (less than 10)
  const productCount = (await storage.getAllProducts()).length;
  if (productCount < 10) {
    // console.log(
    //   `Only ${productCount} products in database, running discovery to populate`,
    // );
    return true;
  }

  return false;
}

// Function to discover new trending products for the dashboard
async function discoverNewProducts(): Promise<void> {
  // A wider range of search terms to discover different product categories
  const allSearchTerms = [
    // Beauty category
    "beauty deals",
    "makeup bestsellers",
    "skincare products",
    "haircare essentials",
    "fragrance deals",

    // Seasonal category (dynamic based on current season)
    ...getCurrentSeasonalTerms(),

    // Events category
    "amazon lightning deals",
    "today deals amazon",
    "amazon prime deals",
    "amazon special offers",
    "amazon clearance sale",
    "amazon flash deals",
    "amazon daily deals",
    "amazon promotional offers",
  ];

  // Choose a larger subset to ensure we have enough products
  const termCount = process.env.NODE_ENV === "production" ? 8 : 4;
  const startIdx = priceCheckRunCount % allSearchTerms.length;
  const searchTerms = [];

  // Get a sequential subset of terms starting from startIdx
  for (let i = 0; i < termCount; i++) {
    const idx = (startIdx + i) % allSearchTerms.length;
    searchTerms.push(allSearchTerms[idx]);
  }

  // console.log(`Discovering products for terms: ${searchTerms.join(", ")}`);

  // Track results
  let newProductCount = 0;

  // Process one search term at a time, with delay between each to avoid throttling
  for (const term of searchTerms) {
    try {
      // Search for products - increased limit for more products
      // console.log(`Searching for: ${term}`);
      const searchLimit = process.env.NODE_ENV === "production" ? 10 : 5;
      const results = await searchProducts(term);

      // Add each product to database if not exists
      for (const result of results.items) {
        try {
          if (!result.price) {
            // console.log(`Skipping product without price: ${result.title}`);
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
              originalPrice: Math.round(result.price * 1.15 * 100) / 100,
              lowestPrice: result.price,
              highestPrice: Math.max(
                result.price,
                Math.round(result.price * 1.15 * 100) / 100,
              ),
              lastChecked: new Date(),
            });

            // Add initial price history entry
            await intelligentlyAddPriceHistory(newProduct.id, result.price);

            newProductCount++;
            // console.log(`Added new product: ${result.title}`);
          }
        } catch (productError) {
          console.error(`Error adding product ${result.asin}:`, productError);
        }

        // Small delay between products to avoid API throttling
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Add a delay between search terms to avoid throttling
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing search term "${term}":`, error);
    }
  }

  // console.log(`Discovered ${newProductCount} new products`);
}

// Helper function to get seasonal search terms based on current season
function getCurrentSeasonalTerms(): string[] {
  const now = new Date();
  const month = now.getMonth();

  // Spring: March-May (2-4)
  if (month >= 2 && month <= 4) {
    return [
      "spring deals",
      "garden essentials",
      "spring cleaning",
      "easter deals",
      "mothers day gifts",
    ];
  }

  // Summer: June-August (5-7)
  if (month >= 5 && month <= 7) {
    return [
      "summer deals",
      "beach essentials",
      "pool supplies",
      "camping gear",
      "bbq grills sale",
    ];
  }

  // Fall: September-November (8-10)
  if (month >= 8 && month <= 10) {
    return [
      "fall deals",
      "back to school",
      "halloween deals",
      "thanksgiving prep",
      "autumn essentials",
    ];
  }

  // Winter: December-February (11, 0, 1)
  return [
    "winter deals",
    "holiday gifts",
    "christmas deals",
    "new year sale",
    "winter essentials",
  ];
}

// Function to cleanup products that have consistently failed
async function cleanupFailedProducts(): Promise<void> {
  try {
    const failedAsins: string[] = [];
    const currentTime = new Date();
    
    // Check for products that have failed more than 10 times
    for (const [asin, failureCount] of productFailureCounts.entries()) {
      if (failureCount >= 10) {
        console.warn(`🔴 ASIN ${asin} has ${failureCount} consecutive failures - scheduling for review`);
        failedAsins.push(asin);
        
        try {
          // Get the product from database
          const product = await storage.getProductByAsin(asin);
          if (product) {
            // Add a comment or flag rather than deleting
            console.log(`📋 Flagging ASIN ${asin} for manual review due to persistent failures`);
            
            // You could implement a 'status' field in your schema to mark products as problematic
            // For now, we'll just reset the failure count and add a longer delay
            productFailureCounts.set(asin, 0);
            
            // Update lastChecked to add a longer delay before next attempt (24 hours)
            const nextCheckTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
            await storage.updateProduct(product.id, {
              lastChecked: nextCheckTime,
            });
            
            console.log(`⏰ ASIN ${asin} next check scheduled for: ${nextCheckTime.toISOString()}`);
          }
        } catch (dbError) {
          console.error(`Error updating failed product ${asin}:`, dbError);
        }
      }
    }
    
    if (failedAsins.length > 0) {
      console.log(`🔧 Processed ${failedAsins.length} consistently failing products`);
    }
  } catch (error) {
    console.error('Error cleaning up failed products:', error);
  }
}

// New function to remove stale products
async function removeStaleProducts(): Promise<void> {
  try {
    const products = await storage.getAllProducts();
    const now = new Date();

    // Define thresholds for staleness
    const STALE_DAYS = 30; // Products not checked for 30 days
    const PRICE_UNCHANGED_DAYS = 14; // Price hasn't changed in 14 days
    const MIN_PRODUCTS_TO_KEEP = 100; // Minimum number of products to keep in the system

    // Get price history for analysis
    const staleProducts = await Promise.all(
      products.map(async (product) => {
        const lastChecked = new Date(product.lastChecked);
        const daysSinceLastCheck =
          (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

        // Keep if product is fresh
        if (daysSinceLastCheck < STALE_DAYS) {
          return null;
        }

        // Keep if price has changed recently (check price history)
        const priceHistory = await storage.getPriceHistoryByProductId(
          product.id,
        );
        if (priceHistory && priceHistory.length > 1) {
          const lastPriceChange = new Date(
            priceHistory[priceHistory.length - 1].timestamp,
          );
          const daysSinceLastPriceChange =
            (now.getTime() - lastPriceChange.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceLastPriceChange > PRICE_UNCHANGED_DAYS
            ? product
            : null;
        }

        return product; // Remove if no price history or other conditions met
      }),
    );

    // Filter out null values and get final stale products list
    const productsToRemove = staleProducts.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );

    // Only remove products if we have enough remaining
    if (products.length - productsToRemove.length >= MIN_PRODUCTS_TO_KEEP) {
      // console.log(`Removing ${productsToRemove.length} stale products`);

      for (const product of productsToRemove) {
        try {
          // Remove associated price history and tracked products first
          await storage.removePriceHistory(product.id);
          await storage.removeTrackedProductsByProductId(product.id);
          await storage.removeProduct(product.id);
        } catch (err) {
          console.error(
            `Error removing product ${product.id}:`,
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      }
    } else {
      // console.log(
      //   "Skipping stale product removal to maintain minimum product count",
      // );
    }
  } catch (error) {
    console.error(
      "Error removing stale products:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export { updateProductPrice, checkPricesAndNotify, startPriceChecker };
