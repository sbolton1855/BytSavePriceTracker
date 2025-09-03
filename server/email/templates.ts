import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { buildAffiliateLink } from '../utils/affiliateLinks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AFFILIATE_DISCLOSURE = "As an Amazon Associate, BytSave earns from qualifying purchases.";

export const EMAIL_TEMPLATES = {
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
      productUrl: buildAffiliateLink('SAMPLE_ASIN_1')
    },
    html: (data: any) => `
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
        <p style="color: #666; font-size: 12px; margin-top: 20px;">This email was sent from BytSave Price Tracker.</p>
        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 11px; font-style: italic;">${AFFILIATE_DISCLOSURE}</p>
      </div>
    `
  },
  'welcome': {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent to new users when they sign up',
    subject: 'Welcome to BytSave Price Tracker!',
    previewData: {
      firstName: 'John',
      email: 'john@example.com'
    },
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3498db;">Welcome to BytSave!</h2>
        <p>Hi ${data.firstName},</p>
        <p>Thank you for signing up for BytSave Price Tracker. We're excited to help you save money on your favorite products!</p>
        <p>Start tracking products and we'll notify you when prices drop.</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">This email was sent from BytSave Price Tracker.</p>
        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 11px; font-style: italic;">${AFFILIATE_DISCLOSURE}</p>
      </div>
    `
  },
  'password-reset': {
    id: 'password-reset',
    name: 'Password Reset',
    description: 'Sent when user requests a password reset',
    subject: 'Reset your BytSave password',
    previewData: {
      firstName: 'John',
      resetUrl: 'https://your-app.com/reset-password?token=sample-token',
      expirationTime: '15 minutes'
    },
    html: (data: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Password Reset</h2>
        <p style="color: #555; line-height: 1.6;">Hello${data.firstName ? ` ${data.firstName}` : ''},</p>
        <p style="color: #555; line-height: 1.6;">You requested to reset your password for your BytSave account.</p>
        <p style="margin: 20px 0;">
          <a href="${data.resetUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </p>
        <p style="color: #555; line-height: 1.6;">
          If the button above doesn't work, you can also copy and paste the following link into your browser:
        </p>
        <p style="color: #007bff; word-break: break-all;">${data.resetUrl}</p>
        <p style="color: #777; font-size: 12px; margin-top: 20px;">
          This password reset link will expire in ${data.expirationTime || '15 minutes'}. If you did not request a password reset, please ignore this email.
        </p>
        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">Thank you,<br>The BytSave Team</p>
        <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 11px; font-style: italic;">${AFFILIATE_DISCLOSURE}</p>
      </div>
    `
  }
};

export function listTemplates() {
  return Object.values(EMAIL_TEMPLATES).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description
  }));
}

export function renderTemplate(id: string, data?: any) {
  const template = EMAIL_TEMPLATES[id as keyof typeof EMAIL_TEMPLATES];
  if (!template) {
    return null;
  }

  const templateData = { ...template.previewData, ...data };
  const subject = template.subject.replace(/\{\{(\w+)\}\}/g, (match, key) => templateData[key] || match);
  const html = template.html(templateData);

  return { subject, html };
}

// Default export for compatibility
export default {
  EMAIL_TEMPLATES,
  listTemplates,
  renderTemplate
};