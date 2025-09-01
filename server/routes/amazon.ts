import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

// Amazon deals endpoint - always return JSON
router.get('/deals', async (req, res) => {
  try {
    console.log('[amazon-deals] Fetching deals');

    // For now, return empty deals until upstream is properly wired
    // This prevents undefined function calls and ensures consistent JSON response
    const response = {
      items: [],
      updatedAt: new Date().toISOString(),
      message: "Deals service not yet configured"
    };

    console.log('[amazon-deals] ✅ Returning', response.items.length, 'deals');
    res.json(response);
  } catch (error) {
    console.error('[amazon-deals] ❌ Error:', error);
    res.status(500).json({
      error: 'deals_unavailable',
      message: 'Unable to fetch deals at this time',
      items: [],
      updatedAt: new Date().toISOString()
    });
  }
});

// Admin-only Amazon API testing endpoint
router.get('/test', requireAdmin, async (req, res) => {
  try {
    console.log('[amazon-test] Admin testing Amazon API');

    res.json({
      message: "Amazon API test endpoint",
      timestamp: new Date().toISOString(),
      credentials: {
        accessKey: process.env.AWS_ACCESS_KEY_ID ? "present" : "missing",
        secretKey: process.env.AWS_SECRET_ACCESS_KEY ? "present" : "missing",
        partnerTag: process.env.AMAZON_PARTNER_TAG ? "present" : "missing"
      }
    });
  } catch (error) {
    console.error('[amazon-test] ❌ Error:', error);
    res.status(500).json({
      error: 'test_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;