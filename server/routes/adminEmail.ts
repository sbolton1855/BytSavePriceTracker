
/*
================================================================================
EMAIL SYSTEM ALIGNMENT REPORT
================================================================================

ROUTES TABLE:
Method | Path                              | File                    | Auth
-------|-----------------------------------|-------------------------|------------------
GET    | /api/admin/templates             | server/routes/adminEmail.ts | requireAdmin
GET    | /api/admin/preview/:id           | server/routes/adminEmail.ts | requireAdmin  
POST   | /api/admin/preview               | server/routes/adminEmail.ts | requireAdmin
POST   | /api/admin/send-test-email       | server/routes/adminEmail.ts | requireAdmin
GET    | /api/admin/email-logs            | server/routes/adminEmail.ts | requireAdmin
GET    | /api/admin/_debug/email-health   | server/routes/adminEmail.ts | requireAdmin
GET    | /api/admin/_debug/email-logs-counts | server/routes/adminEmail.ts | requireAdmin

AUTH MODEL: requireAdmin middleware - accepts x-admin-token header, fallback to ?token query param

TEMPLATE REGISTRY:
- price-drop: "🎯 Price Drop Alert for {{productTitle}}"
- password-reset: "Reset Your BytSave Password"  
- welcome: "Welcome to BytSave!"

SEND PROVIDER: SendGrid (with local template fallback), sandbox enabled for tests

LOGGING SINK: DB table 'email_logs' with in-memory app.locals.emailLogs fallback

CLIENT CALLS:
- Templates: GET /api/admin/templates  
- Preview: POST /api/admin/preview
- Send: POST /api/admin/send-test-email
- Logs: GET /api/admin/email-logs

================================================================================
*/

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { logEmail } from '../email/logEmail';
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';
import { eq, desc, and, like, count } from 'drizzle-orm';
import { sendTemplate } from '../email/service';

const router = Router();

// Email templates registry - single source of truth
const EMAIL_TEMPLATES = {
  'price-drop': {
    id: 'price-drop',
    name: 'Price Drop Alert',
    description: 'Notify users when tracked product prices drop',
    subject: '🎯 Price Drop Alert for {{productTitle}}',
    previewData: {
      productTitle: 'TRUEplus - Insulin Syringes 31g 0.3cc 5/16" (Pack of 100)',
      asin: 'B01DJGLYZQ',
      oldPrice: '22.99',
      newPrice: '15.99',
      productUrl: 'https://www.amazon.com/dp/B01DJGLYZQ?tag=bytsave-20&linkCode=ogi&th=1&psc=1',
      imageUrl: 'https://m.media-amazon.com/images/I/41example.jpg'
    },
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">🎯 Price Drop Alert!</h1>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="margin-top: 0;">${data.productTitle}</h2>
          <div style="display: flex; align-items: center; gap: 20px;">
            <img src="${data.imageUrl || 'https://via.placeholder.com/100'}" alt="Product" style="width: 100px; height: 100px; object-fit: contain;">
            <div>
              <p style="margin: 5px 0;"><strong>Old Price:</strong> <span style="text-decoration: line-through; color: #dc2626;">$${data.oldPrice}</span></p>
              <p style="margin: 5px 0;"><strong>New Price:</strong> <span style="color: #16a34a; font-size: 1.2em;">$${data.newPrice}</span></p>
              <a href="${data.productUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">View Deal</a>
            </div>
          </div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Thanks for using BytSave to track your favorite products!</p>
      </div>
    `
  },
  'password-reset': {
    id: 'password-reset',
    name: 'Password Reset',
    description: 'Help users reset their passwords securely',
    subject: 'Reset Your BytSave Password',
    previewData: {
      firstName: 'John',
      resetLink: 'https://example.com/reset-password?token=example123'
    },
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Reset Your Password</h1>
        <p>Hi ${data.firstName},</p>
        <p>We received a request to reset your BytSave account password.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${data.resetLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Reset Password</a>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email.</p>
      </div>
    `
  },
  'welcome': {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Welcome new users to BytSave',
    subject: 'Welcome to BytSave!',
    previewData: {
      firstName: 'Sarah'
    },
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Welcome to BytSave!</h1>
        <p>Hi ${data.firstName},</p>
        <p>Welcome to BytSave - your personal Amazon price tracking assistant!</p>
        <p>Here's what you can do:</p>
        <ul>
          <li>Track any Amazon product by simply pasting its URL</li>
          <li>Get instant alerts when prices drop</li>
          <li>View price history and trends</li>
          <li>Never miss a deal again!</li>
        </ul>
        <a href="https://your-app-url.com/dashboard" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Start Tracking</a>
        <p>Happy savings!</p>
        <p>The BytSave Team</p>
      </div>
    `
  }
};

// Helper function to render templates
const renderTemplate = (templateId: string, data: any = {}) => {
  console.log(`[email-preview] rendering template ${templateId}`);
  
  const template = EMAIL_TEMPLATES[templateId as keyof typeof EMAIL_TEMPLATES];
  if (!template) {
    console.error(`[email-preview] template not found: ${templateId}`);
    return null;
  }

  const mergedData = { ...template.previewData, ...data };
  let subject = template.subject;
  
  // Simple template replacement for subject
  Object.keys(mergedData).forEach(key => {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), mergedData[key] || '');
  });

  return {
    templateId,
    subject,
    html: template.html(mergedData),
    variables: Object.keys(mergedData)
  };
};

// Email templates endpoint
router.get('/templates', requireAdmin, async (req: Request, res: Response) => {
  console.log('[email-templates] hit', req.originalUrl);
  try {
    const templates = Object.values(EMAIL_TEMPLATES).map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      subject: template.subject,
      defaults: template.previewData
    }));
    
    console.log('[email-templates] ok', { count: templates.length });
    res.json({ templates });
  } catch (error) {
    console.error('[email-templates] error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Preview email template - GET method
router.get('/preview/:id', requireAdmin, async (req: Request, res: Response) => {
  const templateId = req.params.id;
  console.log('[email-preview] hit GET', { templateId });

  try {
    const rendered = renderTemplate(templateId);
    if (!rendered) {
      console.warn('[email-preview] template missing', { templateId });
      return res.status(404).json({ error: 'template_not_found' });
    }

    console.log('[email-preview] ok GET', { templateId, subjectLen: rendered.subject.length, htmlLen: rendered.html.length });
    res.json(rendered);
  } catch (error) {
    console.error('[email-preview] error GET:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// Preview email template - POST method with custom data
router.post('/preview', requireAdmin, async (req: Request, res: Response) => {
  const { templateId, data } = req.body;
  console.log('[email-preview] hit POST', { templateId, hasData: !!data });

  try {
    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    const rendered = renderTemplate(templateId, data);
    if (!rendered) {
      console.warn('[email-preview] template missing', { templateId });
      return res.status(404).json({ error: 'template_not_found' });
    }

    console.log('[email-preview] ok POST', { templateId, subjectLen: rendered.subject.length, htmlLen: rendered.html.length });
    res.json(rendered);
  } catch (error) {
    console.error('[email-preview] error POST:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// Send test email endpoint
router.post('/send-test-email', requireAdmin, async (req: Request, res: Response) => {
  const { templateId, to, data, email } = req.body;
  const recipientEmail = email || to; // Support both field names
  
  console.log('[email-send] hit test send', { templateId, to: recipientEmail });

  try {
    if (!templateId || !recipientEmail) {
      return res.status(400).json({ error: 'Template ID and recipient email are required' });
    }

    // Send test email using centralized service
    const result = await sendTemplate({
      to: recipientEmail,
      templateId,
      data: data || {},
      isTest: true,
      meta: { 
        path: 'admin-test',
        adminUser: 'admin'
      }
    });

    console.log('[email-send] test email result:', { success: result.success, logId: result.logId });

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
    console.error('[email-send] test email failed:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Email logs endpoint - single source of truth
router.get('/email-logs', requireAdmin, async (req: Request, res: Response) => {
  console.log('[email-logs] hit', req.originalUrl);

  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);
    const status = req.query.status as string;
    const isTest = req.query.isTest as string;
    const to = req.query.to as string;
    const templateId = req.query.templateId as string;

    console.log('[email-logs] query', { page, pageSize, status, isTest, to, templateId });

    // Check if we have DB available, fallback to in-memory if not
    if (!db) {
      console.log('[email-logs] using in-memory fallback');
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

      console.log('[email-logs] ok memory', { count: items.length, total });
      return res.json({ items, page, pageSize, total });
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

    console.log('[email-logs] ok db', { count: items.length, total });
    res.json({ items, page, pageSize, total });

  } catch (error) {
    console.error('[email-logs] fail', error?.message);
    
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

// Debug endpoint - email health
router.get('/_debug/email-health', requireAdmin, async (req: Request, res: Response) => {
  console.log('[debug-health] hit', req.originalUrl);
  
  try {
    let dbCount = 0;
    let memCount = 0;
    let lastLogPreview = null;

    // Check database
    if (db) {
      try {
        const dbResult = await db.select({ count: count() }).from(emailLogs);
        dbCount = dbResult[0]?.count || 0;
        
        if (dbCount > 0) {
          const latest = await db
            .select()
            .from(emailLogs)
            .orderBy(desc(emailLogs.createdAt))
            .limit(1);
          
          if (latest.length > 0) {
            lastLogPreview = {
              to: latest[0].to,
              templateId: latest[0].templateId,
              status: latest[0].status,
              createdAt: latest[0].createdAt
            };
          }
        }
      } catch (dbError) {
        console.error('[debug-health] DB error:', dbError);
      }
    }

    // Check in-memory
    const app = req.app;
    if (app?.locals?.emailLogs) {
      memCount = app.locals.emailLogs.length;
      
      if (memCount > 0 && !lastLogPreview) {
        const latest = app.locals.emailLogs[0];
        lastLogPreview = {
          to: latest.to,
          templateId: latest.templateId,
          status: latest.status,
          createdAt: latest.createdAt
        };
      }
    }

    console.log('[debug-health] ok', { dbCount, memCount });

    res.json({
      routesMounted: true,
      templates: Object.keys(EMAIL_TEMPLATES),
      counts: { db: dbCount, mem: memCount },
      lastLogPreview,
      hasDatabase: !!db,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[debug-health] fail', error);
    res.status(500).json({ error: 'Debug health check failed' });
  }
});

// Debug endpoint - email logs counts  
router.get('/_debug/email-logs-counts', requireAdmin, async (req: Request, res: Response) => {
  console.log('[debug-logs-counts] hit', req.originalUrl);
  
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
        console.error('[debug-logs-counts] DB error:', dbError);
      }
    }

    // Check in-memory
    const app = req.app;
    if (app?.locals?.emailLogs) {
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

    console.log('[debug-logs-counts] ok', { dbCount, memCount });

    res.json({
      dbCount,
      memCount,
      latest,
      hasDatabase: !!db,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[debug-logs-counts] fail', error);
    res.status(500).json({ error: 'Debug counts failed' });
  }
});

export default router;
