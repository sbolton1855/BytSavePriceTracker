
interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  previewData: Record<string, any>;
  defaults: Record<string, any>;
  html: (data: Record<string, any>) => string;
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  'price-drop': {
    id: 'price-drop',
    name: 'Price Drop Alert',
    description: 'Notifies users when a tracked product drops below their target price',
    subject: 'Price Drop Alert: {{productTitle}}',
    previewData: {
      asin: 'B01DJGLYZQ',
      productTitle: 'TRUEplus - Insulin Syringes 31g 0.3cc 5/16" (Pack of 100)',
      newPrice: '15.99',
      oldPrice: '22.99',
      productUrl: 'https://www.amazon.com/dp/B01DJGLYZQ?tag=bytsave-20',
      imageUrl: 'https://m.media-amazon.com/images/I/41example._SL160_.jpg'
    },
    defaults: {
      asin: 'B01DJGLYZQ',
      productTitle: 'TRUEplus - Insulin Syringes 31g 0.3cc 5/16" (Pack of 100)',
      newPrice: '15.99',
      oldPrice: '22.99',
      productUrl: 'https://www.amazon.com/dp/B01DJGLYZQ?tag=bytsave-20',
      imageUrl: 'https://via.placeholder.com/600x300'
    },
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Price Drop Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .product-info { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .price-alert { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .old-price { text-decoration: line-through; color: #666; }
          .new-price { color: #28a745; font-weight: bold; font-size: 1.2em; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 0.9em; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Price Drop Alert!</h1>
            <p>Great news! The price has dropped on one of your tracked products.</p>
          </div>
          
          <div class="product-info">
            <h2>${data.productTitle || 'Product Title'}</h2>
            <p><strong>ASIN:</strong> ${data.asin || 'Unknown'}</p>
            
            <div class="price-alert">
              <p><strong>Price Update:</strong></p>
              <p>Was: <span class="old-price">$${data.oldPrice || '0.00'}</span></p>
              <p>Now: <span class="new-price">$${data.newPrice || '0.00'}</span></p>
            </div>
            
            ${data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.productTitle}" style="max-width: 200px; height: auto; margin: 10px 0;">` : ''}
            
            ${data.productUrl ? `<a href="${data.productUrl}" class="button">View Product on Amazon</a>` : ''}
          </div>
          
          <div class="footer">
            <p>This alert was sent because the current price ($${data.newPrice || '0.00'}) is below your target price.</p>
            <p>Happy shopping!</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  'password-reset': {
    id: 'password-reset',
    name: 'Password Reset',
    description: 'Sends password reset instructions to users',
    subject: 'Reset Your Password',
    previewData: {
      firstName: 'John',
      resetLink: 'https://example.com/reset-password?token=example123'
    },
    defaults: {
      firstName: 'Jordan',
      resetLink: 'https://app.example.com/reset?token=DEMO'
    },
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 0.9em; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          
          <div class="content">
            <p>Hi ${data.firstName || 'there'},</p>
            
            <p>We received a request to reset your password. If you made this request, click the button below to reset your password:</p>
            
            ${data.resetLink ? `<a href="${data.resetLink}" class="button">Reset Your Password</a>` : ''}
            
            <div class="warning">
              <p><strong>Important:</strong> This link will expire in 24 hours for security reasons.</p>
            </div>
            
            <p>If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>
          </div>
          
          <div class="footer">
            <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all;">${data.resetLink || 'Reset link not available'}</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  'welcome': {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Welcomes new users to the platform',
    subject: 'Welcome to BytSave Price Tracker!',
    previewData: {
      firstName: 'Sarah'
    },
    defaults: {
      firstName: 'Jordan'
    },
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to BytSave</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
          .content { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .feature { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #007bff; }
          .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 0.9em; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to BytSave!</h1>
            <p>Your smart Amazon price tracking companion</p>
          </div>
          
          <div class="content">
            <p>Hi ${data.firstName || 'there'},</p>
            
            <p>Welcome to BytSave Price Tracker! We're excited to help you save money on your Amazon purchases.</p>
            
            <div class="feature">
              <h3>🔍 Track Any Product</h3>
              <p>Simply paste any Amazon product URL and set your target price.</p>
            </div>
            
            <div class="feature">
              <h3>📧 Instant Alerts</h3>
              <p>Get notified immediately when prices drop below your target.</p>
            </div>
            
            <div class="feature">
              <h3>📊 Price History</h3>
              <p>View detailed price charts to make informed buying decisions.</p>
            </div>
            
            <a href="https://bytsave.com/dashboard" class="button">Start Tracking Products</a>
            
            <p>Happy saving!</p>
            <p>The BytSave Team</p>
          </div>
          
          <div class="footer">
            <p>Questions? Reply to this email or visit our <a href="https://bytsave.com/faq">FAQ page</a>.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

export function getEmailTemplate(id: string): EmailTemplate | null {
  return EMAIL_TEMPLATES[id] || null;
}

export function getAllEmailTemplates(): EmailTemplate[] {
  return Object.values(EMAIL_TEMPLATES);
}

export function listTemplates() {
  return Object.values(EMAIL_TEMPLATES).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    subject: template.subject,
    defaults: template.defaults
  }));
}

export function renderTemplate(templateId: string, data: Record<string, any> = {}): { subject: string; html: string } | null {
  const template = getEmailTemplate(templateId);
  if (!template) return null;

  // Merge template's previewData with provided data
  const mergedData = { ...template.previewData, ...data };
  
  // Replace template variables in subject
  let subject = template.subject;
  Object.entries(mergedData).forEach(([key, value]) => {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });

  return {
    subject,
    html: template.html(mergedData)
  };
}
