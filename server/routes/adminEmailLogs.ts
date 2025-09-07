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

    // Return paginated results with metadata
    const response = {
      logs: logs,
      rows: logs, // Include both for compatibility
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages
      }
    };

    console.log(`📊 [DEBUG] Email logs query returned:`, {
      totalFound: total,
      resultsCount: logs.length,
      page: page,
      limit: limit
    });

    // Transform logs to match expected frontend format
    const transformedLogs = logs.map(log => ({
      id: log.id,
      recipientEmail: log.recipientEmail || log.toEmail,
      subject: log.subject,
      previewHtml: log.previewHtml || log.body,
      sentAt: log.sentAt,
      createdAt: log.sentAt,
      status: log.status || 'sent',
      type: log.type || 'other',
      sgMessageId: log.sgMessageId,
      updatedAt: log.updatedAt
    }));

    const finalResponse = {
      logs: transformedLogs,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages
      }
    };

    console.log(`📊 [DEBUG] Sending response with ${transformedLogs.length} logs`);
    res.json(finalResponse);

  } catch (error) {
    console.error('❌ Email logs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch email logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/logs/debug - Debug endpoint to test email logs
 */
router.get('/logs/debug', requireAdmin, async (req, res) => {
  try {
    console.log('🔍 Debug endpoint accessed');

    // Test database connection
    console.log('[DEBUG] Testing database connection...');
    
    // Check if email_logs table exists
    const tableCheck = await db.execute(sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='email_logs'
    `);
    console.log('[DEBUG] Table exists check:', tableCheck);

    // Get table schema
    const schemaCheck = await db.execute(sql`PRAGMA table_info(email_logs)`);
    console.log('[DEBUG] Table schema:', schemaCheck);

    // Get raw count using direct SQL
    const directCount = await db.execute(sql`SELECT COUNT(*) as count FROM email_logs`);
    console.log('[DEBUG] Direct count result:', directCount);

    // Get raw count using drizzle
    const countResult = await db.select({ count: sql`count(*)` }).from(emailLogs);
    const totalCount = Number(countResult[0]?.count) || 0;
    console.log('[DEBUG] Drizzle count result:', countResult);

    // Get latest 10 logs without any filters
    const debugLogs = await db
      .select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.sentAt))
      .limit(10);

    console.log('[DEBUG] Raw database response:', debugLogs);
    console.log('[DEBUG] Total count:', totalCount);

    // Check if any logs exist using raw SQL
    const rawLogs = await db.execute(sql`
      SELECT * FROM email_logs 
      ORDER BY sent_at DESC 
      LIMIT 5
    `);
    console.log('[DEBUG] Raw SQL logs:', rawLogs);

    res.json({
      success: true,
      tableExists: tableCheck.length > 0,
      tableSchema: schemaCheck,
      totalCount: totalCount,
      directCount: directCount,
      sampleLogs: debugLogs,
      rawLogs: rawLogs,
      message: `Found ${totalCount} total logs in database`
    });

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router;