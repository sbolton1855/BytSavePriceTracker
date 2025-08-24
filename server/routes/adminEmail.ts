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

    const result = renderTemplate(templateId, data);
    if (!result) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if emailService is available
    if (typeof sendEmail === 'function') {
      await sendEmail({
        to: email,
        subject: `[TEST] ${result.subject}`,
        html: result.html,
        templateId: templateId
      });

      console.log('✅ Test email sent successfully to:', email);
      res.json({
        success: true,
        message: `Test email sent successfully to ${email}`
      });
    } else {
      // Stub mode
      console.log('📧 EMAIL STUB - Would send:', {
        to: email,
        subject: `[TEST] ${result.subject}`,
        templateId: templateId,
        htmlLength: result.html.length
      });

      res.json({
        success: true,
        message: `Test email rendered successfully (stub mode) for ${email}`
      });
    }

  } catch (error) {
    console.error('❌ Send test email error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;