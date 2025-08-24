import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { logEmail } from '../email/logEmail';
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';
import { eq, desc, and, like, count } from 'drizzle-orm';

// Import actual templates from templates.ts
import { getEmailTemplate, getAllEmailTemplates, renderTemplate as renderTemplateFromModule } from '../email/templates';
import sendgridTemplatesRoutes from './sendgridTemplates';

const renderTemplate = (templateId: string, data?: Record<string, any>) => {
  const result = renderTemplateFromModule(templateId, data);
  if (!result) return null;
  
  return {
    templateId,
    subject: result.subject,
    html: result.html,
    text: 'Plain text version of the email.', // Placeholder
    variables: Object.keys(data || {})
  };
};

const router = Router();

// Test endpoint to verify routes are working
router.get('/test', (req: Request, res: Response) => {
  res.json({ 
    message: 'Admin email routes working',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /api/admin/templates',
      'GET /api/admin/preview/:templateId', 
      'POST /api/admin/preview',
      'POST /api/admin/send-test-email',
      'GET /api/admin/email-logs'
    ]
  });
});

// Email templates endpoint
router.get('/templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { listTemplates } = await import('../email/templates');
    const templates = listTemplates();
    console.log('[email-templates] ok', { count: templates.length });
    res.json({ templates });
  } catch (error) {
    console.error('[email-templates] Error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Preview email template - GET method
router.get('/preview/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id;
    console.log('[email-preview] hit', 'GET', { id: templateId, hasData: false });

    const template = getEmailTemplate(templateId);
    if (!template) {
      console.warn('[email-preview] missing', { id: templateId });
      return res.status(404).json({ error: 'template_not_found' });
    }

    const rendered = renderTemplate(templateId, template.previewData || template.defaults);
    if (!rendered) {
      return res.status(500).json({ error: 'Failed to render template' });
    }

    console.log('[email-preview] ok', { id: templateId, subjectLen: rendered.subject.length, htmlLen: rendered.html.length });
    res.json(rendered);
  } catch (error) {
    console.error('[email-preview] Error:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// Preview email template - POST method with custom data
router.post('/preview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { templateId, data } = req.body;
    console.log('[email-preview] hit', 'POST', { id: templateId, hasData: !!data });

    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    const template = getEmailTemplate(templateId);
    if (!template) {
      console.warn('[email-preview] missing', { id: templateId });
      return res.status(404).json({ error: 'template_not_found' });
    }

    // Merge template's defaults/previewData with provided data
    const baseData = template.previewData || template.defaults;
    const mergedData = { ...baseData, ...(data || {}) };
    const rendered = renderTemplate(templateId, mergedData);

    if (!rendered) {
      return res.status(500).json({ error: 'Failed to render template' });
    }

    console.log('[email-preview] ok', { id: templateId, subjectLen: rendered.subject.length, htmlLen: rendered.html.length });
    res.json(rendered);
  } catch (error) {
    console.error('[email-preview] Error:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// Send test email endpoint
router.post('/send-test-email', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { templateId, to, data } = req.body;

    if (!templateId || !to) {
      return res.status(400).json({ error: 'Template ID and recipient email are required' });
    }

    // Import new SendGrid service
    const { sendTemplate } = await import('../email/service');

    // Send test email using centralized SendGrid service
    const result = await sendTemplate({
      to,
      templateId,
      data: data || {},
      isTest: true,
      meta: { 
        path: 'admin-test',
        adminUser: 'admin'
      }
    });

    console.log(`[admin-email] Test email sent for template ${templateId} to ${to}:`, result.success);

    if (result.success) {
      res.json({ 
        success: true, 
        message: `Test email for template '${templateId}' sent successfully`,
        messageId: result.messageId,
        sgMessageId: result.sgMessageId,
        logId: result.logId,
        provider: result.provider,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send test email',
        details: result.error,
        provider: result.provider
      });
    }
  } catch (error) {
    console.error('[admin-email] Test email failed:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Email logs endpoint - THE ONLY LOGS ROUTE
router.get('/email-logs', requireAdmin, async (req: Request, res: Response) => {
  console.log('[email-logs] hit', req.originalUrl, { 
    hasHeader: !!req.headers['x-admin-token'], 
    hasQuery: !!req.query.token 
  });

  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);
    const status = req.query.status as string; // sent|failed|processed|all (default all)
    const isTest = req.query.isTest as string; // true|false|all (default all)
    const to = req.query.to as string;
    const templateId = req.query.templateId as string;

    console.log('[email-logs] query', { page, pageSize, status, isTest, to, templateId });

    // Check if we have DB available, fallback to in-memory if not
    if (!db) {
      console.log('[email-logs] DB not available, using in-memory fallback');
      const app = req.app;
      if (!app.locals.emailLogs) {
        app.locals.emailLogs = [];
      }

      let items = [...app.locals.emailLogs];

      // Apply filters for in-memory data
      if (status && status !== 'all') {
        items = items.filter(item => item.status === status);
      }
      if (isTest && isTest !== 'all') {
        const testFilter = isTest === 'true';
        items = items.filter(item => item.isTest === testFilter);
      }
      if (to) {
        items = items.filter(item => item.to && item.to.toLowerCase().includes(to.toLowerCase()));
      }
      if (templateId) {
        items = items.filter(item => item.templateId === templateId);
      }

      // Apply pagination
      const total = items.length;
      const offset = (page - 1) * pageSize;
      items = items.slice(offset, offset + pageSize);

      console.log('[email-logs] ok', { count: items.length, total, source: 'memory' });

      return res.json({
        items,
        page,
        pageSize,
        total
      });
    }

    // Build where conditions for database
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(emailLogs.status, status));
    }

    if (isTest && isTest !== 'all') {
      conditions.push(eq(emailLogs.isTest, isTest === 'true'));
    }

    if (to) {
      conditions.push(like(emailLogs.to, `%${to}%`));
    }

    if (templateId) {
      conditions.push(eq(emailLogs.templateId, templateId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db.select({ count: count() }).from(emailLogs).where(whereClause);
    const total = totalResult[0]?.count || 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const items = await db
      .select()
      .from(emailLogs)
      .where(whereClause)
      .orderBy(desc(emailLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    console.log('[email-logs] ok', { count: items.length, total, source: 'db' });

    res.json({
      items,
      page,
      pageSize,
      total
    });
  } catch (error) {
    console.error('[email-logs] fail', error?.message, error);

    // Never 500 the UI - return empty results with fallback note
    res.json({
      items: [],
      page: parseInt(req.query.page as string) || 1,
      pageSize: Math.min(parseInt(req.query.pageSize as string) || 25, 100),
      total: 0,
      note: 'fallback_empty_due_to_error'
    });
  }
});

// Debug endpoint to check email logs counts
router.get('/_debug/email-logs-counts', requireAdmin, async (req: Request, res: Response) => {
  console.log('[debug-logs] hit', req.originalUrl);
  
  try {
    let dbCount = 0;
    let memCount = 0;
    let latest = null;

    // Check database
    if (db) {
      try {
        const dbResult = await db.select({ count: count() }).from(emailLogs);
        dbCount = dbResult[0]?.count || 0;

        if (dbCount > 0) {
          const latestDb = await db
            .select({
              to: emailLogs.to,
              templateId: emailLogs.templateId,
              status: emailLogs.status,
              createdAt: emailLogs.createdAt
            })
            .from(emailLogs)
            .orderBy(desc(emailLogs.createdAt))
            .limit(1);
          
          if (latestDb.length > 0) {
            latest = latestDb[0];
          }
        }
      } catch (dbError) {
        console.error('[debug-logs] DB error:', dbError);
      }
    }

    // Check in-memory
    const app = req.app;
    if (app && app.locals && app.locals.emailLogs) {
      memCount = app.locals.emailLogs.length;
      
      if (memCount > 0 && !latest) {
        const latestMem = app.locals.emailLogs[0];
        latest = {
          to: latestMem.to,
          templateId: latestMem.templateId,
          status: latestMem.status,
          createdAt: latestMem.createdAt
        };
      }
    }

    console.log('[debug-logs] ok', { dbCount, memCount, latest });

    res.json({
      dbCount,
      memCount,
      latest,
      hasDatabase: !!db,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[debug-logs] fail', error);
    res.status(500).json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Email self-test endpoint
router.post('/email-selftest', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    // Import emailService
    const { emailService } = await import('../email/service');

    // Send self-test email (non-test)
    const result = await emailService.sendTemplate({
      to,
      templateId: 'selftest',
      data: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      },
      isTest: false, // This is a real operational test
      meta: { 
        path: 'selftest',
        adminUser: 'admin'
      }
    });

    console.log(`[admin-email] Self-test email sent to ${to}:`, result.success);

    if (result.success) {
      res.json({ 
        ok: true,
        message: `Self-test email sent successfully`,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        ok: false,
        error: 'Failed to send self-test email',
        details: result.error 
      });
    }
  } catch (error) {
    console.error('[admin-email] Self-test email failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to send self-test email' });
  }
});

// Mount SendGrid template management routes
router.use('/sendgrid', sendgridTemplatesRoutes);

export default router;