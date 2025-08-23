
import express from 'express';
import { sendEmail } from '../sendEmail';
import { testEmailNotification } from '../emailTrigger';

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
            <p style="margin: 0; color: #0369a1;">✅ Email system is operational</p>
          </div>
        </div>
      `
    });

    if (success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test email' });
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
    emailHost: process.env.EMAIL_HOST || 'Not configured',
    emailPort: process.env.EMAIL_PORT || 'Not configured',
    emailUser: process.env.EMAIL_USER ? '✅ Configured' : '❌ Not configured',
    emailPass: process.env.EMAIL_PASS ? '✅ Configured' : '❌ Not configured',
    emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'Not configured'
  };

  res.json(config);
});

export default router;
