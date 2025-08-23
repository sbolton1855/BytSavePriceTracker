
import express from 'express';
import { sendEmail } from '../sendEmail';
import { testEmailNotification } from '../emailTrigger';
import { sendEmail as sendGridEmail } from '../email/sendgridService';

const router = express.Router();

// Test email endpoint - requires admin token
router.post('/test-email', async (req, res) => {
  try {
    const { email, adminToken } = req.body;
    
    // Simple admin check
    if (adminToken !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    // Test basic email functionality
    const success = await sendEmail({
      to: email,
      subject: 'BytSave Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #3B82F6;">BytSave Email Test</h2>
          <p>This is a test email to verify your email system is working correctly.</p>
          <p>If you're receiving this, your email alerts are properly configured!</p>
          <div style="margin-top: 20px; padding: 15px; background-color: #f0f9ff; border-radius: 5px;">
            <p style="margin: 0; color: #0369a1;">✅ Email system is operational (SendGrid)</p>
          </div>
        </div>
      `
    });

    if (success) {
      res.json({ success: true, message: 'Test email sent successfully via SendGrid' });
    } else {
      res.status(500).json({ error: 'Failed to send test email via SendGrid' });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ error: 'Email test failed', details: error.message });
  }
});

// Check email configuration
router.get('/email-config', (req, res) => {
  const { adminToken } = req.query;
  
  if (adminToken !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const config = {
    emailService: 'SendGrid',
    sendgridApiKey: process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Not configured',
    emailFrom: process.env.EMAIL_FROM || 'Not configured'
  };

  res.json(config);
});

// Quick SendGrid test endpoint
router.get('/test-sendgrid', async (req, res) => {
  try {
    const { to, adminToken } = req.query;
    
    // Simple admin check
    if (adminToken !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!to) {
      return res.status(400).json({ error: 'Email address required in "to" parameter' });
    }

    const result = await sendGridEmail(
      to as string,
      'SendGrid Test',
      '<p>If you see this, <strong>SendGrid works</strong>!</p>'
    );

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'SendGrid test email sent successfully',
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'SendGrid test failed',
        details: result.error 
      });
    }
  } catch (error) {
    console.error('SendGrid test error:', error);
    res.status(500).json({ error: 'SendGrid test failed', details: error.message });
  }
});

export default router;
