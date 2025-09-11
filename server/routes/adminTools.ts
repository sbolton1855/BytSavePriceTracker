import express from 'express';
import { cache } from '../lib/cache';
import { metrics } from '../lib/metrics';
import { getProductInfo } from '../amazonApi';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq, desc, asc, or, ilike, sql } from 'drizzle-orm';
// Assuming requireAdmin middleware is correctly exported from '../middleware/adminAuth'
import { requireAdmin } from '../middleware/adminAuth';

const router = express.Router();

// Clear cache
router.post('/admin/cache/clear', async (req, res) => {
  try {
    await cache.clear();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to clear cache'
    });
  }
});

// Get cache stats
router.get('/admin/cache/stats', (req, res) => {
  try {
    const stats = {
      items: Object.keys(cache.getAll()).length,
      efficiency: metrics.getCacheEfficiency(),
      hits: metrics.getMetrics().cacheHits,
      misses: metrics.getMetrics().cacheMisses
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get cache stats'
    });
  }
});

// ASIN Inspector
router.get('/admin/asin/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const forceRefresh = req.query.force === 'true';

    // Clear cache for this ASIN if force refresh
    if (forceRefresh) {
      await cache.del(`product:${asin}`);
    }

    // Get product info
    const product = await getProductInfo(asin);

    // Get price history
    const priceHistory = cache.getPriceHistory(asin);

    // Get cache status
    const cacheStatus = {
      inCache: cache.getProduct(asin) !== undefined,
      lastUpdated: new Date().toISOString(), // Simplified for now
      priceDrops: metrics.getPriceDrops()
        .filter(drop => drop.asin === asin)
    };

    res.json({
      product,
      priceHistory,
      cacheStatus
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to inspect ASIN'
    });
  }
});

// Force price recheck for multiple ASINs
router.post('/admin/recheck-prices', async (req, res) => {
  try {
    const { asins } = req.body as { asins: string[] };

    if (!Array.isArray(asins)) {
      return res.status(400).json({ error: 'asins must be an array' });
    }

    // Clear cache for these ASINs
    for (const asin of asins) {
      await cache.del(`product:${asin}`);
    }

    // Fetch fresh data
    const results = await Promise.allSettled(
      asins.map(asin => getProductInfo(asin))
    );

    const response = results.map((result, index) => ({
      asin: asins[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to recheck prices'
    });
  }
});

// GET /api/admin/products - Fetch tracked products with pagination and sorting
router.get('/admin/products', requireAdmin, async (req, res) => {
  console.log('Admin products endpoint accessed with query:', req.query);

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';

    const offset = (page - 1) * limit;

    // Build the base query
    let query = db
      .select({
        id: schema.trackedProducts.id,
        userId: schema.trackedProducts.userId,
        email: schema.trackedProducts.email,
        productId: schema.trackedProducts.productId,
        targetPrice: schema.trackedProducts.targetPrice,
        percentageAlert: schema.trackedProducts.percentageAlert,
        percentageThreshold: schema.trackedProducts.percentageThreshold,
        notified: schema.trackedProducts.notified,
        createdAt: schema.trackedProducts.createdAt,
        product: {
          id: schema.products.id,
          asin: schema.products.asin,
          title: schema.products.title,
          url: schema.products.url,
          imageUrl: schema.products.imageUrl,
          currentPrice: schema.products.currentPrice,
          originalPrice: schema.products.originalPrice,
          lastChecked: schema.products.lastChecked,
          lowestPrice: schema.products.lowestPrice,
          highestPrice: schema.products.highestPrice,
          priceDropped: schema.products.priceDropped,
          createdAt: schema.products.createdAt,
          updatedAt: schema.products.updatedAt,
        }
      })
      .from(schema.trackedProducts)
      .leftJoin(
        schema.products,
        eq(schema.trackedProducts.productId, schema.products.id)
      );

    // Build where conditions
    const conditions = [];

    // Add search filter if provided
    if (search) {
      conditions.push(
        or(
          ilike(schema.products.title, `%${search}%`),
          ilike(schema.products.asin, `%${search}%`),
          ilike(schema.trackedProducts.email, `%${search}%`)
        )
      );
    }

    // Add status filter if provided
    if (status) {
      if (status === 'active') {
        conditions.push(eq(schema.trackedProducts.notified, false));
      } else if (status === 'paused' || status === 'notified') {
        conditions.push(eq(schema.trackedProducts.notified, true));
      }
    }

    // Apply where conditions
    if (conditions.length > 0) {
      if (conditions.length === 1) {
        query = query.where(conditions[0]);
      } else {
        query = query.where(sql`${conditions.join(' AND ')}`);
      }
    }

    // Add sorting
    const sortColumn = sortBy === 'title' ? schema.products.title :
                      sortBy === 'asin' ? schema.products.asin :
                      sortBy === 'price' || sortBy === 'currentPrice' ? schema.products.currentPrice :
                      sortBy === 'lastChecked' ? schema.products.lastChecked :
                      schema.trackedProducts.createdAt;

    if (sortOrder === 'desc') {
      query = query.orderBy(desc(sortColumn));
    } else {
      query = query.orderBy(asc(sortColumn));
    }

    // Get total count for pagination with same filters
    let totalCountQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.trackedProducts)
      .leftJoin(
        schema.products,
        eq(schema.trackedProducts.productId, schema.products.id)
      );

    // Apply same where conditions to count query
    if (conditions.length > 0) {
      if (conditions.length === 1) {
        totalCountQuery = totalCountQuery.where(conditions[0]);
      } else {
        totalCountQuery = totalCountQuery.where(sql`${conditions.join(' AND ')}`);
      }
    }

    const [trackedProducts, totalCount] = await Promise.all([
      query.limit(limit).offset(offset),
      totalCountQuery
    ]);

    const total = totalCount[0]?.count || 0;

    // Return in the requested format
    res.json({
      products: trackedProducts,
      total
    });
  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ error: 'Failed to fetch tracked products' });
  }
});

export default router;