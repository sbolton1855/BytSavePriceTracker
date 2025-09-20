
import { storage } from './storage';
import { searchAmazonProducts } from './amazonApi';

// Import the intelligentlyAddPriceHistory function from routes
async function intelligentlyAddPriceHistory(productId: number, currentPrice: number): Promise<boolean> {
  try {
    // Get the most recent price history for this product
    const priceHistory = await storage.getPriceHistoryByProductId(productId);

    // If no price history exists, always add the first entry
    if (!priceHistory || priceHistory.length === 0) {
      await storage.createPriceHistory({
        productId,
        price: currentPrice,
        timestamp: new Date()
      });
      return true;
    }

    // Sort by timestamp to get the most recent entry
    priceHistory.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latestEntry = priceHistory[0];
    const latestTimestamp = new Date(latestEntry.timestamp);
    const now = new Date();
    const hoursSinceLastUpdate = (now.getTime() - latestTimestamp.getTime()) / (1000 * 60 * 60);

    // Add new entry if price changed or significant time has passed
    const priceChanged = Math.abs(latestEntry.price - currentPrice) > 0.01; // 1 cent threshold
    const significantTimePassed = hoursSinceLastUpdate > 6; // 6 hour threshold

    if (priceChanged || significantTimePassed) {
      await storage.createPriceHistory({
        productId,
        price: currentPrice,
        timestamp: new Date()
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error adding price history:", error);
    return false;
  }
}

// Function to manually run product discovery
async function runProductDiscovery(): Promise<void> {
  console.log('🔍 Starting manual product discovery...');
  
  // Extended search terms for better product variety
  const searchTerms = [
    // Health & Beauty
    'vitamin supplements bestseller',
    'skincare products trending',
    'protein powder deals',
    'beauty essentials',
    
    // Electronics & Tech
    'bluetooth headphones',
    'phone accessories',
    'smart home devices',
    'computer accessories',
    
    // Kitchen & Home
    'kitchen gadgets',
    'home organization',
    'cooking utensils',
    'storage solutions',
    
    // Seasonal/Current
    'amazon lightning deals',
    'today deals amazon',
    'amazon daily deals',
    'clearance sale'
  ];

  let totalNewProducts = 0;
  
  for (const term of searchTerms) {
    try {
      console.log(`\n🔎 Searching for: "${term}"`);
      
      // Search for products with a reasonable limit
      const results = await searchAmazonProducts(term);
      console.log(`   Found ${results?.length || 0} products`);
      
      if (!results || results.length === 0) {
        console.log('   No products found for this search term');
        continue;
      }

      // Process each product
      let addedFromThisSearch = 0;
      for (const item of results) {
        const result = {
          asin: item.ASIN,
          title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
          price: item.Offers?.Listings?.[0]?.Price?.Amount || null,
          url: item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}`,
          imageUrl: item.Images?.Primary?.Medium?.URL || item.Images?.Primary?.Small?.URL || null
        };
        try {
          if (!result.price || result.price <= 0) {
            continue;
          }

          // Check if product already exists
          const existing = await storage.getProductByAsin(result.asin);
          if (existing) {
            continue; // Skip if already exists
          }

          // Create new product with discovery flag
          const newProduct = await storage.createProduct({
            asin: result.asin,
            title: result.title,
            url: result.url,
            imageUrl: result.imageUrl,
            currentPrice: result.price,
            originalPrice: Math.round(result.price * 1.15 * 100) / 100, // 15% markup estimate
            lowestPrice: result.price,
            highestPrice: Math.max(
              result.price,
              Math.round(result.price * 1.15 * 100) / 100,
            ),
            lastChecked: new Date(),
            isDiscovered: true, // Mark as discovered product
          });

          // Add initial price history entry
          await intelligentlyAddPriceHistory(newProduct.id, result.price);

          addedFromThisSearch++;
          totalNewProducts++;
          
          console.log(`   ✅ Added: ${result.title.substring(0, 50)}...`);
          
        } catch (productError) {
          console.error(`   ❌ Error adding product ${result.asin}:`, productError);
        }

        // Small delay between products
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`   📊 Added ${addedFromThisSearch} new products from this search`);
      
      // Delay between search terms to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing search term "${term}":`, error);
    }
  }

  console.log(`\n🎉 Discovery complete! Added ${totalNewProducts} new products total`);
  
  // Show current database stats
  const allProducts = await storage.getAllProducts();
  const discoveredProducts = allProducts.filter(p => p.isDiscovered);
  const userTrackedProducts = allProducts.filter(p => !p.isDiscovered);
  
  console.log('\n📈 Database Statistics:');
  console.log(`   Total products: ${allProducts.length}`);
  console.log(`   Discovered products: ${discoveredProducts.length}`);
  console.log(`   User-tracked products: ${userTrackedProducts.length}`);
}

// Run the discovery if this file is executed directly
if (require.main === module) {
  runProductDiscovery()
    .then(() => {
      console.log('✅ Manual discovery completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Manual discovery failed:', error);
      process.exit(1);
    });
}

export { runProductDiscovery };
