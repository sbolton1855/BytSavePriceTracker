import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { logEmail } from '../email/logEmail';
import { db } from '../db';
import { emailLogs } from '../../migrations/schema';
import { eq, desc, and, like, count } from 'drizzle-orm';

const router = Router();

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

    // Log the test email
    await logEmail({
      to,
      templateId,
      subject: `Test Email - ${templateId}`,
      status: 'sent',
      isTest: true,
      meta: { testData }
    });

    console.log(`[admin-email] Test email logged for template ${templateId} to ${to}`);

    res.json({ 
      success: true, 
      message: `Test email for template '${templateId}' logged successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[admin-email] Test email failed:', error);

    // Log the failed attempt
    try {
      await logEmail({
        to: req.body.to || 'unknown',
        templateId: req.body.templateId || 'unknown',
        subject: 'Test Email - Failed',
        status: 'failed',
        isTest: true,
        meta: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } catch (logError) {
      console.error('[admin-email] Failed to log test email error:', logError);
    }

    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Email logs endpoint
router.get('/email-logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);
    const status = req.query.status as string;
    const isTest = req.query.isTest as string;
    const to = req.query.to as string;
    const templateId = req.query.templateId as string;

    console.log('[email-logs] Query params:', { page, pageSize, status, isTest, to, templateId });

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

    console.log(`[email-logs] Found ${items.length} items, total: ${total}`);

    res.json({
      items,
      page,
      pageSize,
      total
    });
  } catch (error) {
    console.error('[email-logs] fetch_failed', { query: req.query, err: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

export default router;