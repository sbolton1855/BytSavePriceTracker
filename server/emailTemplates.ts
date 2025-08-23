
export interface PriceDropTemplateData {
  asin: string;
  productTitle: string;
  oldPrice: number;
  newPrice: number;
}

export function generateEmailSubject(data: PriceDropTemplateData): string {
  const { productTitle, oldPrice, newPrice } = data;
  const savings = oldPrice - newPrice;
  const savingsPercentage = Math.round((savings / oldPrice) * 100);
  
  // Truncate title if too long
  const shortTitle = productTitle.length > 40 
    ? productTitle.substring(0, 37) + '...' 
    : productTitle;
  
  return `🔥 Price Drop: ${shortTitle} now $${newPrice.toFixed(2)} (${savingsPercentage}% off!)`;
}

import { buildAffiliateLink, AFFILIATE_DISCLOSURE } from './utils/affiliateLinks';

export function renderPriceDropTemplate(data: PriceDropTemplateData): string {
  const { asin, productTitle, oldPrice, newPrice } = data;
  const savings = oldPrice - newPrice;
  const savingsPercentage = Math.round((savings / oldPrice) * 100);
  const amazonUrl = buildAffiliateLink(asin);
  const productImageUrl = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Price Drop Alert - ${productTitle}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background: white;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #007bff;
                padding-bottom: 20px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 10px;
            }
            .alert-badge {
                background: #dc3545;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
                display: inline-block;
            }
            .product-info {
                margin: 25px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 6px;
                border-left: 4px solid #28a745;
            }
            .product-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                color: #333;
            }
            .price-container {
                margin: 20px 0;
            }
            .old-price {
                font-size: 16px;
                color: #6c757d;
                text-decoration: line-through;
                margin-right: 10px;
            }
            .new-price {
                font-size: 24px;
                font-weight: bold;
                color: #28a745;
                margin-right: 15px;
            }
            .savings {
                background: #28a745;
                color: white;
                padding: 6px 12px;
                border-radius: 15px;
                font-size: 14px;
                font-weight: bold;
                display: inline-block;
            }
            .cta-button {
                display: inline-block;
                background: #ff9500;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                margin: 20px 0;
                text-align: center;
                font-size: 16px;
            }
            .cta-button:hover {
                background: #e6860a;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #dee2e6;
                text-align: center;
                color: #6c757d;
                font-size: 14px;
            }
            .asin-info {
                background: #e9ecef;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                color: #495057;
                margin-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">BytSave</div>
                <div class="alert-badge">🚨 PRICE DROP ALERT</div>
            </div>
            
            <div class="product-info">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${productImageUrl}" alt="${productTitle}" 
                         style="max-width: 200px; max-height: 200px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
                         onerror="this.style.display='none'">
                </div>
                <div class="product-title">${productTitle}</div>
                
                <div class="price-container">
                    <span class="old-price">$${oldPrice.toFixed(2)}</span>
                    <span class="new-price">$${newPrice.toFixed(2)}</span>
                    <span class="savings">Save $${savings.toFixed(2)} (${savingsPercentage}% off)</span>
                </div>
                
                <a href="${amazonUrl}" class="cta-button">
                    🛒 View on Amazon
                </a>
                
                <div class="asin-info">
                    Product ASIN: ${asin}
                </div>
            </div>
            
            <div class="footer">
                <p>This price drop alert was sent by <strong>BytSave</strong></p>
                <p>We monitor Amazon prices so you don't have to!</p>
                <p><small>Price data last updated: ${new Date().toLocaleString()}</small></p>
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 11px; font-style: italic;">${AFFILIATE_DISCLOSURE}</p>
            </div>
        </div>
    </body>
    </html>
  `;
}
