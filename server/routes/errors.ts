import express from 'express';
import { metrics } from '../lib/metrics';

const router = express.Router();

// Get error data with optional time filtering
router.get('/api/errors', (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string) : undefined;
    
    // Get recent errors
    const errors = metrics.getRecentErrors(50, since);
    
    // Get error distribution
    const distribution = metrics.getErrorDistribution(since);

    res.json({
      errors,
      distribution,
      total: errors.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch error data'
    });
  }
});

export default router; 