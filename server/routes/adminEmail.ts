
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { logEmail } from '../email/logEmail';
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';
import { eq, desc, and, like, count } from 'drizzle-orm';

const router = Router();

// Test endpoint to verify routes are working
router.get('/test', (req: Request, res: Response) => {
  res.json({ 
    message: 'Admin email routes working',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /api/admin/email-templates',
      'GET /api/admin/email/preview/:templateId', 
      'POST /api/admin/send-test-email',
      'GET /api/admin/email-logs'
    ]
  });
});

// Email templates endpoint
router.get('/email-templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'welcome',
        name: 'Welcome Email',
        description: 'Welcome new users to BytSave',
        subject: 'Welcome to BytSave - Start Saving on Amazon!',
        variables: ['userName', 'email']
      },
      {
        id: 'price-drop',
        name: 'Price Drop Alert',
        description: 'Notify users when tracked product prices drop',
        subject: 'Price Drop Alert - {{productName}} is now {{newPrice}}!',
        variables: ['userName', 'productName', 'oldPrice', 'newPrice', 'productUrl', 'savingsAmount', 'savingsPercentage']
      },
      {
        id: 'daily-digest',
        name: 'Daily Price Summary',
        description: 'Daily summary of all tracked products',
        subject: 'Your Daily Price Update from BytSave',
        variables: ['userName', 'trackedProductsCount', 'priceDropsCount', 'products']
      }
    ];

    res.json({ templates });
  } catch (error) {
    console.error('[admin-email] Template fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Email preview endpoint
router.get('/email/preview/:templateId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    // Sample data for previews
    const sampleData = {
      welcome: {
        userName: 'John Doe',
        email: 'john.doe@example.com'
      },
      'price-drop': {
        userName: 'Jane Smith',
        productName: 'Amazon Echo Dot (4th Gen)',
        oldPrice: '$49.99',
        newPrice: '$29.99',
        productUrl: 'https://amazon.com/dp/B07XJ8C8F5',
        savingsAmount: '$20.00',
        savingsPercentage: '40%'
      },
      'daily-digest': {
        userName: 'Bob Johnson',
        trackedProductsCount: 5,
        priceDropsCount: 2,
        products: [
          { name: 'Product 1', oldPrice: '$99.99', newPrice: '$79.99' },
          { name: 'Product 2', oldPrice: '$49.99', newPrice: '$39.99' }
        ]
      }
    };

    const data = sampleData[templateId as keyof typeof sampleData];
    if (!data) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Generate simple preview HTML
    const previewHtml = `
      <html>
        <head><title>Email Preview - ${templateId}</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Email Template Preview: ${templateId}</h2>
          <div style="border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
            <h3>Sample Data:</h3>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
          <p><em>This is a preview with sample data. Actual emails will use real user and product data.</em></p>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(previewHtml);
  } catch (error) {
    console.error('[admin-email] Preview failed:', error);
    res.status(500).json({ error: 'Failed to generate email preview' });
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
