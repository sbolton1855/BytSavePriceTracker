import express from 'express';
import { searchProducts } from '../amazonApi';
import { logApiError } from '../errorController';
import * as storage from '../storage';

const router = express.Router();

router.get('/products/deals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;

    // Get products from database with discounts/deals
    const products = await storage.getProductsWithDeals(limit);
    
    if (!products || products.length === 0) {
      return res.json({ deals: [] });
    }

    // Format for frontend compatibility
    const deals = products.map(product => ({
      asin: product.asin,
      title: product.title,
      currentPrice: product.currentPrice,
      originalPrice: product.originalPrice,
      price: product.currentPrice, // Legacy compatibility
      msrp: product.originalPrice, // Legacy compatibility
      imageUrl: product.imageUrl,
      url: product.affiliateUrl || `https://www.amazon.com/dp/${product.asin}`,
      affiliateUrl: product.affiliateUrl || `https://www.amazon.com/dp/${product.asin}`,
      discountPercentage: product.discountPercentage,
      lastChecked: product.lastChecked,
      id: product.id,
      reviewCount: product.reviewCount || 0
    }));

    console.log(`[/api/products/deals] Sending ${deals.length} deals to frontend`);
    res.json({ deals });
  } catch (error) {
    console.error('Failed to fetch deals from database:', error);
    
    if (error instanceof Error) {
      await logApiError('SEARCH', 'API_FAILURE', error.message);
      res.status(500).json({ error: error.message });
    } else {
      await logApiError('SEARCH', 'API_FAILURE', 'Unknown error occurred');
      res.status(500).json({ error: 'Failed to fetch deals' });
    }
  }
});

export default router; 