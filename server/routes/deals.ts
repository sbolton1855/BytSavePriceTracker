import express from 'express';
import { searchProducts } from '../amazonApi';
import { logApiError } from '../errorController';

const router = express.Router();

router.get('/products/deals', async (req, res) => {
  try {
    const { storage } = await import('../storage');
    const { addAffiliateTag } = await import('../utils/affiliateLinks');
    
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const AFFILIATE_TAG = process.env.AMAZON_PARTNER_TAG || 'bytsave-20';

    // Get products with deals from database
    const deals = await storage.getProductsWithDeals(limit);

    // Map to expected format for frontend
    const formattedDeals = deals.map(product => ({
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
      savings: product.originalPrice ? 
        Math.round((product.originalPrice - product.currentPrice) * 100) / 100 : 0,
      reviewCount: product.reviewCount || 0,
      lastChecked: product.lastChecked
    }));

    console.log(`[/api/products/deals] Sending ${formattedDeals.length} deals to frontend`);
    res.json({ deals: formattedDeals });
  } catch (error) {
    console.error('Failed to fetch deals from database:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router; 