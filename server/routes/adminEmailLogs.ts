
import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { db } from '../db.js';
import { emailLogs } from '../../shared/schema.js';
import { desc, like, eq, sql } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /api/admin/logs - Fetch email logs with pagination and filtering
 */
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    console.log('📊 Admin email logs requested');
    
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 200); // Max 200 per page
    const emailFilter = req.query.email as string;
    const statusFilter = req.query.status as string;
    
    const offset = (page - 1) * limit;
    
    console.log('📋 Query params:', { page, limit, emailFilter, statusFilter });
    
    // Build where conditions based on filters
    const whereConditions = [];
    
    if (emailFilter) {
      whereConditions.push(like(emailLogs.recipientEmail, `%${emailFilter}%`));
    }
    
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push(eq(emailLogs.status, statusFilter));
    }
    
    // Get total count for pagination
    let totalCountQuery = db.select({ count: sql<number>`count(*)` }).from(emailLogs);
    
    if (whereConditions.length > 0) {
      const whereClause = whereConditions.reduce((acc, condition) => 
        acc ? sql`${acc} AND ${condition}` : condition
      );
      totalCountQuery = totalCountQuery.where(whereClause) as any;
    }
    
    const totalResult = await totalCountQuery;
    const total = Number(totalResult[0]?.count) || 0;
    const totalPages = Math.ceil(total / limit);
    
    // Get paginated results
    let query = db
      .select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.sentAt)) // Most recent first
      .limit(limit)
      .offset(offset);
    
    if (whereConditions.length > 0) {
      const whereClause = whereConditions.reduce((acc, condition) => 
        acc ? sql`${acc} AND ${condition}` : condition
      );
      query = query.where(whereClause) as any;
    }
    
    const logs = await query;
    
    console.log(`📊 Returning ${logs.length} email logs (page ${page}/${totalPages}, total: ${total})`);
    
    // Return structured response
    res.json({
      logs: logs,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages
      }
    });
    
  } catch (error) {
    console.error('❌ Email logs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch email logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
