
import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { csrfProtection } from '../middleware/adminSecurity';
import { sendEmail } from '../emailService';
import { z } from 'zod';

const router = express.Router();

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
      productUrl: 'https://amazon.com/sample'
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

// GET /admin/api/email/templates
router.get('/templates', (req, res) => {
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

  // Generate preview HTML based on template
  let previewHtml = '';
  
  switch (templateId) {
    case 'price-drop':
      previewHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">🎉 Price Drop Alert!</h2>
          <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
            <h3>${template.previewData.productTitle}</h3>
            <p><strong>New Price:</strong> <span style="color: #e74c3c; font-size: 24px;">${template.previewData.currentPrice}</span></p>
            <p><strong>Was:</strong> <span style="text-decoration: line-through;">${template.previewData.originalPrice}</span></p>
            <p><strong>You Save:</strong> <span style="color: #27ae60; font-weight: bold;">${template.previewData.savings}</span></p>
            <a href="${template.previewData.productUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 15px;">
              View Deal on Amazon
            </a>
          </div>
        </div>
      `;
      break;
    case 'welcome':
      previewHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">Welcome to BytSave!</h2>
          <p>Hi ${template.previewData.firstName},</p>
          <p>Thank you for signing up for BytSave Price Tracker. We're excited to help you save money on your favorite products!</p>
          <p>Start tracking products and we'll notify you when prices drop.</p>
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

// POST /admin/api/email/test
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
        </div>
      `;
    default:
      return '<p>Template not found</p>';
  }
}

export default router;
