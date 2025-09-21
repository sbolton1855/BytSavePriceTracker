console.log('>>> [DEBUG] LOADED AMAZON ROUTER from server/routes/amazon.ts');
import express from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { searchAmazonProducts } from '../amazonApi';

const router = express.Router();

// Simple in-memory cache with 5-minute TTL
const cache: { [key: string]: { timestamp: number; data: any } } = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Load keyword config with fallback
function loadKeywordConfig() {
  try {
    const configPath = join(__dirname, '..', 'config', 'deal_keywords.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configFile);
    console.log('[DEBUG] Loaded keyword config:', config);
    return config;
  } catch (error) {
    console.warn('[WARN] Failed to load keyword config, using fallback:', error);
    return {
      liveDeals: ['kitchen', 'fitness'],
      trendingNow: ['kitchen', 'fitness']
    };
  }
}

function getRandomKeywordFromCategory(category?: string) {
  const config = loadKeywordConfig();
  const fallbackKeywords = ['kitchen', 'fitness'];
  
  if (category && config[category]) {
    const keywords = config[category];
    return keywords[Math.floor(Math.random() * keywords.length)];
  }
  
  // If no category specified, use fallback
  if (!category) {
    const allKeywords = [...(config.liveDeals || fallbackKeywords), ...(config.trendingNow || fallbackKeywords)];
    return allKeywords[Math.floor(Math.random() * allKeywords.length)];
  }
  
  // If category doesn't exist, use fallback
  return fallbackKeywords[Math.floor(Math.random() * fallbackKeywords.length)];
}

router.get('/amazon/deals', async (req, res) => {
  const category = req.query.category?.toString() || 'liveDeals';
  const customQuery = req.query.q?.toString();
  
  const keyword = customQuery || getRandomKeywordFromCategory(category);
  console.log(`[DEBUG] /api/amazon/deals endpoint hit with keyword: ${keyword}, category: ${category}`);

  // Check cache first
  const now = Date.now();
  if (cache[keyword] && now - cache[keyword].timestamp < CACHE_TTL) {
    console.log(`[DEBUG] Cache hit for keyword: ${keyword}`);
    return res.json({ source: 'cache', data: cache[keyword].data });
  }

  try {
    const items = await searchAmazonProducts(keyword);

    // Log raw Amazon response for inspection
    console.log('[DEBUG] Raw items from Amazon:', JSON.stringify(items, null, 2));

    const deals = items.filter((item: any) => {
      const price = item?.Offers?.Listings?.[0]?.Price?.Amount;
      return !!price;
    }).map((item: any) => {
      const listing = item.Offers?.Listings?.[0];
      const price = listing?.Price?.Amount;
      const savings = listing?.Price?.Savings;
      const savingBasis = listing?.SavingBasis?.Amount;
      
      return {
        asin: item.ASIN,
        title: item.ItemInfo?.Title?.DisplayValue,
        price: price,
        msrp: savingBasis,
        imageUrl: item.Images?.Primary?.Medium?.URL || item.Images?.Primary?.Small?.URL || item.Images?.Primary?.Large?.URL || null,
        url: item.DetailPageURL,
        // Include Amazon savings data if available
        savings: savings ? {
          Amount: savings.Amount,
          Percentage: savings.Percentage,
          DisplayAmount: savings.DisplayAmount,
          Currency: savings.Currency
        } : null
      };
    });

    // Cache the result
    cache[keyword] = { timestamp: now, data: { deals } };
    console.log(`[DEBUG] Cached result for keyword: ${keyword}`);

    res.json({ source: 'amazon', data: { deals } });
  } catch (err: any) {
    console.error('[ERROR] Failed to fetch deals from Amazon:', err.message);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router; 