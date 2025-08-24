import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { logEmail } from '../email/logEmail';
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';
import { eq, desc, and, like, count } from 'drizzle-orm';

// Mock functions for email template handling (replace with actual implementation)
const getEmailTemplate = (templateId: string) => {
  const templates = {
    welcome: {
      id: 'welcome',
      name: 'Welcome Email',
      description: 'Welcome new users to BytSave',
      subject: 'Welcome to BytSave - Start Saving on Amazon!',
      variables: ['userName', 'email'],
      previewData: {
        userName: 'John Doe',
        email: 'john.doe@example.com'
      }
    },
    'price-drop': {
      id: 'price-drop',
      name: 'Price Drop Alert',
      description: 'Notify users when tracked product prices drop',
      subject: 'Price Drop Alert - {{productName}} is now {{newPrice}}!',
      variables: ['userName', 'productName', 'oldPrice', 'newPrice', 'productUrl', 'savingsAmount', 'savingsPercentage'],
      previewData: {
        userName: 'Jane Smith',
        productName: 'Amazon Echo Dot (4th Gen)',
        oldPrice: '$49.99',
        newPrice: '$29.99',
        productUrl: 'https://amazon.com/dp/B07XJ8C8F5',
        savingsAmount: '$20.00',
        savingsPercentage: '40%'
      }
    },
    'daily-digest': {
      id: 'daily-digest',
      name: 'Daily Price Summary',
      description: 'Daily summary of all tracked products',
      subject: 'Your Daily Price Update from BytSave',
      variables: ['userName', 'trackedProductsCount', 'priceDropsCount', 'products'],
      previewData: {
        userName: 'Bob Johnson',
        trackedProductsCount: 5,
        priceDropsCount: 2,
        products: [
          { name: 'Product 1', oldPrice: '$99.99', newPrice: '$79.99' },
          { name: 'Product 2', oldPrice: '$49.99', newPrice: '$39.99' }
        ]
      }
    },
    selftest: {
      id: 'selftest',
      name: 'Self-Test Email',
      description: 'Used for internal system testing',
      subject: 'BytSave System Test',
      variables: ['timestamp', 'environment'],
      previewData: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    }
  };
  return templates[templateId as keyof typeof templates];
};

const renderTemplate = (templateId: string, data?: Record<string, any>) => {
  const template = getEmailTemplate(templateId);
  if (!template) return null;

  let subject = template.subject;
  let html = `
    <html>
      <head><title>Email Preview - ${template.name}</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>${template.name}</h2>
        <p>${template.description}</p>
        <div style="border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
          <h3>Sample Content:</h3>
          <p>Hello ${data?.userName || 'there'},</p>
          <p>This is a sample email for the "${template.name}" template.</p>
          ${templateId === 'price-drop' ? `
            <p>We noticed a price drop for <strong>${data?.productName || 'a product'}</strong>. It's now ${data?.newPrice || '$XX.XX'}!</p>
            <p><a href="${data?.productUrl || '#'}">View Product</a></p>
          ` : ''}
          ${templateId === 'daily-digest' ? `
            <p>You are tracking ${data?.trackedProductsCount || 0} products, and we found ${data?.priceDropsCount || 0} price drops today.</p>
            <ul>
              ${(data?.products || []).map((p: any) => `<li>${p.name}: ${p.newPrice} (was ${p.oldPrice})</li>`).join('')}
            </ul>
          ` : ''}
          <p><em>This is a preview. Actual emails will use real user and product data.</em></p>
        </div>
      </body>
    </html>
  `;

  // Simple variable replacement (e.g., {{userName}})
  if (data) {
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(regex, data[key]);
      html = html.replace(regex, data[key]);
    });
  }

  return {
    templateId,
    subject,
    html,
    text: 'Plain text version of the email.', // Placeholder
    variables: template.variables
  };
};

const getAllEmailTemplates = () => {
  return [
    getEmailTemplate('welcome'),
    getEmailTemplate('price-drop'),
    getEmailTemplate('daily-digest'),
    getEmailTemplate('selftest')
  ].filter(Boolean); // Filter out nulls if getEmailTemplate fails
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
    const templates = getAllEmailTemplates().map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      subject: template.subject
    }));
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

    const rendered = renderTemplate(templateId, template.previewData);
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

    // Merge template's previewData with provided data
    const mergedData = { ...template.previewData, ...(data || {}) };
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
    const { templateId, to, testData } = req.body;

    if (!templateId || !to) {
      return res.status(400).json({ error: 'Template ID and recipient email are required' });
    }

    // Import emailService
    const { emailService } = await import('../email/service');

    // Send test email using centralized service
    const result = await emailService.sendTemplate({
      to,
      templateId,
      data: testData,
      isTest: true,
      meta: { 
        path: 'test',
        adminUser: 'admin' // Could be enhanced with actual admin user info
      }
    });

    console.log(`[admin-email] Test email sent for template ${templateId} to ${to}:`, result.success);

    if (result.success) {
      res.json({ 
        success: true, 
        message: `Test email for template '${templateId}' sent successfully`,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send test email',
        details: result.error 
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
    const status = req.query.status as string; // sent|failed|stubbed|all (default all)
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

      const items = app.locals.emailLogs.slice(0, pageSize);
      console.log('[email-logs] ok', { count: items.length, total: app.locals.emailLogs.length });

      return res.json({
        items,
        page,
        pageSize,
        total: app.locals.emailLogs.length
      });
    }

    // Build where conditions
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

    console.log('[email-logs] ok', { count: items.length, total });

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

export default router;