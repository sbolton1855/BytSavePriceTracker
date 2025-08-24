
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { emailService } from '../email/service';
import { db } from '../db';
import { trackedProducts, products } from '../../migrations/schema';
import { eq, and, lt } from 'drizzle-orm';

const router = Router();

// Force send price drop alerts
router.post('/force-alerts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, asin, testMode = false } = req.body;
    
    console.log('[force-alerts] Starting force alert process:', { email, asin, testMode });

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Build query conditions
    const conditions = [];
    if (email) {
      conditions.push(eq(trackedProducts.email, email.toUpperCase()));
    }
    if (asin) {
      conditions.push(eq(products.asin, asin));
    }

    // Get qualifying tracked products (where current price <= target price)
    const eligibleProducts = await db
      .select({
        trackedProduct: trackedProducts,
        product: products
      })
      .from(trackedProducts)
      .innerJoin(products, eq(trackedProducts.productId, products.id))
      .where(
        conditions.length > 0 
          ? and(...conditions, lt(products.currentPrice, trackedProducts.targetPrice))
          : lt(products.currentPrice, trackedProducts.targetPrice)
      )
      .limit(testMode ? 5 : 50);

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const { trackedProduct, product } of eligibleProducts) {
      try {
        console.log('[email-send]', { 
          to: trackedProduct.email, 
          templateId: 'price-drop', 
          isTest: false, 
          path: 'force' 
        });

        const result = await emailService.sendTemplate({
          to: trackedProduct.email,
          templateId: 'price-drop',
          data: {
            productTitle: product.title,
            oldPrice: trackedProduct.targetPrice.toString(),
            newPrice: product.currentPrice.toString(),
            productUrl: product.url,
            imageUrl: product.imageUrl,
            asin: product.asin
          },
          isTest: false,
          meta: {
            path: 'force',
            trackedProductId: trackedProduct.id,
            productId: product.id,
            forcedBy: 'admin'
          }
        });

        if (result.success) {
          successCount++;
          results.push({
            email: trackedProduct.email,
            asin: product.asin,
            status: 'sent',
            messageId: result.messageId
          });
        } else {
          errorCount++;
          results.push({
            email: trackedProduct.email,
            asin: product.asin,
            status: 'failed',
            error: result.error
          });
        }
      } catch (error) {
        console.error('[force-alerts] Error sending to:', trackedProduct.email, error);
        errorCount++;
        results.push({
          email: trackedProduct.email,
          asin: product.asin,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[force-alerts] Completed:', { total: eligibleProducts.length, successCount, errorCount });

    res.json({
      success: true,
      message: `Force alerts processed: ${successCount} sent, ${errorCount} failed`,
      stats: {
        total: eligibleProducts.length,
        sent: successCount,
        failed: errorCount,
        testMode
      },
      results: testMode ? results : results.slice(0, 10) // Limit results in response
    });

  } catch (error) {
    console.error('[force-alerts] Failed:', error);
    res.status(500).json({ 
      error: 'Failed to process force alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
