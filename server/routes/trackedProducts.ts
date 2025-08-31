import { Router } from 'express'
import { db } from '../db'
import { trackedProducts, products, users } from '../../migrations/schema'
import { eq, desc } from 'drizzle-orm'
import express from 'express'

const router = Router()

// Legacy alias for backwards compatibility
router.get('/products', (req: express.Request, res: express.Response) => {
  console.log('[tracked-products] Legacy /api/products called, redirecting to /api/tracked-products');
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(307, '/api/tracked-products' + queryString);
});

// GET /tracked-products - Retrieve tracked products for a user
router.get('/tracked-products', async (req: express.Request, res: express.Response) => {
  console.log('[tracked-products] hit', req.originalUrl)

  try {
    // For now, make this public - no auth required
    // TODO: Add auth check if needed: if (!req.user) return res.status(401).json({ error: 'unauthenticated' })

    if (!db) {
      console.log('[tracked-products] DB not available, returning empty fallback')
      return res.status(200).type('application/json').json({
        items: [],
        note: 'fallback_empty',
        error: true,
        updatedAt: new Date().toISOString()
      })
    }

    // Query tracked products with product details
    const trackedItems = await db
      .select({
        id: trackedProducts.id,
        asin: products.asin,
        title: products.title,
        image: products.imageUrl,
        currentPrice: products.currentPrice,
        targetPrice: trackedProducts.targetPrice,
        lastCheckedAt: products.lastChecked,
        createdAt: trackedProducts.createdAt
      })
      .from(trackedProducts)
      .leftJoin(products, eq(trackedProducts.productId, products.id))
      .orderBy(desc(trackedProducts.createdAt))
      .limit(50)

    const items = trackedItems.map(item => ({
      id: item.id,
      asin: item.asin || '',
      title: item.title || 'Unknown Product',
      image: item.image || '',
      currentPrice: item.currentPrice || 0,
      targetPrice: item.targetPrice,
      lastCheckedAt: item.lastCheckedAt ? new Date(item.lastCheckedAt).toISOString() : new Date().toISOString()
    }))

    res.status(200).type('application/json').json({
      items,
      updatedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[tracked-products] error:', error)
    res.status(200).type('application/json').json({
      items: [],
      note: 'fallback_empty',
      error: true,
      updatedAt: new Date().toISOString()
    })
  }
})

export default router