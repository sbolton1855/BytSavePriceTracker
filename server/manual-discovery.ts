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

  for (const searchTerm of searchTerms) {
    try {
      console.log(`\n🔎 Searching for: "${searchTerm}"`);

      // Search for products with a reasonable limit
      const results = await searchAmazonProducts(searchTerm);
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

          // Determine category based on search term
          const category = getCategoryFromSearchTerm(searchTerm);

          const product = await storage.createProduct({
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
            category: category
          });

          // Add initial price history entry
          await intelligentlyAddPriceHistory(product.id, result.price);

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
      console.error(`❌ Error processing search term "${searchTerm}":`, error);
    }
  }

  console.log(`\n🎉 Discovery complete! Added ${totalNewProducts} new products total`);
  console.log(`[Discovery] Found ${totalNewProducts} new deals at ${new Date().toISOString()}`);

  // Show current database stats
  const allProducts = await storage.getAllProducts();
  const discoveredProducts = allProducts.filter(p => p.isDiscovered);
  const userTrackedProducts = allProducts.filter(p => !p.isDiscovered);
  const discoveredWithDeals = discoveredProducts.filter(p =>
    (p.discountPercentage && p.discountPercentage > 0) ||
    (p.originalPrice && p.originalPrice > p.currentPrice)
  );

  console.log('\n📈 Database Statistics:');
  console.log(`   Total products: ${allProducts.length}`);
  console.log(`   Discovered products: ${discoveredProducts.length}`);
  console.log(`   Discovered products with deals: ${discoveredWithDeals.length}`);
  console.log(`   User-tracked products: ${userTrackedProducts.length}`);
}

// Helper function to determine category from search term
function getCategoryFromSearchTerm(searchTerm: string): string {
  const healthKeywords = ['vitamin', 'supplement', 'protein', 'beauty', 'skincare', 'makeup', 'hair', 'nail', 'biotin', 'collagen'];
  const techKeywords = ['bluetooth', 'wireless', 'headphones', 'charger', 'gadget', 'electronic', 'smart', 'device', 'tech'];
  const seasonalKeywords = ['winter', 'summer', 'holiday', 'christmas', 'outdoor', 'garden', 'camping', 'beach'];

  const lowerTerm = searchTerm.toLowerCase();

  if (healthKeywords.some(keyword => lowerTerm.includes(keyword))) {
    return 'health';
  }
  if (techKeywords.some(keyword => lowerTerm.includes(keyword))) {
    return 'tech';
  }
  if (seasonalKeywords.some(keyword => lowerTerm.includes(keyword))) {
    return 'seasonal';
  }

  // Helper function to get current search terms for fallback logic
  function getCurrentSearchTerms(): string[] {
    return [
      'vitamin supplements bestseller', 'skincare products trending', 'protein powder deals', 'beauty essentials',
      'bluetooth headphones', 'phone accessories', 'smart home devices', 'computer accessories',
      'kitchen gadgets', 'home organization', 'cooking utensils', 'storage solutions',
      'amazon lightning deals', 'today deals amazon', 'amazon daily deals', 'clearance sale'
    ];
  }

  // Default fallback based on term position in arrays
  const termIndex = getCurrentSearchTerms().indexOf(searchTerm);
  if (termIndex < getCurrentSearchTerms().length / 3) return 'health';
  if (termIndex < (getCurrentSearchTerms().length * 2) / 3) return 'tech';
  return 'seasonal';
}


// Run the discovery if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
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