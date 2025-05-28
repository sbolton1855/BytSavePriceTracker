import express from 'express';
import { metrics } from '../lib/metrics';

const router = express.Router();

router.get('/products/price-drops', (req, res) => {
  try {
    const since = req.query.since ? parseDuration(req.query.since as string) : undefined;
    const limit = req.query.limit ? parseLimit(req.query.limit as string) : undefined;

    const drops = metrics.getPriceDrops({ since, limit });
    res.json(drops);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid request parameters'
    });
  }
});

// Helper to parse duration strings like "24h", "7d"
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([hd])$/);
  if (!match) {
    throw new Error('Invalid duration format. Use format: 24h or 7d');
  }

  const [, value, unit] = match;
  const hours = unit === 'h' ? parseInt(value, 10) : parseInt(value, 10) * 24;
  return hours * 60 * 60 * 1000; // Convert to milliseconds
}

// Helper to parse and validate limit parameter
function parseLimit(limit: string): number {
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) {
    throw new Error('Limit must be a positive number');
  }
  return parsed;
}

// Metrics endpoint for monitoring
router.get('/metrics', (req, res) => {
  res.json({
    counts: metrics.getMetrics(),
    cacheEfficiency: metrics.getCacheEfficiency()
  });
});

export default router; 