import express from 'express';
import { Request, Response } from 'express';
import { db } from './db';
import { products, users, trackedProducts, affiliateClicks } from '../migrations/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { addDays, isAfter, isBefore } from 'date-fns';
import * as amazonApi from './lib/amazonApi';
import { requireAdmin } from './middleware/requireAdmin';

// Import route modules
import adminAuthRoutes from './routes/adminAuth';
import adminEmailRoutes from './routes/adminEmail';
import adminToolsRoutes from './routes/adminTools';
import adminForceAlertsRoutes from './routes/adminForceAlerts';
import amazonRoutes from './routes/amazon';
import dealsRoutes from './routes/deals';
import affiliateRoutes from './routes/affiliate';
import analyticsRoutes from './routes/analytics';
import errorsRoutes from './routes/errors';
import systemHealthRoutes from './routes/systemHealth';
import emailTestRoutes from './routes/emailTest';
import testRoutes from './routes/test';

const router = express.Router();

// Debug middleware to log all API requests
router.use('*', (req: Request, res: Response, next) => {
  console.log(`[DEBUG] API Request: ${req.method} ${req.originalUrl}`);
  console.log(`[DEBUG] API Request path: ${req.path}`);
  console.log(`[DEBUG] API Request base URL: ${req.baseUrl}`);
  next();
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount route modules - SINGLE MOUNTS ONLY
console.log('>>> [DEBUG] Mounting routes...');
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin', adminEmailRoutes);  // Single mount for all admin email routes
router.use('/admin/tools', adminToolsRoutes);
router.use('/admin/force-alerts', adminForceAlertsRoutes);
router.use('/amazon', amazonRoutes);
console.log('>>> [DEBUG] Amazon routes mounted at /amazon');
console.log('>>> [DEBUG] This means /api/amazon/deals should work');
console.log('>>> [DEBUG] Amazon routes module loaded

console.log('>>> [DEBUG] Routes.ts - Setting up all API routes...');

// Add health check route for debugging
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    endpoints: ['/api/amazon/deals', '/api/tracked-products', '/api/products']
  });
});');
router.use('/deals', dealsRoutes);
router.use('/affiliate', affiliateRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/errors', errorsRoutes);
router.use('/health', systemHealthRoutes);
router.use('/email-test', emailTestRoutes);
router.use('/test', testRoutes);

// Legacy user routes (keep for backward compatibility)
router.get('/user', requireAdmin, async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const user = await db.select().from(users).where(eq(users.email, email.toUpperCase())).limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/user/products', requireAdmin, async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const userAlerts = await db
      .select({
        alert: trackedProducts,
        product: products
      })
      .from(trackedProducts)
      .leftJoin(products, eq(trackedProducts.productId, products.id))
      .where(eq(trackedProducts.email, email.toUpperCase()))
      .orderBy(desc(trackedProducts.createdAt));

    res.json(userAlerts);
  } catch (error) {
    console.error('Error fetching user products:', error);
    res.status(500).json({ error: 'Failed to fetch user products' });
  }
});

router.post('/user/alerts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, asin, targetPrice } = req.body;

    if (!email || !asin || !targetPrice) {
      return res.status(400).json({ error: 'Email, ASIN and target price are required' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Check if product exists, if not fetch from Amazon
    let product = await db.select().from(products).where(eq(products.asin, asin)).limit(1);

    if (product.length === 0) {
      // Fetch product from Amazon
      try {
        const amazonProduct = await amazonApi.searchProducts(asin);
        if (amazonProduct.length === 0) {
          return res.status(404).json({ error: 'Product not found on Amazon' });
        }

        const newProduct = {
          asin: amazonProduct[0].asin,
          title: amazonProduct[0].title,
          url: amazonProduct[0].url,
          imageUrl: amazonProduct[0].imageUrl,
          currentPrice: amazonProduct[0].currentPrice,
          originalPrice: amazonProduct[0].originalPrice || amazonProduct[0].currentPrice,
          lastChecked: new Date(),
          lowestPrice: amazonProduct[0].currentPrice,
          highestPrice: amazonProduct[0].currentPrice,
          priceDropped: false
        };

        await db.insert(products).values(newProduct);
        product = [newProduct as any];
      } catch (error) {
        console.error('Error fetching product from Amazon:', error);
        return res.status(500).json({ error: 'Failed to fetch product from Amazon' });
      }
    }

    // Check if alert already exists
    const existingAlert = await db
      .select()
      .from(trackedProducts)
      .where(and(
        eq(trackedProducts.email, email.toUpperCase()),
        eq(trackedProducts.productId, product[0].id)
      ))
      .limit(1);

    if (existingAlert.length > 0) {
      // Update existing alert
      await db
        .update(trackedProducts)
        .set({ targetPrice: parseFloat(targetPrice) })
        .where(eq(trackedProducts.id, existingAlert[0].id));

      res.json({ message: 'Alert updated successfully' });
    } else {
      // Create new alert
      await db.insert(trackedProducts).values({
        email: email.toUpperCase(),
        productId: product[0].id,
        targetPrice: parseFloat(targetPrice),
        percentageAlert: false,
        percentageThreshold: null,
        notified: false,
        createdAt: new Date().toISOString()
      });

      res.json({ message: 'Alert created successfully' });
    }
  } catch (error) {
    console.error('Error creating/updating alert:', error);
    res.status(500).json({ error: 'Failed to create/update alert' });
  }
});

router.delete('/user/alerts/:alertId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    const alertId = parseInt(req.params.alertId);

    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Verify the alert belongs to the user
    const alert = await db
      .select()
      .from(trackedProducts)
      .where(and(
        eq(trackedProducts.id, alertId),
        eq(trackedProducts.email, email.toUpperCase())
      ))
      .limit(1);

    if (alert.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await db.delete(trackedProducts).where(eq(trackedProducts.id, alertId));
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export function registerRoutes(app: any) {
  app.use('/api', router);
  return app;
}

export default router;