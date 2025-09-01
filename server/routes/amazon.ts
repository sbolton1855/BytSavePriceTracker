import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { getDeals } from "../lib/amazonApi.js";

const router = Router();

// Amazon deals endpoint - always return JSON
router.get('/deals', async (req, res) => {
  try {
    console.log('[amazon-deals] Fetching deals...');
    const items = await getDeals();
    console.log(`[amazon-deals] Found ${items.length} deals`);
    res.status(200).type('application/json').json({
      items,
      updatedAt: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('[amazon-deals] Error:', e?.message || 'getDeals failed');
    res.status(502).type('application/json').json({
      error: 'bad_upstream',
      detail: e?.message || 'getDeals failed',
      hint: 'upstream_not_json'
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