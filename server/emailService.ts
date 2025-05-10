import nodemailer from 'nodemailer';
import { addAffiliateTag } from './amazonApi';
import type { Product, TrackedProduct } from '@shared/schema';

// Default affiliate tag
const AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || 'bytsave-20';

// Configure email transporter
function createTransporter() {
  // For development/testing, use a test account from Ethereal
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
        pass: process.env.EMAIL_PASSWORD || 'ethereal_pass'
      }
    });
  }
  
  // For production, use your preferred SMTP service
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || ''
    }
  });
}

// Create email content for price drop alert
function createPriceDropEmail(
  to: string, 
  product: Product, 
  trackedProduct: TrackedProduct
): nodemailer.SendMailOptions {
  const affiliateUrl = addAffiliateTag(product.url, AFFILIATE_TAG);
  const percentOff = product.originalPrice 
    ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100) 
    : 0;
  
  const emailContent = `
    <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <div style="color: #3B82F6; font-size: 24px; margin-right: 10px;">📉</div>
        <h2 style="color: #1F2937; margin: 0; font-size: 20px;">BytSave Price Alert</h2>
      </div>
      
      <p style="color: #4B5563; font-size: 16px; line-height: 24px; margin-bottom: 20px;">
        Good news! A product you're tracking has dropped in price ${trackedProduct.percentageAlert 
          ? `by at least ${trackedProduct.percentageThreshold}%` 
          : `below your target of $${trackedProduct.targetPrice.toFixed(2)}`}.
      </p>
      
      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: flex-start;">
          ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-right: 16px;">` : ''}
          <div>
            <h3 style="color: #1F2937; margin: 0 0 8px 0; font-size: 16px;">${product.title}</h3>
            <div style="margin-bottom: 4px;">
              <span style="color: #10B981; font-weight: bold; font-size: 18px;">$${product.currentPrice.toFixed(2)}</span>
              ${product.originalPrice ? `<span style="color: #9CA3AF; text-decoration: line-through; margin-left: 8px; font-size: 14px;">$${product.originalPrice.toFixed(2)}</span>` : ''}
              ${percentOff > 0 ? `<span style="color: #10B981; font-size: 12px; margin-left: 8px;">-${percentOff}%</span>` : ''}
            </div>
            <p style="color: #6B7280; margin: 4px 0; font-size: 14px;">
              Your target: $${trackedProduct.targetPrice.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${affiliateUrl}" style="display: inline-block; background-color: #3B82F6; color: white; font-weight: 500; padding: 8px 16px; border-radius: 4px; text-decoration: none;">
          Buy Now on Amazon
        </a>
      </div>
      
      <p style="color: #4B5563; font-size: 14px; line-height: 20px; margin: 20px 0; border-top: 1px solid #E5E7EB; padding-top: 20px;">
        You're receiving this alert because you set up a ${trackedProduct.percentageAlert 
          ? `percentage-based alert for ${trackedProduct.percentageThreshold}% discount` 
          : `price target of $${trackedProduct.targetPrice.toFixed(2)}`} 
        for this product on ${new Date(trackedProduct.createdAt).toLocaleDateString()}.
      </p>
      
      <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 30px;">
        This email was sent by BytSave. <a href="#" style="color: #3B82F6;">Unsubscribe</a> or <a href="#" style="color: #3B82F6;">Manage Preferences</a>
      </p>
    </div>
  `;
  
  return {
    from: process.env.EMAIL_FROM || 'alerts@bytsave.com',
    to,
    subject: `Price Drop Alert: ${product.title} now $${product.currentPrice.toFixed(2)}`,
    html: emailContent
  };
}

// Send price drop alert email
async function sendPriceDropAlert(
  to: string, 
  product: Product, 
  trackedProduct: TrackedProduct
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const mailOptions = createPriceDropEmail(to, product, trackedProduct);
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`Price drop alert sent to ${to} - Message ID: ${info.messageId}`);
    
    return true;
  } catch (error) {
    console.error('Failed to send price drop alert email:', error);
    return false;
  }
}

export {
  sendPriceDropAlert
};
