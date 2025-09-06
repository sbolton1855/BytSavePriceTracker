
import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { db } from '../db.js';
import { emailLogs } from '../../shared/schema.js';
import { desc, sql } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /api/email/test-db - Test database connection and show sample email logs
 */
router.get('/test-db', requireAdmin, async (req, res) => {
  try {
    console.log('🧪 Testing email logs database connection');

    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` }).from(emailLogs);
    const totalCount = Number(totalResult[0]?.count) || 0;

    // Get sample logs
    const sampleLogs = await db
      .select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.sentAt))
      .limit(5);

    console.log('📊 Database test results:', {
      totalCount,
      sampleCount: sampleLogs.length
    });

    res.json({
      tableExists: true,
      totalLogs: totalCount,
      sampleLogs: sampleLogs,
      message: `Email logs table accessible. Found ${totalCount} total logs.`
    });

  } catch (error) {
    console.error('❌ Email logs database test error:', error);
    res.status(500).json({
      tableExists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Email logs table may not exist or be accessible'
    });
  }
});

export default router;
