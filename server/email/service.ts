
import sgMail from '@sendgrid/mail';
import { v4 as uuid } from 'uuid';
import { renderTemplate, getEmailTemplate } from './templates';
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

export async function sendTemplate(options: SendTemplateOptions): Promise<SendResult> {
  const { to, templateId, data = {}, isTest = false, meta = {} } = options;
  
  const logId = uuid();
  const logData = {
    to,
    templateId,
    isTest,
    provider: 'sendgrid' as const,
    logId,
    meta: { ...meta, templateKey: templateId }
  };

  // Check if we have a SendGrid template ID for this template
  const sgTemplateId = SG_TEMPLATE_MAP[templateId];
  
  if (SENDGRID_API_KEY && sgTemplateId) {
    // Use SendGrid Dynamic Template
    console.log(`[email-service] Sending template ${templateId} via SendGrid (ID: ${sgTemplateId})`);
    
    try {
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
        msg.mailSettings = {
          sandboxMode: { enable: true }
        };
        console.log(`[email-service] Test email - sandbox mode enabled`);
      }

      // Log email as 'processed' before sending
      await logEmail({
        ...logData,
        subject: `Template: ${templateId}`,
        status: 'processed'
      });

      const [response] = await sgMail.send(msg);
      const sgMessageId = response.headers?.['x-message-id'] || response.messageId;

      console.log(`[email-service] SendGrid email sent successfully, messageId: ${sgMessageId}`);

      // Update log with success and messageId
      await logEmail({
        ...logData,
        subject: `Template: ${templateId}`,
        status: 'sent',
        sgMessageId
      });

      return {
        success: true,
        messageId: response.messageId,
        sgMessageId,
        logId,
        provider: 'sendgrid'
      };

    } catch (error) {
      console.error(`[email-service] SendGrid error:`, error);
      
      // Log the failure
      await logEmail({
        ...logData,
        subject: `Template: ${templateId}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
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
    console.log(`[email-service] Using local template fallback for ${templateId}`);
    
    const localTemplate = getEmailTemplate(templateId);
    if (!localTemplate) {
      const error = `Template ${templateId} not found in local templates`;
      console.error(`[email-service] ${error}`);
      
      await logEmail({
        ...logData,
        subject: `Template: ${templateId}`,
        status: 'failed',
        error
      });

      return {
        success: false,
        logId,
        error,
        provider: 'fallback'
      };
    }

    const rendered = renderTemplate(templateId, data);
    if (!rendered) {
      const error = `Failed to render template ${templateId}`;
      console.error(`[email-service] ${error}`);
      
      await logEmail({
        ...logData,
        subject: `Template: ${templateId}`,
        status: 'failed',
        error
      });

      return {
        success: false,
        logId,
        error,
        provider: 'fallback'
      };
    }

    return sendRaw({
      to,
      subject: rendered.subject,
      html: rendered.html,
      isTest,
      meta: { ...meta, templateKey: templateId, fallback: true }
    });
  }
}

export async function sendRaw(options: SendRawOptions): Promise<SendResult> {
  const { to, subject, html, isTest = false, meta = {} } = options;
  
  const logId = uuid();
  const logData = {
    to,
    subject,
    html,
    isTest,
    provider: 'sendgrid' as const,
    logId,
    meta
  };

  if (SENDGRID_API_KEY) {
    // Use SendGrid for raw HTML email
    console.log(`[email-service] Sending raw HTML email via SendGrid`);
    
    try {
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
        msg.mailSettings = {
          sandboxMode: { enable: true }
        };
        console.log(`[email-service] Test email - sandbox mode enabled`);
      }

      // Log email as 'processed' before sending
      await logEmail({
        ...logData,
        status: 'processed'
      });

      const [response] = await sgMail.send(msg);
      const sgMessageId = response.headers?.['x-message-id'] || response.messageId;

      console.log(`[email-service] SendGrid raw email sent successfully, messageId: ${sgMessageId}`);

      // Update log with success and messageId
      await logEmail({
        ...logData,
        status: 'sent',
        sgMessageId
      });

      return {
        success: true,
        messageId: response.messageId,
        sgMessageId,
        logId,
        provider: 'sendgrid'
      };

    } catch (error) {
      console.error(`[email-service] SendGrid raw email error:`, error);
      
      // Log the failure
      await logEmail({
        ...logData,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
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
    console.log(`[email-service] Using fallback email service for raw HTML`);
    
    try {
      const { sendEmail } = await import('../sendEmail');
      
      // Log email as 'processed' before sending
      await logEmail({
        ...logData,
        provider: 'fallback',
        status: 'processed'
      });

      await sendEmail({ to, subject, html });

      console.log(`[email-service] Fallback email sent successfully`);

      // Update log with success
      await logEmail({
        ...logData,
        provider: 'fallback',
        status: 'sent'
      });

      return {
        success: true,
        logId,
        provider: 'fallback'
      };

    } catch (error) {
      console.error(`[email-service] Fallback email error:`, error);
      
      // Log the failure
      await logEmail({
        ...logData,
        provider: 'fallback',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        logId,
        error: error instanceof Error ? error.message : 'Unknown fallback error',
        provider: 'fallback'
      };
    }
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
