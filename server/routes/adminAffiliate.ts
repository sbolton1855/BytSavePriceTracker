
import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { db } from '../db';
import { affiliateClicks } from '../../migrations/schema';
import { desc, count, sql, and, gte } from 'drizzle-orm';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /admin/api/affiliate/stats
router.get('/stats', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

    // Total clicks
    const totalClicks = await db
      .select({ count: count() })
      .from(affiliateClicks)
      .where(gte(affiliateClicks.clickedAt, daysAgo));

    // Clicks by ASIN
    const clicksByAsin = await db
      .select({
        asin: affiliateClicks.asin,
        clicks: count()
      })
      .from(affiliateClicks)
      .where(gte(affiliateClicks.clickedAt, daysAgo))
      .groupBy(affiliateClicks.asin)
      .orderBy(desc(count()))
      .limit(10);

    // Daily clicks
    const dailyClicks = await db
      .select({
        date: sql`DATE(${affiliateClicks.clickedAt})`,
        clicks: count()
      })
      .from(affiliateClicks)
      .where(gte(affiliateClicks.clickedAt, daysAgo))
      .groupBy(sql`DATE(${affiliateClicks.clickedAt})`)
      .orderBy(sql`DATE(${affiliateClicks.clickedAt}) DESC`);

    res.json({
      totalClicks: totalClicks[0]?.count || 0,
      clicksByAsin,
      dailyClicks,
      period: `${days} days`
    });

  } catch (error) {
    console.error('Affiliate stats error:', error);
    res.status(500).json({ error: 'Failed to fetch affiliate stats' });
  }
});

// GET /admin/api/affiliate/clicks
router.get('/clicks', async (req, res) => {
  try {
    const { page = '1', limit = '50', asin } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(affiliateClicks);

    if (asin) {
      query = query.where(sql`${affiliateClicks.asin} = ${asin}`);
    }

    const clicks = await query
      .orderBy(desc(affiliateClicks.clickedAt))
      .limit(limitNum)
      .offset(offset);

    const totalQuery = db.select({ count: count() }).from(affiliateClicks);
    const total = asin 
      ? await totalQuery.where(sql`${affiliateClicks.asin} = ${asin}`)
      : await totalQuery;

    res.json({
      clicks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total[0]?.count || 0,
        totalPages: Math.ceil((total[0]?.count || 0) / limitNum)
      }
    });

  } catch (error) {
    console.error('Affiliate clicks error:', error);
    res.status(500).json({ error: 'Failed to fetch affiliate clicks' });
  }
});

export default router;
