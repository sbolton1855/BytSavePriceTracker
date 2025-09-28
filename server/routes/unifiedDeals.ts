
import express from 'express';
import { searchAmazonProducts } from '../amazonApi';
import { addAffiliateTag } from '../utils/affiliateLinks';

const router = express.Router();
const AFFILIATE_TAG = process.env.AMAZON_PARTNER_TAG || 'bytsave-20';

// Normalized deal interface
interface UnifiedDeal {
  id: string;
  title: string;
  currentPrice: number;
  originalPrice: number | null;
  discountPercentage: number;
  imageUrl: string;
  affiliateUrl: string;
  asin: string;
}

// Keywords for different deal types
const DEAL_KEYWORDS = {
  live: [
    'wireless earbuds',
    'bluetooth speaker',
    'phone case',
    'charging cable',
    'screen protector',
    'gaming mouse',
    'keyboard',
    'webcam',
    'usb drive',
    'power bank'
  ],
  trending: [
    'smart watch',
    'fitness tracker',
    'coffee maker',
    'air fryer',
    'robot vacuum',
    'led lights',
    'essential oils',
    'yoga mat',
    'water bottle',
    'laptop stand'
  ]
};

router.get('/api/deals', async (req, res) => {
  try {
    const { type = 'live', limit = 12 } = req.query;
    
    console.log(`[UnifiedDeals] Fetching ${type} deals with limit ${limit}`);

    if (!['live', 'trending'].includes(type as string)) {
      return res.status(400).json({ error: 'Invalid deal type. Must be "live" or "trending"' });
    }

    const dealType = type as 'live' | 'trending';
    const keywords = DEAL_KEYWORDS[dealType];
    
    // Get random keyword for variety
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    
    console.log(`[UnifiedDeals] Searching Amazon for: ${randomKeyword}`);
    
    // Search Amazon for products
    const amazonResults = await searchAmazonProducts(randomKeyword);
    
    if (!amazonResults || !Array.isArray(amazonResults)) {
      console.log(`[UnifiedDeals] No results from Amazon for ${randomKeyword}`);
      return res.json({ deals: [] });
    }

    // Process and normalize results
    const deals: UnifiedDeal[] = amazonResults
      .slice(0, parseInt(limit as string) || 12)
      .map((item: any) => {
        const currentPrice = item.Offers?.Listings?.[0]?.Price?.Amount || 0;
        const originalPrice = item.Offers?.Listings?.[0]?.SavingBasis?.Amount || null;
        const discountPercentage = originalPrice && originalPrice > currentPrice
          ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
          : 0;

        return {
          id: item.ASIN,
          title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
          currentPrice,
          originalPrice,
          discountPercentage,
          imageUrl: item.Images?.Primary?.Medium?.URL || item.Images?.Primary?.Small?.URL || '',
          affiliateUrl: addAffiliateTag(
            item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}`,
            AFFILIATE_TAG
          ),
          asin: item.ASIN
        };
      })
      // Filter out products without valid prices
      .filter(deal => deal.currentPrice > 0);

    console.log(`[UnifiedDeals] Returning ${deals.length} ${type} deals`);

    res.json({
      deals,
      type: dealType,
      keyword: randomKeyword,
      total: deals.length
    });

  } catch (error) {
    console.error('[UnifiedDeals] Error fetching deals:', error);
    res.status(500).json({ 
      error: 'Failed to fetch deals',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
