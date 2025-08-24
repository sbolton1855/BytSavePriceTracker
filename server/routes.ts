
import express from 'express';
import { Request, Response } from 'express';
import { db } from './db';
import { products, users, alerts, affiliateClicks } from '../migrations/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { addDays, isAfter, isBefore } from 'date-fns';
import * as amazonApi from './lib/amazonApi';
import { authenticateUser } from './middleware/adminSecurity';

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

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount route modules - SINGLE MOUNTS ONLY
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin', adminEmailRoutes);  // Single mount for all admin email routes
router.use('/admin/tools', adminToolsRoutes);
router.use('/admin/force-alerts', adminForceAlertsRoutes);
router.use('/amazon', amazonRoutes);
router.use('/deals', dealsRoutes);
router.use('/affiliate', affiliateRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/errors', errorsRoutes);
router.use('/health', systemHealthRoutes);
router.use('/email-test', emailTestRoutes);
router.use('/test', testRoutes);

// Legacy user routes (keep for backward compatibility)
router.get('/user', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { email } = req.user!;
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/user/products', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { email } = req.user!;
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const userAlerts = await db
      .select({
        alert: alerts,
        product: products
      })
      .from(alerts)
      .leftJoin(products, eq(alerts.productId, products.id))
      .where(eq(alerts.email, email.toUpperCase()))
      .orderBy(desc(alerts.createdAt));

    res.json(userAlerts);
  } catch (error) {
    console.error('Error fetching user products:', error);
    res.status(500).json({ error: 'Failed to fetch user products' });
  }
});

router.post('/user/alerts', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { email } = req.user!;
    const { asin, targetPrice } = req.body;
    
    if (!asin || !targetPrice) {
      return res.status(400).json({ error: 'ASIN and target price are required' });
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
      .from(alerts)
      .where(and(
        eq(alerts.email, email.toUpperCase()),
        eq(alerts.productId, product[0].id)
      ))
      .limit(1);

    if (existingAlert.length > 0) {
      // Update existing alert
      await db
        .update(alerts)
        .set({ targetPrice: parseFloat(targetPrice) })
        .where(eq(alerts.id, existingAlert[0].id));
      
      res.json({ message: 'Alert updated successfully' });
    } else {
      // Create new alert
      await db.insert(alerts).values({
        email: email.toUpperCase(),
        productId: product[0].id,
        targetPrice: parseFloat(targetPrice),
        percentageAlert: false,
        percentageThreshold: null,
        notified: false
      });
      
      res.json({ message: 'Alert created successfully' });
    }
  } catch (error) {
    console.error('Error creating/updating alert:', error);
    res.status(500).json({ error: 'Failed to create/update alert' });
  }
});

router.delete('/user/alerts/:alertId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { email } = req.user!;
    const alertId = parseInt(req.params.alertId);
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Verify the alert belongs to the user
    const alert = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.id, alertId),
        eq(alerts.email, email.toUpperCase())
      ))
      .limit(1);

    if (alert.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await db.delete(alerts).where(eq(alerts.id, alertId));
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
