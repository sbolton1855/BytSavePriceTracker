import express from 'express';
import { cache } from '../lib/cache';
import { metrics } from '../lib/metrics';
import { getProductInfo } from '../amazonApi';

const router = express.Router();

// System health status
router.get('/api/system/status', async (req, res) => {
  try {
    // Test Amazon API with a known ASIN
    const testAsin = 'B08PX626SG'; // YumEarth product as test
    let amazonStatus = 'unknown';
    
    try {
      await getProductInfo(testAsin);
      amazonStatus = 'ok';
    } catch (error) {
      amazonStatus = 'down';
    }

    // Get tracked products count
    const trackedCount = metrics.getMetrics().uniqueProducts || 0;

    // Calculate API uptime based on error rate
    const errorRate = metrics.getMetrics().errors / metrics.getMetrics().apiHits;
    const uptime = ((1 - errorRate) * 100).toFixed(1);

    // Get last hour's performance
    const recentMetrics = {
      apiHits: metrics.getMetrics().apiHits,
      cacheEfficiency: metrics.getCacheEfficiency(),
      priceDrops: metrics.getPriceDrops({ since: 60 * 60 * 1000 }).length // Last hour
    };

    res.json({
      status: {
        amazon: amazonStatus,
        uptime: `${uptime}%`
      },
      trackedProducts: trackedCount,
      lastHour: recentMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get system status'
    });
  }
});

// Activity feed
router.get('/api/activity/feed', (req, res) => {
  try {
    const priceDrops = metrics.getPriceDrops({ limit: 5 });
    const errors = metrics.getRecentErrors(5);

    // Combine and sort activities
    const activities = [
      ...priceDrops.map(drop => ({
        type: 'price_drop',
        timestamp: drop.timestamp,
        data: {
          asin: drop.asin,
          title: drop.title,
          dropAmount: drop.oldPrice - drop.newPrice,
          dropPercent: drop.dropPercent
        }
      })),
      ...errors.map(error => ({
        type: 'error',
        timestamp: error.timestamp,
        data: {
          type: error.type,
          asin: error.asin,
          message: error.message
        }
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10); // Last 10 activities

    res.json(activities);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get activity feed'
    });
  }
});

// Mock error injection (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/api/admin/errors/mock', (req, res) => {
    try {
      const mockErrors = [
        {
          type: 'API_FAILURE',
          asin: 'B08PX626SG',
          message: 'GetItems API timeout',
          timestamp: new Date()
        },
        {
          type: 'PRICE_MISMATCH',
          asin: 'B07Q33GXBX',
          message: 'Price validation failed',
          timestamp: new Date(Date.now() - 5 * 60 * 1000)
        },
        {
          type: 'RATE_LIMIT',
          asin: 'B09NRG3R9Q',
          message: 'Too many requests',
          timestamp: new Date(Date.now() - 15 * 60 * 1000)
        }
      ];

      mockErrors.forEach(error => {
        metrics.recordError(error.type, error.asin, error.message);
      });

      res.json({ message: 'Mock errors injected', count: mockErrors.length });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to inject mock errors'
      });
    }
  });
}

export default router; 