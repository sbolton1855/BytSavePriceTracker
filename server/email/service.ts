
import { logEmail } from './logEmail';

interface SendTemplateParams {
  to: string;
  templateId: string;
  data?: any;
  isTest?: boolean;
  meta?: any;
}

interface SendRawParams {
  to: string;
  subject: string;
  html: string;
  isTest?: boolean;
  meta?: any;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private sendGridService: any = null;

  constructor() {
    // Initialize SendGrid if available
    try {
      const sendGridApiKey = process.env.SENDGRID_API_KEY;
      if (sendGridApiKey) {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(sendGridApiKey);
        this.sendGridService = sgMail;
        console.log('[email-service] SendGrid initialized');
      } else {
        console.log('[email-service] No SendGrid API key, using stub mode');
      }
    } catch (error) {
      console.error('[email-service] SendGrid initialization failed:', error);
    }
  }

  async sendTemplate({ to, templateId, data = {}, isTest = false, meta = {} }: SendTemplateParams): Promise<SendResult> {
    const subject = this.getSubjectForTemplate(templateId, data);
    const html = this.getHtmlForTemplate(templateId, data);
    
    return this.sendRaw({
      to,
      subject,
      html,
      isTest,
      meta: { ...meta, templateId, templateData: data }
    });
  }

  async sendRaw({ to, subject, html, isTest = false, meta = {} }: SendRawParams): Promise<SendResult> {
    let status: 'sent' | 'failed' | 'stubbed' = 'failed';
    let messageId: string | undefined;
    let error: string | undefined;

    console.log('[email-send]', { 
      to, 
      subject: subject.substring(0, 50) + '...', 
      isTest,
      provider: this.sendGridService ? 'sendgrid' : 'stub'
    });

    try {
      if (this.sendGridService) {
        // Real SendGrid send
        const msg = {
          to,
          from: process.env.FROM_EMAIL || 'alerts@bytsave.com',
          subject,
          html
        };

        const [response] = await this.sendGridService.send(msg);
        messageId = response.headers['x-message-id'] || 'unknown';
        status = 'sent';
        console.log('[email-send] SendGrid success:', { to, messageId });
      } else {
        // Stub mode
        messageId = `stub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        status = 'stubbed';
        console.log('[email-send] Stubbed (no SendGrid):', { to, messageId });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      status = 'failed';
      console.error('[email-send] Failed:', { to, error });
    } finally {
      // Always log the email attempt
      try {
        await logEmail({
          to,
          templateId: meta.templateId,
          subject,
          status,
          isTest,
          previewHtml: html,
          meta: {
            ...meta,
            provider: this.sendGridService ? 'sendgrid' : 'stub',
            messageId,
            error
          }
        });
      } catch (logError) {
        console.error('[email-send] Failed to log email:', logError);
      }
    }

    return {
      success: status === 'sent' || status === 'stubbed',
      messageId,
      error
    };
  }

  private getSubjectForTemplate(templateId: string, data: any): string {
    const qaTag = process.env.NODE_ENV !== 'production' ? '[QA-TEST] ' : '';
    
    switch (templateId) {
      case 'price-drop':
        return `${qaTag}Price Drop Alert: ${data.productTitle || 'Product'} - Now $${data.newPrice}!`;
      case 'password-reset':
        return `${qaTag}Reset Your BytSave Password`;
      case 'welcome':
        return `${qaTag}Welcome to BytSave!`;
      case 'daily-digest':
        return `${qaTag}Your Daily Price Update from BytSave`;
      case 'selftest':
        return `${qaTag}[SELFTEST] Email Service Test`;
      default:
        return `${qaTag}Notification from BytSave`;
    }
  }

  private getHtmlForTemplate(templateId: string, data: any): string {
    switch (templateId) {
      case 'price-drop':
        return this.getPriceDropHtml(data);
      case 'password-reset':
        return this.getPasswordResetHtml(data);
      case 'welcome':
        return this.getWelcomeHtml(data);
      case 'daily-digest':
        return this.getDailyDigestHtml(data);
      case 'selftest':
        return this.getSelftestHtml(data);
      default:
        return `<html><body><h2>BytSave Notification</h2><p>Template: ${templateId}</p><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
    }
  }

  private getPriceDropHtml(data: any): string {
    return `
      <html>
        <head><title>Price Drop Alert</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #28a745; margin: 0 0 20px 0;">🎉 Price Drop Alert!</h2>
            <h3 style="margin: 0 0 15px 0;">${data.productTitle || 'Product'}</h3>
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Old Price:</strong> <span style="text-decoration: line-through; color: #666;">$${data.oldPrice || 'N/A'}</span></p>
              <p style="margin: 5px 0;"><strong>New Price:</strong> <span style="color: #28a745; font-size: 1.2em; font-weight: bold;">$${data.newPrice || 'N/A'}</span></p>
              <p style="margin: 5px 0;"><strong>You Save:</strong> $${(parseFloat(data.oldPrice || 0) - parseFloat(data.newPrice || 0)).toFixed(2)}</p>
            </div>
            ${data.productUrl ? `<p><a href="${data.productUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Product</a></p>` : ''}
            <p style="color: #666; font-size: 0.9em; margin-top: 20px;">Happy saving with BytSave!</p>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetHtml(data: any): string {
    return `
      <html>
        <head><title>Password Reset</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #007bff;">Reset Your BytSave Password</h2>
            <p>Hi ${data.email || 'there'},</p>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${data.resetUrl || '#'}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            </p>
            <p style="color: #666; font-size: 0.9em;">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeHtml(data: any): string {
    return `
      <html>
        <head><title>Welcome to BytSave</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #28a745;">Welcome to BytSave!</h2>
            <p>Hi ${data.userName || 'there'},</p>
            <p>Welcome to BytSave - your personal Amazon price tracking assistant!</p>
            <p>Start tracking your favorite products and get notified when prices drop.</p>
            <p style="color: #666; font-size: 0.9em; margin-top: 20px;">Happy saving!</p>
          </div>
        </body>
      </html>
    `;
  }

  private getDailyDigestHtml(data: any): string {
    return `
      <html>
        <head><title>Daily Price Update</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #007bff;">Your Daily Price Update</h2>
            <p>Hi ${data.userName || 'there'},</p>
            <p>Here's your daily summary:</p>
            <ul>
              <li>Products tracked: ${data.trackedProductsCount || 0}</li>
              <li>Price drops today: ${data.priceDropsCount || 0}</li>
            </ul>
            ${data.products && data.products.length > 0 ? 
              '<h3>Today\'s Price Drops:</h3>' + 
              data.products.map((p: any) => `<p>• ${p.name}: ${p.oldPrice} → ${p.newPrice}</p>`).join('') 
              : ''}
            <p style="color: #666; font-size: 0.9em; margin-top: 20px;">Happy saving with BytSave!</p>
          </div>
        </body>
      </html>
    `;
  }

  private getSelftestHtml(data: any): string {
    return `
      <html>
        <head><title>Email Service Self-Test</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; border: 2px solid #007bff;">
            <h2 style="color: #007bff;">[SELFTEST] Email Service Test</h2>
            <p>This is a self-test email to verify the email service is working correctly.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>Provider:</strong> ${this.sendGridService ? 'SendGrid' : 'Stub'}</p>
            <p style="color: #28a745; font-weight: bold;">✅ Email service is operational</p>
          </div>
        </body>
      </html>
    `;
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
