import { Router } from "express";
import { db } from "../db";
import { trackedProducts } from "../../migrations/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Get tracked products - always return JSON
router.get('/', async (req, res) => {
  try {
    console.log('[tracked-products] Fetching tracked products');

    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({
        error: 'missing_email',
        message: 'Email parameter is required'
      });
    }

    const products = await db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.email, email.toLowerCase()))
      .orderBy(trackedProducts.createdAt);

    console.log('[tracked-products] ✅ Found', products.length, 'products for', email);

    res.json({
      items: products,
      total: products.length,
      email: email
    });

  } catch (error) {
    console.error('[tracked-products] ❌ Error:', error);
    res.status(500).json({
      error: 'products_unavailable',
      message: 'Unable to fetch tracked products',
      items: [],
      total: 0
    });
  }
});

// Legacy endpoint alias
router.get('/products', (req, res) => {
  // Redirect to the main endpoint
  req.url = '/';
  router.handle(req, res);
});

export default router;