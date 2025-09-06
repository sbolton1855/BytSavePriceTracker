
// TEMP DEBUG – remove after verification

import express from 'express';
import { ensureEmailLogsTable } from '../db/ensureEmailLogs';
import { db } from '../db';

const router = express.Router();

router.get('/test-db', async (req, res) => {
  console.log('[emailTestDb] Starting database sanity check...');
  
  try {
    // Ensure table exists
    await ensureEmailLogsTable();
    
    // Insert test row
    const testRecord = {
      recipient_email: 'test@example.com',
      subject: 'Sanity Check Email',
      status: 'pending',
      sg_message_id: `sanity-${Date.now()}`
    };

    console.log('[emailTestDb] Inserting test record:', testRecord);

    const insertResult = await db.execute(`
      INSERT INTO email_logs (recipient_email, subject, status, sg_message_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, recipient_email, subject, status, sg_message_id, sent_at
    `, [
      testRecord.recipient_email,
      testRecord.subject,
      testRecord.status,
      testRecord.sg_message_id
    ]);

    // Get recent 5 rows
    const recentResult = await db.execute(`
      SELECT id, recipient_email, subject, status, sg_message_id, sent_at
      FROM email_logs
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log('[emailTestDb] Database sanity check completed successfully');

    res.json({
      inserted: insertResult.rows?.[0] || null,
      recent: recentResult.rows || []
    });

  } catch (error) {
    console.error('[emailTestDb] Database sanity check failed:', error);
    res.status(500).json({
      error: 'Database sanity check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
