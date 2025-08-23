
import express from 'express';
import { db } from '../db';
import { affiliateClicks } from '../../migrations/schema';
import { buildAffiliateLink } from '../utils/affiliateLinks';

const router = express.Router();

// Affiliate redirect with click tracking
router.get('/r/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const { u: userId } = req.query;
    
    if (!asin) {
      return res.status(400).json({ error: 'ASIN required' });
    }

    // Log the click
    try {
      await db.insert(affiliateClicks).values({
        userId: userId as string || null,
        asin,
        userAgent: req.get('User-Agent') || null,
        ipAddress: req.ip || req.connection.remoteAddress || null,
        referrer: req.get('Referer') || null
      });
    } catch (logError) {
      console.error('Failed to log affiliate click:', logError);
      // Continue with redirect even if logging fails
    }

    // Redirect to Amazon with affiliate tag
    const affiliateUrl = buildAffiliateLink(asin);
    res.redirect(301, affiliateUrl);

  } catch (error) {
    console.error('Affiliate redirect error:', error);
    // Fallback redirect without tracking
    const affiliateUrl = buildAffiliateLink(req.params.asin);
    res.redirect(301, affiliateUrl);
  }
});

export default router;
