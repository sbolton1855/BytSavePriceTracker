import express from 'express';
import { getAnalyticsSummary, getTrendData, getCacheEfficiencyTrend } from '../controllers/analyticsController';

const router = express.Router();

// Get analytics summary with optional time range
router.get('/analytics/summary', async (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;
    const summary = await getAnalyticsSummary({ since });
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch analytics'
    });
  }
});

// Get trend data for charts
router.get('/analytics/trends', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const trends = getTrendData(days);
    res.json(trends);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch trends'
    });
  }
});

// Get cache efficiency trend
router.get('/analytics/cache-efficiency', async (req, res) => {
  try {
    const efficiency = getCacheEfficiencyTrend();
    res.json(efficiency);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch cache efficiency'
    });
  }
});

export default router; 