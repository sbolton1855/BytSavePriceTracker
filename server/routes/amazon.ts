console.log('>>> [DEBUG] LOADED AMAZON ROUTER from server/routes/amazon.ts');
import express from 'express';
import { searchAmazonProducts } from '../amazonApi';

const router = express.Router();

function getRandomKeyword() {
  const keywords = ['vitamins', 'supplements', 'health', 'wellness', 'nutrition', 'organic', 'natural'];
  return keywords[Math.floor(Math.random() * keywords.length)];
}

// Fallback function if searchAmazonProducts fails
async function getFallbackDeals() {
  return [
    {
      ASIN: 'B00SAMPLE1',
      ItemInfo: { Title: { DisplayValue: 'Sample Health Product' } },
      Offers: {
        Listings: [{
          Price: { Amount: 19.99 },
          SavingBasis: { Amount: 29.99 },
          Savings: { Amount: 10.00, Percentage: 33, DisplayAmount: '$10.00 (33%)', Currency: 'USD' }
        }]
      },
      Images: { Primary: { Medium: { URL: 'https://via.placeholder.com/150' } } },
      DetailPageURL: 'https://amazon.com/dp/B00SAMPLE1'
    }
  ];
}

router.get('/amazon/deals', async (req, res) => {
  const keyword = req.query.q?.toString() || getRandomKeyword();
  const testMode = req.query.test === 'httpbin';
  
  console.log(`[DEBUG] /api/amazon/deals endpoint hit with keyword: ${keyword}`);
  console.log(`[DEBUG] Request URL: ${req.originalUrl}`);
  console.log(`[DEBUG] Test mode: ${testMode}`);

  // Ensure we always send JSON response
  res.setHeader('Content-Type', 'application/json');

  // Test with httpbin first to prove routing works
  if (testMode) {
    try {
      const testUrl = 'https://httpbin.org/get';
      console.log('[DEBUG] Testing route with httpbin:', testUrl);
      const response = await fetch(testUrl);
      const text = await response.text();
      return res.json({ test: 'httpbin', raw: text.slice(0, 200), status: 'success' });
    } catch (err: any) {
      console.error('[ERROR] Httpbin test failed:', err.message);
      return res.json({ test: 'httpbin', error: err.message, status: 'failed' });
    }
  }

  try {
    console.log('[DEBUG] About to call searchAmazonProducts...');
    console.log('[DEBUG] Keyword being used:', keyword);
    console.log('[DEBUG] searchAmazonProducts function location:', searchAmazonProducts.toString().substring(0, 200));
    
    // Log the environment variables to ensure they're loaded
    console.log('[DEBUG] Environment check:');
    console.log('  - AMAZON_ACCESS_KEY present:', !!process.env.AMAZON_ACCESS_KEY);
    console.log('  - AMAZON_SECRET_KEY present:', !!process.env.AMAZON_SECRET_KEY);
    console.log('  - AMAZON_PARTNER_TAG present:', !!process.env.AMAZON_PARTNER_TAG);

    const items = await searchAmazonProducts(keyword);
    console.log(`[DEBUG] searchAmazonProducts returned ${items ? items.length : 'null'} items`);

    // Log raw Amazon response for inspection
    if (items && items.length > 0) {
      console.log('[DEBUG] First item from Amazon:', JSON.stringify(items[0], null, 2));
    } else {
      console.log('[DEBUG] No items returned from Amazon, using fallback');
      const fallbackDeals = await getFallbackDeals();
      return res.json({ deals: fallbackDeals });
    }

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

    console.log(`[DEBUG] Processed ${deals.length} deals, sending response`);
    res.json({ deals });
  } catch (err: any) {
    console.error('[ERROR] Failed to fetch deals from Amazon:', err);
    console.error('[ERROR] Error stack:', err.stack);
    
    // Always return JSON, never let it fall through to HTML error pages
    try {
      const fallbackDeals = await getFallbackDeals();
      console.log('[INFO] Using fallback deals due to error:', err.message);
      res.json({ deals: fallbackDeals });
    } catch (fallbackErr: any) {
      console.error('[ERROR] Even fallback failed:', fallbackErr);
      res.status(500).json({ 
        error: 'Failed to fetch deals', 
        details: err.message,
        fallbackError: fallbackErr.message 
      });
    }
  }
});

export default router;