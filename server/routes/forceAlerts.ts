
import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// GET /api/admin/products - Get products for selection dropdown
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const { db } = await import('../db');
    const { products } = await import('../../shared/schema');
    const { desc } = await import('drizzle-orm');

    const productList = await db
      .select({
        id: products.id,
        asin: products.asin,
        title: products.title,
        currentPrice: products.currentPrice
      })
      .from(products)
      .orderBy(desc(products.updatedAt))
      .limit(100);

    res.json({
      success: true,
      products: productList
    });

  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch products'
    });
  }
});

// POST /api/admin/force-alerts/random - Trigger alert for random product
router.post('/random', requireAdmin, async (req, res) => {
  try {
    const { testRecipient } = req.body;
    const { db } = await import('../db');
    const { trackedProducts, products } = await import('../../shared/schema');
    const { eq, and, desc } = await import('drizzle-orm');
    const { sendPriceDropAlert } = await import('../emailService');

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
          currentPrice: products.currentPrice,
          originalPrice: products.originalPrice,
          imageUrl: products.imageUrl,
          url: products.url
        }
      })
      .from(trackedProducts)
      .innerJoin(products, eq(trackedProducts.productId, products.id))
      .limit(50);

    if (availableProducts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No tracked products available for testing',
        message: 'No products exist in the database'
      });
    }

    // Pick random product from available ones
    const randomProduct = availableProducts[Math.floor(Math.random() * availableProducts.length)];

    // Send alert directly to test recipient
    const recipient = testRecipient || randomProduct.email;
    console.log(`📧 Sending test alert to: ${recipient}`);

    const success = await sendPriceDropAlert(
      recipient,
      randomProduct.product,
      randomProduct
    );

    if (!success) {
      throw new Error('Failed to send test alert email');
    }

    console.log('✅ Force Alerts: Random alert sent successfully');

    res.json({
      success: true,
      mode: 'random',
      productId: randomProduct.product.id,
      productTitle: randomProduct.product.title,
      asin: randomProduct.product.asin,
      recipient: recipient,
      alertsSent: 1,
      message: 'Random price drop alert sent successfully'
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
    const { productId, asin, testRecipient } = req.body;
    const { db } = await import('../db');
    const { trackedProducts, products } = await import('../../shared/schema');
    const { eq, or } = await import('drizzle-orm');
    const { sendPriceDropAlert } = await import('../emailService');

    if (!productId && !asin) {
      return res.status(400).json({
        success: false,
        error: 'Either product ID or ASIN is required',
        mode: 'custom'
      });
    }

    console.log(`🔥 Force Alerts: Custom mode triggered for ${productId ? `product ID ${productId}` : `ASIN ${asin}`}`);

    // Find the product by ID or ASIN
    let whereCondition;
    if (productId) {
      whereCondition = eq(products.id, productId);
    } else {
      whereCondition = eq(products.asin, asin);
    }

    const productResult = await db
      .select()
      .from(products)
      .where(whereCondition)
      .limit(1);

    if (productResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Product not found with ${productId ? 'ID' : 'ASIN'}: ${productId || asin}`,
        mode: 'custom'
      });
    }

    const product = productResult[0];

    // Find a tracked product for this product (or create a mock one)
    const trackedResult = await db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.productId, product.id))
      .limit(1);

    let trackedProduct;
    if (trackedResult.length > 0) {
      trackedProduct = trackedResult[0];
    } else {
      // Create a mock tracked product for testing
      trackedProduct = {
        id: 0,
        email: testRecipient || process.env.ADMIN_EMAIL || 'admin@example.com',
        productId: product.id,
        targetPrice: product.currentPrice * 0.9, // 10% discount threshold
        percentageAlert: false,
        percentageThreshold: null,
        notified: false,
        createdAt: new Date(),
        userId: null
      };
    }

    // Send alert to test recipient
    const recipient = testRecipient || trackedProduct.email;
    console.log(`📧 Sending test alert to: ${recipient}`);

    const success = await sendPriceDropAlert(
      recipient,
      product,
      trackedProduct
    );

    if (!success) {
      throw new Error('Failed to send test alert email');
    }

    console.log('✅ Force Alerts: Custom alert sent successfully');

    res.json({
      success: true,
      mode: 'custom',
      productId: product.id,
      productTitle: product.title,
      asin: product.asin,
      recipient: recipient,
      alertsSent: 1,
      message: `Price drop alert sent for ${product.title}`
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

    const { testRecipient } = req.body;
    console.log('🔥 Force Alerts: All mode triggered (development only)');

    // In development with test recipient, we need to override the email trigger process
    if (testRecipient) {
      const { db } = await import('../db');
      const { trackedProducts, products } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      const { sendPriceDropAlert } = await import('../emailService');
      const { shouldTriggerAlert } = await import('../emailTrigger');

      // Get all tracked products that would trigger alerts
      const allTrackedProducts = await db
        .select({
          id: trackedProducts.id,
          email: trackedProducts.email,
          targetPrice: trackedProducts.targetPrice,
          productId: trackedProducts.productId,
          notified: trackedProducts.notified,
          percentageAlert: trackedProducts.percentageAlert,
          percentageThreshold: trackedProducts.percentageThreshold,
          product: {
            id: products.id,
            title: products.title,
            asin: products.asin,
            currentPrice: products.currentPrice,
            originalPrice: products.originalPrice,
            imageUrl: products.imageUrl,
            url: products.url,
            highestPrice: products.highestPrice
          }
        })
        .from(trackedProducts)
        .innerJoin(products, eq(trackedProducts.productId, products.id));

      let alertsSent = 0;
      
      for (const trackedProduct of allTrackedProducts) {
        if (shouldTriggerAlert(trackedProduct.product, trackedProduct)) {
          console.log(`📧 Sending test alert to: ${testRecipient} for product: ${trackedProduct.product.title}`);
          
          const success = await sendPriceDropAlert(
            testRecipient,
            trackedProduct.product,
            trackedProduct
          );
          
          if (success) {
            alertsSent++;
          }
        }
      }

      console.log(`✅ Force Alerts: Sent ${alertsSent} test alerts to ${testRecipient}`);

      res.json({
        success: true,
        mode: 'all',
        alertsSent: alertsSent,
        recipient: testRecipient,
        message: `Sent ${alertsSent} test alerts to ${testRecipient}`
      });

    } else {
      // Trigger normal daily alerts process
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
    }

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
