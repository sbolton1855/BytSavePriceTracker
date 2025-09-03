
import { buildAffiliateLink } from '../utils/affiliateLinks';

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
