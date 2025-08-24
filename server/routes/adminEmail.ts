import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { listTemplates, renderTemplate } from '../email/templates';
import { sendEmail } from '../emailService';

const router = express.Router();

// GET /api/admin/email-templates
router.get('/email-templates', requireAdmin, (req, res) => {
  console.log('📧 Admin email templates requested');
  res.json(listTemplates());
});

// GET /api/admin/email/preview/:id
router.get('/email/preview/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  console.log('👁️ Admin email preview requested for:', id);

  const result = renderTemplate(id);
  if (!result) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(result);
});

// POST /api/admin/send-test-email
router.post('/send-test-email', requireAdmin, async (req, res) => {
  try {
    const { email, templateId, data } = req.body;
    console.log('📤 Admin test email send requested:', { email, templateId });

    if (!email || !templateId) {
      return res.status(400).json({
        error: 'Missing required fields: email, templateId'
      });
    }

    const rendered = renderTemplate(templateId, data);
    if (!rendered) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let emailSent = false;
    // Send the email
    if (app.locals.emailService?.send) {
      await app.locals.emailService.send({
        to: email,
        from: 'alerts@bytsave.com',
        subject: rendered.subject,
        html: rendered.html
      });
      emailSent = true;
      console.log(`✅ Test email sent to ${email} using template ${templateId}`);
    } else {
      console.log(`📧 [STUB] Would send email to ${email}:`, {
        subject: rendered.subject,
        template: templateId
      });
    }

    // Always log the email attempt to database
    try {
      const { db } = await import('../db');
      const { emailLogs } = await import('../../shared/schema');
      const emailLog = await db.insert(emailLogs).values({
        toEmail: email,
        fromEmail: 'alerts@bytsave.com',
        subject: rendered.subject,
        body: rendered.html,
        templateId: templateId,
        status: emailSent ? 'sent' : 'stubbed',
        sentAt: new Date(),
        metadata: JSON.stringify({
          templateData: data || {},
          adminTest: true,
          emailService: emailSent ? 'sendgrid' : 'stub'
        })
      }).returning();

      console.log(`📋 Email logged to database:`, emailLog[0]);
    } catch (logError) {
      console.error('❌ Failed to log email to database:', logError);
    }

    res.json({
      success: true,
      message: emailSent ? 'Test email sent successfully' : 'Email service not configured - stub mode',
      logged: true
    });

  } catch (error) {
    console.error('❌ Send test email error:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/admin/logs/debug - Debug email logs table
router.get('/logs/debug', requireAdmin, async (req, res) => {
  try {
    const { db } = await import('../db');
    const { emailLogs } = await import('../../shared/schema');
    const { sql } = await import('drizzle-orm');

    // Check if table exists and get sample data
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM email_logs
    `);

    const sampleLogs = await db
      .select()
      .from(emailLogs)
      .limit(5);

    console.log('📧 Email logs debug - count:', result.rows[0], 'sample:', sampleLogs.length);

    res.json({
      tableExists: true,
      totalLogs: result.rows[0],
      sampleLogs: sampleLogs,
      message: 'Email logs table is accessible'
    });

  } catch (error) {
    console.error('❌ Email logs debug error:', error);
    res.json({
      tableExists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Email logs table may not exist'
    });
  }
});

// POST /api/admin/logs/test - Manually test email logging
router.post('/logs/test', requireAdmin, async (req, res) => {
  try {
    const { db } = await import('../db');
    const { emailLogs } = await import('../../shared/schema');

    console.log('🧪 Testing manual email log insertion');

    const testLogData = {
      recipientEmail: 'test@example.com',
      subject: '[MANUAL TEST] Email Log Test',
      previewHtml: '<p>This is a manual test of email logging functionality</p>',
      sentAt: new Date(),
      createdAt: new Date()
    };

    const logResult = await db.insert(emailLogs).values(testLogData);

    console.log('✅ Manual email log test successful:', logResult);

    res.json({
      success: true,
      message: 'Manual email log inserted successfully',
      testData: testLogData
    });

  } catch (error) {
    console.error('❌ Manual email log test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Manual email log test failed'
    });
  }
});

export default router;