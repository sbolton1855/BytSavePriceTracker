import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { csrfProtection } from '../middleware/adminSecurity';
import { sendEmail, createPriceDropEmail } from '../emailService';
import { z } from 'zod';
import { sql, desc, count, and, eq } from 'drizzle-orm';
import { db } from '../db';
import { emailLogs, affiliateClicks } from '../../shared/schema';

const router = express.Router();

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Debug endpoint to verify routes are working
router.get('/debug-routes', (req, res) => {
  console.log('🔍 Debug routes endpoint hit');
  console.log('Original URL:', req.originalUrl);
  console.log('Base URL:', req.baseUrl);
  console.log('Path:', req.path);
  console.log('Route path:', req.route?.path);
  
  res.json({
    message: 'Route debugging info',
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    routePath: req.route?.path,
    adminSecret: process.env.ADMIN_SECRET ? 'DEFINED' : 'UNDEFINED'
  });
});

// Affiliate Link Helper
function buildAffiliateLink(asin: string): string {
  const tag = process.env.AMAZON_AFFILIATE_TAG;
  if (!tag) {
    console.warn('AMAZON_AFFILIATE_TAG is not set. Affiliate links will not include the tag.');
    return `https://www.amazon.com/dp/${asin}?linkCode=ogi&th=1&psc=1`;
  }
  return `https://www.amazon.com/dp/${asin}?tag=${tag}&linkCode=ogi&th=1&psc=1`;
}

const AFFILIATE_DISCLOSURE = "As an Amazon Associate, BytSave earns from qualifying purchases.";

// All routes require admin authentication
router.use(requireAdmin);

// Email template definitions
const EMAIL_TEMPLATES = {
  'price-drop': {
    id: 'price-drop',
    name: 'Price Drop Alert',
    description: 'Sent when a tracked product price drops below target',
    subject: 'Price Drop Alert - {{productTitle}}',
    previewData: {
      productTitle: 'Sample Product Name',
      currentPrice: '$19.99',
      originalPrice: '$29.99',
      savings: '$10.00 (33%)',
      productUrl: buildAffiliateLink('SAMPLE_ASIN_1') // Using helper to build link
    }
  },
  'welcome': {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent to new users when they sign up',
    subject: 'Welcome to BytSave Price Tracker!',
    previewData: {
      firstName: 'John',
      email: 'john@example.com'
    }
  }
};

// Test email schema
const testEmailSchema = z.object({
  to: z.string().email().optional(),
  templateId: z.string(),
  customData: z.record(z.any()).optional()
});

// GET /api/admin/email-templates and /api/admin/email/templates - for frontend compatibility
router.get('/email-templates', (req, res) => {
  const { token } = req.query;
  
  console.log('=== EMAIL TEMPLATES DEBUG ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Route path:', req.route?.path);
  console.log('Request token:', token);
  console.log('Expected ADMIN_SECRET:', process.env.ADMIN_SECRET);
  console.log('Token type:', typeof token);
  console.log('ADMIN_SECRET type:', typeof process.env.ADMIN_SECRET);
  console.log('Tokens match:', token === process.env.ADMIN_SECRET);
  console.log('===============================');
  
  // Check admin token for query-based auth (frontend compatibility)
  if (!token || token !== process.env.ADMIN_SECRET) {
    console.log('❌ Authentication failed - token mismatch or missing');
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  console.log('✅ Authentication successful, returning templates');
  
  const templates = Object.values(EMAIL_TEMPLATES).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description
  }));

  res.json({ templates });
});

// GET /api/admin/email/templates - for frontend compatibility
router.get('/templates', (req, res) => {
  const { token } = req.query;
  
  console.log('Templates request received (alternate route)');
  console.log('Request token:', token);
  console.log('Expected ADMIN_SECRET:', process.env.ADMIN_SECRET);
  
  // Check admin token for query-based auth (frontend compatibility)
  if (!token || token !== process.env.ADMIN_SECRET) {
    console.log('Authentication failed - token mismatch or missing');
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  console.log('Authentication successful, returning templates');
  
  const templates = Object.values(EMAIL_TEMPLATES).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description
  }));

  res.json({ templates });
});

// GET /admin/api/email/preview/:templateId
router.get('/preview/:templateId', (req, res) => {
  const { templateId } = req.params;
  const template = EMAIL_TEMPLATES[templateId as keyof typeof EMAIL_TEMPLATES];

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  let previewHtml = '';

  switch (templateId) {
    case 'price-drop':
      // Use the actual email service function to generate real template
      const mockProduct = {
        id: 1,
        asin: 'B01DJGLYZQ',
        title: template.previewData.productTitle,
        url: template.previewData.productUrl,
        imageUrl: 'https://m.media-amazon.com/images/I/41example.jpg',
        currentPrice: 15.99,
        originalPrice: 22.99,
        lastChecked: new Date(),
        lowestPrice: 15.99,
        highestPrice: 22.99,
        priceDropped: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        affiliateUrl: template.previewData.productUrl
      };

      const mockTrackedProduct = {
        id: 1,
        userId: '1',
        email: 'admin@bytsave.com',
        productId: 1,
        targetPrice: 16.00,
        percentageAlert: false,
        percentageThreshold: null,
        notified: false,
        createdAt: new Date()
      };

      const emailData = createPriceDropEmail('admin@bytsave.com', mockProduct as any, mockTrackedProduct as any);
      previewHtml = emailData.html;
      break;
    case 'welcome':
      previewHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">Welcome to BytSave!</h2>
          <p>Hi ${template.previewData.firstName},</p>
          <p>Thank you for signing up for BytSave Price Tracker. We're excited to help you save money on your favorite products!</p>
          <p>Start tracking products and we'll notify you when prices drop.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">This is a test email from BytSave Admin Panel.</p>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 11px; font-style: italic;">${AFFILIATE_DISCLOSURE}</p>
        </div>
      `;
      break;
    default:
      previewHtml = '<p>Template preview not available</p>';
  }

  res.json({
    template: {
      id: template.id,
      name: template.name,
      subject: template.subject
    },
    previewHtml
  });
});

// GET /admin/api/test-reset - Test password reset emails
router.get('/test-reset', async (req, res) => {
  try {
    const { email, token, send } = req.query;

    // Check admin token
    if (!token || token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    // Generate password reset email HTML using the same template as authService
    const resetUrl = send === 'true'
      ? `${req.protocol}://${req.get('host')}/reset-password.html?token=LIVE_RESET_TOKEN`
      : `https://bytsave.com/reset/EXAMPLETOKEN`;

    const resetEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Password Reset</h2>
        <p style="color: #555; line-height: 1.6;">Hello,</p>
        <p style="color: #555; line-height: 1.6;">You requested to reset your password for your BytSave account.</p>
        <p style="margin: 20px 0;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </p>
        <p style="color: #555; line-height: 1.6;">
          If the button above doesn't work, you can also copy and paste the following link into your browser:
        </p>
        <p style="color: #007bff; word-break: break-all;">${resetUrl}</p>
        <p style="color: #777; font-size: 12px; margin-top: 20px;">
          This password reset link will expire in 15 minutes. If you did not request a password reset, please ignore this email.
        </p>
        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">Thank you,<br>The BytSave Team</p>
      </div>
    `;

    // If send=true, actually send the email
    if (send === 'true') {
      const emailResult = await sendEmail({
        to: email as string,
        subject: '[TEST] Reset your BytSave password',
        html: resetEmailHtml
      });

      res.json({
        success: true,
        message: `Password reset test email sent to ${email}`,
        emailResult
      });
    } else {
      // Preview mode - return HTML
      res.json({
        success: true,
        message: 'Password reset email preview generated',
        previewHtml: resetEmailHtml,
        previewUrl: `Preview mode - HTML returned in response`
      });
    }

  } catch (error) {
    console.error('Password reset test error:', error);
    res.status(500).json({ error: 'Failed to test password reset email' });
  }
});

// POST /api/admin/send-test-email - for frontend compatibility
router.post('/send-test-email', async (req, res) => {
  try {
    const { to, templateId, token } = req.body;

    // Check admin token
    if (!token || token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Invalid admin token' });
    }

    if (!to || !templateId) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, templateId' 
      });
    }

    const template = EMAIL_TEMPLATES[templateId as keyof typeof EMAIL_TEMPLATES];
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let emailHtml = '';
    
    // Generate email content based on template
    switch (templateId) {
      case 'price-drop':
        const mockProduct = {
          id: 1,
          asin: 'B01DJGLYZQ',
          title: 'Sample Product - Price Drop Alert Test',
          url: buildAffiliateLink('B01DJGLYZQ'),
          imageUrl: 'https://m.media-amazon.com/images/I/41example.jpg',
          currentPrice: 15.99,
          originalPrice: 22.99,
          lastChecked: new Date(),
          lowestPrice: 15.99,
          highestPrice: 22.99,
          priceDropped: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          affiliateUrl: buildAffiliateLink('B01DJGLYZQ')
        };

        const mockTrackedProduct = {
          id: 1,
          userId: '1',
          email: to,
          productId: 1,
          targetPrice: 16.00,
          percentageAlert: false,
          percentageThreshold: null,
          notified: false,
          createdAt: new Date()
        };

        const emailData = createPriceDropEmail(to, mockProduct as any, mockTrackedProduct as any);
        emailHtml = emailData.html;
        break;
      
      case 'welcome':
        emailHtml = generateEmailHtml('welcome', { firstName: 'Test User', email: to });
        break;
      
      default:
        emailHtml = '<p>Template preview not available</p>';
    }

    // Send the email
    await sendEmail({
      to: to,
      subject: `[TEST] ${template.subject.replace('{{productTitle}}', 'Sample Product')}`,
      html: emailHtml,
      templateId: templateId
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${to}`
    });

  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /admin/api/email/test - original endpoint with CSRF protection
router.post('/test', csrfProtection, async (req, res) => {
  try {
    const validation = testEmailSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.format()
      });
    }

    const { to, templateId, customData } = validation.data;
    const template = EMAIL_TEMPLATES[templateId as keyof typeof EMAIL_TEMPLATES];

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Use admin email as default recipient
    const recipient = to || req.session.admin?.email;

    if (!recipient) {
      return res.status(400).json({ error: 'No recipient specified' });
    }

    // Merge template data with custom data
    const emailData = { ...template.previewData, ...customData };

    // Update productUrl in emailData if it exists and is for a price-drop template
    if (templateId === 'price-drop' && emailData.productUrl && customData?.asin) {
      emailData.productUrl = buildAffiliateLink(customData.asin);
    }


    // Send test email
    const emailResult = await sendEmail({
      to: recipient,
      subject: `[TEST] ${template.subject}`,
      html: generateEmailHtml(templateId, emailData),
      templateId: templateId
    });

    res.json({
      success: true,
      message: `Test email sent to ${recipient}`,
      emailResult
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Helper function to generate email HTML
function generateEmailHtml(templateId: string, data: any): string {
  switch (templateId) {
    case 'price-drop':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">🎉 Price Drop Alert!</h2>
          <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
            <h3>${data.productTitle}</h3>
            <p><strong>New Price:</strong> <span style="color: #e74c3c; font-size: 24px;">${data.currentPrice}</span></p>
            <p><strong>Was:</strong> <span style="text-decoration: line-through;">${data.originalPrice}</span></p>
            <p><strong>You Save:</strong> <span style="color: #27ae60; font-weight: bold;">${data.savings}</span></p>
            <a href="${data.productUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 15px;">
              View Deal on Amazon
            </a>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">This is a test email from BytSave Admin Panel.</p>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 11px; font-style: italic;">${AFFILIATE_DISCLOSURE}</p>
        </div>
      `;
    case 'welcome':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">Welcome to BytSave!</h2>
          <p>Hi ${data.firstName},</p>
          <p>Thank you for signing up for BytSave Price Tracker. We're excited to help you save money on your favorite products!</p>
          <p>Start tracking products and we'll notify you when prices drop.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">This is a test email from BytSave Admin Panel.</p>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 11px; font-style: italic;">${AFFILIATE_DISCLOSURE}</p>
        </div>
      `;
    default:
      return '<p>Template not found</p>';
  }
}

// GET /admin/api/email-logs - View email logs with pagination and filtering
router.get('/logs', async (req, res) => {
  try {
    const { token, page = '1', pageSize = '20', status, type } = req.query;

    // Check admin token
    if (!token || token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const pageNum = parseInt(page as string) || 1;
    const limit = parseInt(pageSize as string) || 20;
    const offset = (pageNum - 1) * limit;

    // Build where conditions
    let whereConditions = [];

    if (status) {
      // Determine status based on whether there's an error or not
      if (status === 'fail') {
        whereConditions.push(sql`${emailLogs.subject} LIKE '%ERROR%' OR ${emailLogs.subject} LIKE '%FAILED%'`);
      } else if (status === 'success') {
        whereConditions.push(sql`${emailLogs.subject} NOT LIKE '%ERROR%' AND ${emailLogs.subject} NOT LIKE '%FAILED%'`);
      }
    }

    if (type) {
      if (type === 'price-drop') {
        whereConditions.push(sql`${emailLogs.subject} LIKE '%Price Drop%'`);
      } else if (type === 'reset') {
        whereConditions.push(sql`${emailLogs.subject} LIKE '%Reset%'`);
      } else if (type === 'test') {
        whereConditions.push(sql`${emailLogs.subject} LIKE '%TEST%'`);
      }
    }

    // Build the query
    let query = db.select({
      id: emailLogs.id,
      recipientEmail: emailLogs.recipientEmail,
      subject: emailLogs.subject,
      sentAt: emailLogs.sentAt,
      previewHtml: emailLogs.previewHtml,
      createdAt: emailLogs.createdAt
    }).from(emailLogs);

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    // Get paginated results
    const logs = await query
      .orderBy(desc(emailLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    let countQuery = db.select({ count: count() }).from(emailLogs);
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }
    const [{ count: total }] = await countQuery;

    // Process logs to add status and type
    const processedLogs = logs.map(log => ({
      id: log.id,
      recipientEmail: log.recipientEmail,
      subject: log.subject,
      sentAt: log.sentAt,
      previewHtml: log.previewHtml,
      createdAt: log.createdAt,
      status: (log.subject?.includes('ERROR') || log.subject?.includes('FAILED')) ? 'fail' : 'success',
      type: log.subject?.includes('Price Drop') ? 'price-drop' :
            log.subject?.includes('Reset') ? 'reset' :
            log.subject?.includes('TEST') ? 'test' : 'other'
    }));

    res.json({
      logs: processedLogs,
      total,
      page: pageNum,
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Email logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

// Redirect endpoint for affiliate link clicks
router.get('/r/:asin', async (req, res) => {
  const { asin } = req.params;
  const { u: userId } = req.query; // Get userId from query parameter

  try {
    // Log the click event
    if (userId) {
      await db.insert(affiliateClicks).values({
        userId: userId as string,
        asin: asin as string,
      });
    } else {
      console.warn('Affiliate click logged without userId:', { asin });
      // Optionally, you could still log it without a userId if that's acceptable
      // await db.insert(affiliateClicks).values({ asin: asin as string });
    }

    // Redirect to the affiliate link
    const affiliateUrl = buildAffiliateLink(asin as string);
    res.redirect(302, affiliateUrl);

  } catch (error) {
    console.error('Error logging affiliate click or redirecting:', error);
    // Fallback redirect or error response
    const affiliateUrl = buildAffiliateLink(asin as string); // Try to build URL even on error
    res.redirect(302, affiliateUrl); // Redirect anyway, or show an error page
  }
});


export default router;