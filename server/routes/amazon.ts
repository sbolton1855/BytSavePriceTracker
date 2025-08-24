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
  console.log(`[DEBUG] /api/amazon/deals endpoint hit with keyword: ${keyword}`);

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
    // If searchAmazonProducts fails, use the fallback deals
    if (err.message.includes('InvalidParameterValue')) { // Example specific error check
      console.log('[INFO] Using fallback deals due to InvalidParameterValue error.');
      const fallbackDeals = await getFallbackDeals();
      res.json({ deals: fallbackDeals });
    } else {
      res.status(500).json({ error: 'Failed to fetch deals' });
    }
  }
});

export default router;