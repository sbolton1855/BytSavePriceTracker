console.log('>>> [DEBUG] LOADED AMAZON ROUTER from server/routes/amazon.ts');
import express from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { searchAmazonProducts } from '../amazonApi';

const router = express.Router();

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
      liveDeals: ['deals', 'lightning deals', 'prime day'],
      trendingNow: ['fall fashion', 'tech gadgets', 'trending products']
    };
  }
}

function getRandomKeywordFromCategory(category?: string) {
  const config = loadKeywordConfig();
  
  if (category && config[category]) {
    const keywords = config[category];
    return keywords[Math.floor(Math.random() * keywords.length)];
  }
  
  // If no category specified, pick random from either group
  const allKeywords = [...(config.liveDeals || []), ...(config.trendingNow || [])];
  if (allKeywords.length === 0) {
    return 'deals'; // Ultimate fallback
  }
  
  return allKeywords[Math.floor(Math.random() * allKeywords.length)];
}

router.get('/amazon/deals', async (req, res) => {
  const category = req.query.category?.toString();
  const customQuery = req.query.q?.toString();
  
  const keyword = customQuery || getRandomKeywordFromCategory(category);
  console.log(`[DEBUG] /api/amazon/deals endpoint hit with keyword: ${keyword}, category: ${category}`);

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

    res.json({ deals });
  } catch (err: any) {
    console.error('[ERROR] Failed to fetch deals from Amazon:', err.message);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router; 