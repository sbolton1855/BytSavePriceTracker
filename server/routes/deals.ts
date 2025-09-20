import express from 'express';
import { searchProducts } from '../amazonApi';
import { logApiError } from '../errorController';

const router = express.Router();

router.get('/products/deals', async (req, res) => {
  try {
    const { storage } = await import('../storage');
    const { addAffiliateTag } = await import('../utils/affiliateLinks');
    
    const limit = parseInt(req.query.limit as string, 10) || 4;
    const AFFILIATE_TAG = process.env.AMAZON_PARTNER_TAG || 'bytsave-20';

    // Time-based rotation logic (rotates every 6 hours)
    const hour = new Date().getHours();
    const batchSize = 4;
    const batchIndex = Math.floor(hour / 6); // 0 to 3 (4 rotations per day)
    const offset = batchIndex * batchSize;

    console.log(`[/api/products/deals] Fetching deals with limit: ${limit}, offset: ${offset}, batchIndex: ${batchIndex}, hour: ${hour}`);

    // Get products with deals from database using offset for rotation
    const deals = await storage.getProductsWithDeals(limit, offset);

    if (!deals || deals.length === 0) {
      console.log(`[/api/products/deals] No deals found, returning empty array`);
      return res.json({ deals: [] });
    }

    // Map to expected format for frontend
    const formattedDeals = deals.map(product => {
      const savings = product.originalPrice && product.originalPrice > product.currentPrice ? 
        Math.round((product.originalPrice - product.currentPrice) * 100) / 100 : 0;
      
      return {
        asin: product.asin,
        title: product.title,
        price: product.currentPrice,
        msrp: product.originalPrice,
        url: product.url,
        imageUrl: product.imageUrl,
        currentPrice: product.currentPrice,
        originalPrice: product.originalPrice,
        affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG),
        discountPercentage: product.discountPercentage || 0,
        savings: savings,
        reviewCount: product.reviewCount || 0,
        lastChecked: product.lastChecked
      };
    });

    console.log(`[/api/products/deals] Sending ${formattedDeals.length} deals to frontend`);
    console.log(`[/api/products/deals] Sample deal:`, formattedDeals[0] ? {
      asin: formattedDeals[0].asin,
      title: formattedDeals[0].title?.substring(0, 50) + '...',
      price: formattedDeals[0].price,
      discountPercentage: formattedDeals[0].discountPercentage
    } : 'none');
    
    // Always return consistent format with deals wrapper
    res.json({ deals: formattedDeals });
  } catch (error) {
    console.error('Failed to fetch deals from database:', error);
    res.status(500).json({ error: 'Failed to fetch deals', details: error.message });
  }
});

// Debug route to check database contents
router.get('/debug/products', async (req, res) => {
  try {
    const { storage } = await import('../storage');
    
    const allProducts = await storage.getAllProducts();
    const recentProducts = allProducts.filter(product => {
      if (!product.lastChecked) return false;
      const lastChecked = new Date(product.lastChecked);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return lastChecked > sevenDaysAgo;
    });
    
    const withDiscounts = recentProducts.filter(product => 
      (product.discountPercentage && product.discountPercentage > 0) ||
      (product.originalPrice && product.originalPrice > product.currentPrice)
    );
    
    const discoveredProducts = allProducts.filter(p => p.isDiscovered);
    const trackedProducts = allProducts.filter(p => !p.isDiscovered);
    
    res.json({
      total: allProducts.length,
      recent: recentProducts.length,
      withDiscounts: withDiscounts.length,
      discovered: discoveredProducts.length,
      tracked: trackedProducts.length,
      userTracked: trackedProducts.length, // Legacy field name
      discoveredDeals: withDiscounts.filter(p => p.isDiscovered).length,
      trackedDeals: withDiscounts.filter(p => !p.isDiscovered).length,
      sampleProducts: recentProducts.slice(0, 5).map(p => ({
        id: p.id,
        asin: p.asin,
        title: p.title?.substring(0, 50) + '...',
        currentPrice: p.currentPrice,
        originalPrice: p.originalPrice,
        discountPercentage: p.discountPercentage,
        lastChecked: p.lastChecked,
        isDiscovered: p.isDiscovered
      }))
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual discovery trigger endpoint
router.post('/manual-discovery', async (req, res) => {
  try {
    console.log('[/api/manual-discovery] Manual discovery triggered');
    
    // Import and run discovery
    const { runProductDiscovery } = await import('../manual-discovery');
    await runProductDiscovery();
    
    res.json({ 
      success: true, 
      message: 'Manual discovery completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[/api/manual-discovery] Discovery failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Manual discovery failed', 
      details: error.message 
    });
  }
});

export default router; 