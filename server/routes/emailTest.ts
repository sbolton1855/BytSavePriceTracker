
import express from 'express';
import { sendEmail } from '../sendEmail';
import { testEmailNotification } from '../emailTrigger';
import { sendEmail as sendGridEmail } from '../email/sendgridService';
import { db } from '../db';
import { emailLogs } from '../../shared/schema';

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

// STANDALONE EMAIL TEST ROUTE - Debug Pipeline
router.get('/test', async (req, res) => {
  console.log('🧪 [DEBUG] Standalone email test route FIRED');
  console.log('🧪 [DEBUG] Request query params:', req.query);
  
  try {
    // Hardcoded test email - replace with your actual email
    const testEmail = 'sbolton1855@gmail.com'; // Update this to your email
    const testSubject = '[STANDALONE TEST] Email Debug Pipeline';
    const testHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0f9ff; border-radius: 8px;">
        <h2 style="color: #1e40af;">🧪 Standalone Email Test</h2>
        <p><strong>Purpose:</strong> Debug the complete email pipeline</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Test ID:</strong> ${Math.random().toString(36).substring(7)}</p>
        <div style="margin: 20px 0; padding: 15px; background-color: #dbeafe; border-radius: 5px;">
          <h3>Pipeline Status:</h3>
          <ul>
            <li>✅ Route executed</li>
            <li>⏳ SendGrid call pending</li>
            <li>⏳ Database insert pending</li>
          </ul>
        </div>
        <p>If you receive this email, the pipeline is working!</p>
      </div>
    `;

    console.log(`🧪 [DEBUG] Test parameters - email: ${testEmail}, subject: ${testSubject}`);

    // Step 1: Call SendGrid directly to test the service
    console.log(`🧪 [DEBUG] Step 1: Calling sendGridEmail directly...`);
    const sendGridResult = await sendGridEmail(testEmail, testSubject, testHtml);
    
    console.log(`🧪 [DEBUG] SendGrid result:`, sendGridResult);

    // Step 2: Query the database to see if the log was inserted
    console.log(`🧪 [DEBUG] Step 2: Querying email_logs table...`);
    
    try {
      const recentLogs = await db
        .select()
        .from(emailLogs)
        .where(emailLogs.recipientEmail.eq(testEmail))
        .orderBy(emailLogs.sentAt.desc())
        .limit(5);
      
      console.log(`🧪 [DEBUG] Recent logs for ${testEmail}:`, recentLogs);
      
      // Step 3: Get total count of all logs
      const allLogs = await db
        .select()
        .from(emailLogs)
        .orderBy(emailLogs.sentAt.desc())
        .limit(10);
      
      console.log(`🧪 [DEBUG] Last 10 email logs in database:`, allLogs);
      
      // Return comprehensive test results
      res.json({
        success: sendGridResult.success,
        testEmail: testEmail,
        testSubject: testSubject,
        sendGridResult: sendGridResult,
        databaseLogs: {
          recentLogsForTestEmail: recentLogs,
          totalRecentLogs: allLogs,
          logCount: allLogs.length
        },
        timestamp: new Date().toISOString(),
        message: sendGridResult.success ? 
          'Test completed - check console logs and your email inbox' : 
          'Test failed - check console logs for errors'
      });
      
    } catch (dbError) {
      console.error('🧪 [ERROR] Database query failed:', dbError);
      
      res.json({
        success: sendGridResult.success,
        testEmail: testEmail,
        sendGridResult: sendGridResult,
        databaseError: dbError.message,
        message: 'SendGrid test completed, but database query failed - check console'
      });
    }

  } catch (error) {
    console.error('🧪 [ERROR] Standalone test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Standalone test failed',
      details: error.message,
      stack: error.stack
    });
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
