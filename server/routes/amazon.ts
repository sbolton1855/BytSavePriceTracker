console.log('>>> [DEBUG] LOADED AMAZON ROUTER from server/routes/amazon.ts');
import express from 'express';
import { searchAmazonProducts } from '../amazonApi';

const router = express.Router();

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
    }).map((item: any) => ({
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue,
      price: item.Offers?.Listings?.[0]?.Price?.Amount,
      msrp: item.Offers?.Listings?.[0]?.SavingBasis?.Amount,
      imageUrl: item.Images?.Primary?.Medium?.URL || item.Images?.Primary?.Small?.URL || item.Images?.Primary?.Large?.URL || null,
      url: item.DetailPageURL,
    }));

    res.json({ deals });
  } catch (err: any) {
    console.error('[ERROR] Failed to fetch deals from Amazon:', err.message);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

function getRandomKeyword() {
  const terms = ['protein powder', 'creatine', 'fitness', 'vitamins', 'electronics', 'kitchen', 'headphones'];
  return terms[Math.floor(Math.random() * terms.length)];
}

export default router; 