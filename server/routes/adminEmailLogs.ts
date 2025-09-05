
/**
 * Admin Email Logs API Routes
 * 
 * Purpose:
 * - Provide paginated email logs data for admin interface
 * - Support filtering by email address and status
 * - Return structured data for frontend table display
 * 
 * Endpoints:
 * - GET /api/admin/logs - Fetch paginated email logs with optional filters
 * 
 * Maintainer Notes:
 * - Results are ordered by most recent first (sent_at DESC)
 * - Pagination prevents performance issues with large log tables
 * - Filtering helps admins troubleshoot specific email issues
 */

import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { db } from '../db';
import { emailLogs } from '../../shared/schema';
import { desc, like, eq, sql } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /api/admin/logs
 * 
 * Fetch email logs with pagination and filtering
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 20, max: 100)
 * - email: Filter by recipient email (partial match)
 * - status: Filter by exact status
 */
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    console.log('📊 [DEBUG] Admin email logs route FIRED');
    console.log('📊 [DEBUG] Request query params:', req.query);
    console.log('📊 [DEBUG] Request headers:', req.headers);
    
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
    const emailFilter = req.query.email as string;
    const statusFilter = req.query.status as string;
    
    const offset = (page - 1) * limit;
    
    console.log('📋 [DEBUG] Parsed query params:', { page, limit, emailFilter, statusFilter, offset });
    
    // Build where conditions based on filters
    const whereConditions = [];
    
    if (emailFilter) {
      whereConditions.push(like(emailLogs.recipientEmail, `%${emailFilter}%`));
    }
    
    if (statusFilter) {
      whereConditions.push(eq(emailLogs.status, statusFilter));
    }
    
    // Combine where conditions
    const whereClause = whereConditions.length > 0 
      ? whereConditions.reduce((acc, condition) => sql`${acc} AND ${condition}`)
      : undefined;
    
    // Get total count for pagination
    const totalCountQuery = whereClause 
      ? db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(emailLogs);
    
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
    
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    
    const logs = await query;
    
    console.log(`📊 [DEBUG] Database query executed successfully`);
    console.log(`📊 [DEBUG] Found ${logs.length} email logs (page ${page}/${totalPages})`);
    console.log(`📊 [DEBUG] First log entry:`, logs[0] || 'No logs found');
    console.log(`📊 [DEBUG] Total count from DB:`, total);
    
    // Return structured response
    const responseData = {
      logs: logs,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages
      }
    };
    
    console.log(`📊 [DEBUG] Sending response:`, JSON.stringify(responseData, null, 2));
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Email logs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch email logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
