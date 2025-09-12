
import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// POST /api/admin/force-alerts/random - Trigger alert for random product
router.post('/random', requireAdmin, async (req, res) => {
  try {
    const { db } = await import('../db');
    const { trackedProducts, products } = await import('../../shared/schema');
    const { eq, and, desc } = await import('drizzle-orm');

    console.log('🔥 Force Alerts: Random mode triggered');

    // Get a random tracked product that hasn't been notified recently
    const availableProducts = await db
      .select({
        id: trackedProducts.id,
        email: trackedProducts.email,
        targetPrice: trackedProducts.targetPrice,
        productId: trackedProducts.productId,
        product: {
          id: products.id,
          title: products.title,
          asin: products.asin,
          currentPrice: products.currentPrice
        }
      })
      .from(trackedProducts)
      .innerJoin(products, eq(trackedProducts.productId, products.id))
      .where(eq(trackedProducts.notified, false))
      .orderBy(desc(trackedProducts.createdAt))
      .limit(10);

    if (availableProducts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No tracked products available for testing',
        message: 'All tracked products have already been notified or no products exist'
      });
    }

    // Pick random product from available ones
    const randomProduct = availableProducts[Math.floor(Math.random() * availableProducts.length)];

    // Trigger the price drop simulation first
    const dropResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/dev/drop-price/${randomProduct.id}?token=${process.env.ADMIN_SECRET}`);
    
    if (!dropResponse.ok) {
      throw new Error('Failed to setup price drop simulation');
    }

    // Then trigger the alerts
    const alertResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/run-daily-alerts?token=${process.env.ALERT_TRIGGER_TOKEN}`);
    
    if (!alertResponse.ok) {
      throw new Error('Failed to trigger daily alerts');
    }

    const alertResult = await alertResponse.json();

    console.log('✅ Force Alerts: Random alert triggered successfully');

    res.json({
      success: true,
      mode: 'random',
      productId: randomProduct.product.id,
      productTitle: randomProduct.product.title,
      asin: randomProduct.product.asin,
      email: randomProduct.email,
      alertsSent: alertResult.alertsProcessed || 1,
      message: 'Random price drop alert triggered successfully'
    });

  } catch (error) {
    console.error('❌ Force Alerts Random Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger random alert',
      mode: 'random'
    });
  }
});

// POST /api/admin/force-alerts/product - Trigger alert for specific product
router.post('/product', requireAdmin, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid product ID is required',
        mode: 'custom'
      });
    }

    console.log(`🔥 Force Alerts: Custom mode triggered for product ${productId}`);

    // Trigger the price drop simulation first
    const dropResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/dev/drop-price/${productId}?token=${process.env.ADMIN_SECRET}`);
    
    if (!dropResponse.ok) {
      const errorData = await dropResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to setup price drop simulation');
    }

    const dropResult = await dropResponse.json();

    // Then trigger the alerts
    const alertResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/run-daily-alerts?token=${process.env.ALERT_TRIGGER_TOKEN}`);
    
    if (!alertResponse.ok) {
      throw new Error('Failed to trigger daily alerts');
    }

    const alertResult = await alertResponse.json();

    console.log('✅ Force Alerts: Custom alert triggered successfully');

    res.json({
      success: true,
      mode: 'custom',
      productId: dropResult.data?.trackedProductId || productId,
      productTitle: dropResult.data?.productTitle || 'Unknown Product',
      asin: dropResult.data?.asin,
      email: dropResult.data?.email,
      alertsSent: alertResult.alertsProcessed || 1,
      message: `Price drop alert triggered for product ${productId}`
    });

  } catch (error) {
    console.error('❌ Force Alerts Custom Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger custom alert',
      mode: 'custom'
    });
  }
});

// POST /api/admin/force-alerts/all - Trigger all pending alerts (development only)
router.post('/all', requireAdmin, async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Bulk alert triggering is only available in development mode',
        mode: 'all'
      });
    }

    console.log('🔥 Force Alerts: All mode triggered (development only)');

    // Trigger all daily alerts directly
    const alertResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/run-daily-alerts?token=${process.env.ALERT_TRIGGER_TOKEN}`);
    
    if (!alertResponse.ok) {
      throw new Error('Failed to trigger daily alerts');
    }

    const alertResult = await alertResponse.json();

    console.log('✅ Force Alerts: All pending alerts triggered successfully');

    res.json({
      success: true,
      mode: 'all',
      alertsSent: alertResult.alertsProcessed || 0,
      message: `Triggered ${alertResult.alertsProcessed || 0} pending alerts`
    });

  } catch (error) {
    console.error('❌ Force Alerts All Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger all alerts',
      mode: 'all'
    });
  }
});

export default router;
