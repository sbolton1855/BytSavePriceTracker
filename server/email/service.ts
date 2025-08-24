
import sgMail from '@sendgrid/mail';
import { v4 as uuid } from 'uuid';
import { logEmail } from './logEmail';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM || 'alerts@bytsave.com';
const SENDGRID_ASM_GROUP_ID = process.env.SENDGRID_ASM_GROUP_ID ? parseInt(process.env.SENDGRID_ASM_GROUP_ID) : undefined;
const SENDGRID_SANDBOX_FOR_TESTS = process.env.SENDGRID_SANDBOX_FOR_TESTS === 'true';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('[email-service] SendGrid initialized with API key');
} else {
  console.warn('[email-service] SendGrid API key not found, will use fallback email service');
}

// SendGrid template mapping
const SG_TEMPLATE_MAP: Record<string, string | undefined> = {
  'price-drop': process.env.SG_TEMPLATE_PRICE_DROP_ID,
  'welcome': process.env.SG_TEMPLATE_WELCOME_ID,
  'password-reset': process.env.SG_TEMPLATE_PASSWORD_RESET_ID
};

interface SendTemplateOptions {
  to: string;
  templateId: string;
  data?: Record<string, any>;
  isTest?: boolean;
  meta?: Record<string, any>;
}

interface SendRawOptions {
  to: string;
  subject: string;
  html: string;
  isTest?: boolean;
  meta?: Record<string, any>;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  sgMessageId?: string;
  logId: string;
  error?: string;
  provider: 'sendgrid' | 'fallback';
}

// Template definitions (matching adminEmail.ts)
const EMAIL_TEMPLATES = {
  'price-drop': {
    subject: '🎯 Price Drop Alert for {{productTitle}}',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">🎯 Price Drop Alert!</h1>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="margin-top: 0;">${data.productTitle || 'Product'}</h2>
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
    subject: 'Reset Your BytSave Password',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Reset Your Password</h1>
        <p>Hi ${data.firstName || 'there'},</p>
        <p>We received a request to reset your BytSave account password.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${data.resetLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Reset Password</a>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email.</p>
      </div>
    `
  },
  'welcome': {
    subject: 'Welcome to BytSave!',
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Welcome to BytSave!</h1>
        <p>Hi ${data.firstName || 'there'},</p>
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

export async function sendTemplate(options: SendTemplateOptions): Promise<SendResult> {
  const { to, templateId, data = {}, isTest = false, meta = {} } = options;
  
  const logId = uuid();
  console.log(`[email-send] Starting template send: ${templateId} to ${to} (test: ${isTest}) logId: ${logId}`);

  try {
    // Check if we have a SendGrid template ID for this template
    const sgTemplateId = SG_TEMPLATE_MAP[templateId];
    
    if (SENDGRID_API_KEY && sgTemplateId) {
      // Use SendGrid Dynamic Template
      console.log(`[email-send] Using SendGrid template ${templateId} (ID: ${sgTemplateId})`);
      
      try {
        // Log email as 'processed' before sending
        await logEmail({
          logId,
          to,
          subject: `Template: ${templateId}`,
          templateId,
          status: 'processed',
          isTest,
          provider: 'sendgrid',
          meta: { ...meta, templateKey: templateId }
        });

        const msg: any = {
          to,
          from: SENDGRID_FROM,
          templateId: sgTemplateId,
          dynamicTemplateData: data,
          categories: ['bytsave', isTest ? 'test' : 'prod'],
          customArgs: {
            logId,
            templateKey: templateId,
            isTest: isTest.toString(),
            ...meta
          }
        };

        if (SENDGRID_ASM_GROUP_ID) {
          msg.asm = { groupId: SENDGRID_ASM_GROUP_ID };
        }

        if (isTest && SENDGRID_SANDBOX_FOR_TESTS) {
          msg.mailSettings = { sandboxMode: { enable: true } };
          console.log(`[email-send] Test email - sandbox mode enabled`);
        }

        const [response] = await sgMail.send(msg);
        const sgMessageId = response.headers?.['x-message-id'] || response.messageId;

        // Update log with success
        await logEmail({
          logId,
          to,
          subject: `Template: ${templateId}`,
          templateId,
          status: 'sent',
          isTest,
          provider: 'sendgrid',
          sgMessageId,
          meta: { ...meta, templateKey: templateId, sgMessageId }
        });

        console.log(`[email-send] SendGrid success: ${sgMessageId}`);
        return {
          success: true,
          messageId: response.messageId,
          sgMessageId,
          logId,
          provider: 'sendgrid'
        };

      } catch (error) {
        console.error(`[email-send] SendGrid error:`, error);
        
        // Log the failure
        await logEmail({
          logId,
          to,
          subject: `Template: ${templateId}`,
          templateId,
          status: 'failed',
          isTest,
          provider: 'sendgrid',
          error: error instanceof Error ? error.message : 'Unknown error',
          meta: { ...meta, templateKey: templateId }
        });

        return {
          success: false,
          logId,
          error: error instanceof Error ? error.message : 'Unknown SendGrid error',
          provider: 'sendgrid'
        };
      }
    } else {
      // Fallback to local template rendering
      console.log(`[email-send] Using local template fallback for ${templateId}`);
      
      const localTemplate = EMAIL_TEMPLATES[templateId as keyof typeof EMAIL_TEMPLATES];
      if (!localTemplate) {
        const error = `Template ${templateId} not found`;
        
        await logEmail({
          logId,
          to,
          subject: `Template: ${templateId}`,
          templateId,
          status: 'failed',
          isTest,
          provider: 'fallback',
          error,
          meta: { ...meta, templateKey: templateId }
        });

        return { success: false, logId, error, provider: 'fallback' };
      }

      // Render template
      let subject = localTemplate.subject;
      Object.keys(data).forEach(key => {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '');
      });
      
      const html = localTemplate.html(data);

      return sendRaw({
        to,
        subject,
        html,
        isTest,
        meta: { ...meta, templateKey: templateId, fallback: true }
      });
    }
  } catch (error) {
    console.error(`[email-send] Unexpected error:`, error);
    
    // Log the failure
    await logEmail({
      logId,
      to,
      subject: `Template: ${templateId}`,
      templateId,
      status: 'failed',
      isTest,
      provider: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
      meta: { ...meta, templateKey: templateId }
    });

    return {
      success: false,
      logId,
      error: error instanceof Error ? error.message : 'Unexpected error',
      provider: 'fallback'
    };
  }
}

export async function sendRaw(options: SendRawOptions): Promise<SendResult> {
  const { to, subject, html, isTest = false, meta = {} } = options;
  
  const logId = uuid();
  console.log(`[email-send] Starting raw email send to ${to} (test: ${isTest}) logId: ${logId}`);

  try {
    if (SENDGRID_API_KEY) {
      // Use SendGrid for raw HTML email
      console.log(`[email-send] Sending raw HTML email via SendGrid`);
      
      try {
        // Log email as 'processed' before sending
        await logEmail({
          logId,
          to,
          subject,
          html,
          status: 'processed',
          isTest,
          provider: 'sendgrid',
          meta
        });

        const msg: any = {
          to,
          from: SENDGRID_FROM,
          subject,
          html,
          categories: ['bytsave', isTest ? 'test' : 'prod'],
          customArgs: {
            logId,
            isTest: isTest.toString(),
            ...meta
          }
        };

        if (SENDGRID_ASM_GROUP_ID) {
          msg.asm = { groupId: SENDGRID_ASM_GROUP_ID };
        }

        if (isTest && SENDGRID_SANDBOX_FOR_TESTS) {
          msg.mailSettings = { sandboxMode: { enable: true } };
        }

        const [response] = await sgMail.send(msg);
        const sgMessageId = response.headers?.['x-message-id'] || response.messageId;

        // Update log with success
        await logEmail({
          logId,
          to,
          subject,
          html,
          status: 'sent',
          isTest,
          provider: 'sendgrid',
          sgMessageId,
          meta: { ...meta, sgMessageId }
        });

        console.log(`[email-send] Raw SendGrid success: ${sgMessageId}`);
        return {
          success: true,
          messageId: response.messageId,
          sgMessageId,
          logId,
          provider: 'sendgrid'
        };

      } catch (error) {
        console.error(`[email-send] SendGrid raw error:`, error);
        
        await logEmail({
          logId,
          to,
          subject,
          html,
          status: 'failed',
          isTest,
          provider: 'sendgrid',
          error: error instanceof Error ? error.message : 'Unknown error',
          meta
        });

        return {
          success: false,
          logId,
          error: error instanceof Error ? error.message : 'Unknown SendGrid error',
          provider: 'sendgrid'
        };
      }
    } else {
      // Fallback to legacy email service
      console.log(`[email-send] Using fallback email service`);
      
      try {
        // Log as processed
        await logEmail({
          logId,
          to,
          subject,
          html,
          status: 'processed',
          isTest,
          provider: 'fallback',
          meta
        });

        // Import legacy service
        const { sendEmail } = await import('../sendEmail');
        await sendEmail({ to, subject, html });

        // Log success
        await logEmail({
          logId,
          to,
          subject,
          html,
          status: 'sent',
          isTest,
          provider: 'fallback',
          meta
        });

        console.log(`[email-send] Fallback success`);
        return { success: true, logId, provider: 'fallback' };

      } catch (error) {
        console.error(`[email-send] Fallback error:`, error);
        
        await logEmail({
          logId,
          to,
          subject,
          html,
          status: 'failed',
          isTest,
          provider: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown error',
          meta
        });

        return {
          success: false,
          logId,
          error: error instanceof Error ? error.message : 'Unknown fallback error',
          provider: 'fallback'
        };
      }
    }
  } catch (error) {
    console.error(`[email-send] Raw unexpected error:`, error);
    
    await logEmail({
      logId,
      to,
      subject,
      html,
      status: 'failed',
      isTest,
      provider: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
      meta
    });

    return {
      success: false,
      logId,
      error: error instanceof Error ? error.message : 'Unexpected raw error',
      provider: 'fallback'
    };
  }
}

// Legacy compatibility wrapper
export const emailService = {
  sendTemplate,
  sendRaw
};

// Price drop alert helper
export async function sendPriceDropAlert(data: {
  email: string;
  productTitle: string;
  asin: string;
  oldPrice: number;
  newPrice: number;
  targetPrice: number;
  savings: string;
  productUrl: string;
  imageUrl?: string;
}): Promise<SendResult> {
  return sendTemplate({
    to: data.email,
    templateId: 'price-drop',
    data: {
      asin: data.asin,
      productTitle: data.productTitle,
      oldPrice: data.oldPrice.toString(),
      newPrice: data.newPrice.toString(),
      productUrl: data.productUrl,
      imageUrl: data.imageUrl
    },
    isTest: false,
    meta: {
      productAsin: data.asin,
      alertType: 'price-drop'
    }
  });
}
