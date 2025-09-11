import express from 'express';
import { cache } from '../lib/cache';
import { metrics } from '../lib/metrics';
import { getProductInfo } from '../amazonApi';

const router = express.Router();

// Clear cache
router.post('/admin/cache/clear', async (req, res) => {
  try {
    await cache.clear();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to clear cache'
    });
  }
});

// Get cache stats
router.get('/admin/cache/stats', (req, res) => {
  try {
    const stats = {
      items: Object.keys(cache.getAll()).length,
      efficiency: metrics.getCacheEfficiency(),
      hits: metrics.getMetrics().cacheHits,
      misses: metrics.getMetrics().cacheMisses
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get cache stats'
    });
  }
});

// ASIN Inspector
router.get('/admin/asin/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const forceRefresh = req.query.force === 'true';

    // Clear cache for this ASIN if force refresh
    if (forceRefresh) {
      await cache.del(`product:${asin}`);
    }

    // Get product info
    const product = await getProductInfo(asin);

    // Get price history
    const priceHistory = cache.getPriceHistory(asin);

    // Get cache status
    const cacheStatus = {
      inCache: cache.getProduct(asin) !== undefined,
      lastUpdated: new Date().toISOString(), // Simplified for now
      priceDrops: metrics.getPriceDrops()
        .filter(drop => drop.asin === asin)
    };

    res.json({
      product,
      priceHistory,
      cacheStatus
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to inspect ASIN'
    });
  }
});

// Force price recheck for multiple ASINs
router.post('/admin/recheck-prices', async (req, res) => {
  try {
    const { asins } = req.body as { asins: string[] };

    if (!Array.isArray(asins)) {
      return res.status(400).json({ error: 'asins must be an array' });
    }

    // Clear cache for these ASINs
    for (const asin of asins) {
      await cache.del(`product:${asin}`);
    }

    // Fetch fresh data
    const results = await Promise.allSettled(
      asins.map(asin => getProductInfo(asin))
    );

    const response = results.map((result, index) => ({
      asin: asins[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to recheck prices'
    });
  }
});

export default router;