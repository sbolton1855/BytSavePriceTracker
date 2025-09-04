import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { storage } from "./storage";
import { db } from "./db";
import { getProductInfo, searchProducts, extractAsinFromUrl, isValidAsin, addAffiliateTag, searchAmazonProducts } from "./amazonApi";
import { startPriceChecker, checkPricesAndNotify } from "./priceChecker";
import { requireAuth, configureAuth } from "./authService";
import { z } from "zod";
import { trackingFormSchema } from "@shared/schema";
import { fetchSignedAmazonRequest } from './lib/awsSignedRequest';
import amazonRouter from './routes/amazon';
// import { db } from "./db"; // Duplicate import, remove one
import { eq, sql, desc } from "drizzle-orm";
import { renderPriceDropTemplate } from "./emailTemplates";
import { sendEmail } from "./sendEmail";
import { emailLogs, users, products, trackedProducts } from "../shared/schema";
import adminDashboardRoutes from './routes/analytics';
import adminAuthRoutes from './routes/adminAuth';
import adminEmailRoutes from './routes/adminEmail';
import adminToolsRoutes from './routes/adminTools';
import emailTestRoutes from './routes/emailTest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AFFILIATE_TAG = process.env.AMAZON_PARTNER_TAG || 'bytsave-20';

// console.log('Hi Sean! Here are the logs to verify router setup:');
// console.log(">>> [DEBUG] server/routes.ts loaded");

/**
 * Helper function that intelligently adds price history entries only when needed
 *
 * Will only create a new price history entry if:
 * 1. No previous price history exists, or
 * 2. The current price is different from the last recorded price, or
 * 3. Significant time has passed since the last price point (over 12 hours)
 *
 * @param productId - The product ID to add price history for
 * @param currentPrice - The current price to potentially add
 * @returns Promise<boolean> - Whether a new price history entry was created
 */
async function intelligentlyAddPriceHistory(productId: number, currentPrice: number): Promise<boolean> {
  try {
    // Get the most recent price history for this product
    const priceHistory = await storage.getPriceHistoryByProductId(productId);

    // If no price history exists, always add the first entry
    if (!priceHistory || priceHistory.length === 0) {
      // console.log(`Creating first price history entry for product ${productId} at $${currentPrice}`);
      await storage.createPriceHistory({
        productId,
        price: currentPrice,
        timestamp: new Date()
      });
      return true;
    }

    // Sort by timestamp to get the most recent entry
    priceHistory.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latestEntry = priceHistory[0];
    const latestTimestamp = new Date(latestEntry.timestamp);
    const now = new Date();
    const hoursSinceLastUpdate = (now.getTime() - latestTimestamp.getTime()) / (1000 * 60 * 60);

    // Add new entry if price changed or significant time has passed
    const priceChanged = Math.abs(latestEntry.price - currentPrice) > 0.01; // 1 cent threshold
    const significantTimePassed = hoursSinceLastUpdate > 6; // 6 hour threshold (reduced from 12)

    if (priceChanged || significantTimePassed) {
      const reason = priceChanged ? "price changed" : "time threshold exceeded";
      // console.log(`Creating new price history entry for product ${productId} at $${currentPrice} (reason: ${reason})`);

      // Store additional metadata about the price change
      const priceChangeData = priceChanged ? {
        previousPrice: latestEntry.price,
        priceChange: currentPrice - latestEntry.price,
        percentageChange: ((currentPrice - latestEntry.price) / latestEntry.price) * 100
      } : null;

      await storage.createPriceHistory({
        productId,
        price: currentPrice,
        timestamp: new Date(),
        metadata: priceChangeData
      });
      return true;
    }

    // console.log(`Skipping price history entry for product ${productId} ($${currentPrice}) - no significant change`);
    return false;
  } catch (error) {
    console.error("Error adding price history:", error);
    return false;
  }
}

export { intelligentlyAddPriceHistory };

// Define category-based filters for promotions
const categoryFilters = {
  beauty: (product: Product) => {
    const keywords = [
      'beauty', 'makeup', 'skincare', 'haircare', 'fragrance',
      'cosmetic', 'moisturizer', 'serum', 'shampoo', 'conditioner',
      'lotion', 'cream', 'facial', 'hair', 'perfume', 'cologne'
    ];
    const title = product.title.toLowerCase();
    return keywords.some(keyword => title.includes(keyword));
  },

  seasonal: (product: Product) => {
    // Determine current season
    const now = new Date();
    const month = now.getMonth();

    // Spring: March-May (2-4), Summer: June-August (5-7),
    // Fall: Sept-Nov (8-10), Winter: Dec-Feb (11, 0, 1)
    const seasonalKeywords = {
      spring: [
        'spring', 'easter', 'gardening', 'cleaning', 'renewal',
        'garden', 'planting', 'mothers day', 'spring cleaning',
        'outdoor', 'patio'
      ],
      summer: [
        'summer', 'beach', 'pool', 'vacation', 'outdoors',
        'bbq', 'grill', 'camping', 'picnic', 'swimming',
        'sunscreen', 'sandals', 'shorts', 'cooler'
      ],
      fall: [
        'fall', 'autumn', 'halloween', 'thanksgiving', 'harvest',
        'school', 'backpack', 'notebook', 'sweater', 'jacket',
        'boots', 'pumpkin', 'decorations'
      ],
      winter: [
        'winter', 'christmas', 'holiday', 'snow', 'gift',
        'santa', 'decoration', 'lights', 'ornament', 'stocking',
        'sweater', 'coat', 'gloves', 'scarf', 'new year'
      ]
    };

    let currentSeasonKeywords;
    if (month >= 2 && month <= 4) currentSeasonKeywords = seasonalKeywords.spring;
    else if (month >= 5 && month <= 7) currentSeasonKeywords = seasonalKeywords.summer;
    else if (month >= 8 && month <= 10) currentSeasonKeywords = seasonalKeywords.fall;
    else currentSeasonKeywords = seasonalKeywords.winter;

    const title = product.title.toLowerCase();
    return currentSeasonKeywords.some(keyword => title.includes(keyword));
  },

  events: (product: Product) => {
    // Check for event keywords
    const eventKeywords = [
      'prime day', 'black friday', 'cyber monday', 'lightning deal',
      'deal of the day', 'todays deals', 'limited time', 'special offer',
      'flash sale', 'clearance', 'promotion', 'discount', 'save',
      'price drop', 'markdown', 'reduced', 'sale', 'offer'
    ];

    const title = product.title.toLowerCase();

    // Check title and significant discounts
    return eventKeywords.some(keyword => title.includes(keyword)) ||
      (product.originalPrice &&
       ((product.originalPrice - product.currentPrice) / product.originalPrice >= 0.2));
  }
};

// Middleware to check for admin token
const requireAdminToken = (req: Request, res: Response, next: Function) => {
  const token = req.query.token as string;
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin token validation endpoint
  app.post('/api/admin/validate-token', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token is required' });
      }

      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) {
        console.error('ADMIN_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      if (token === adminSecret) {
        return res.status(200).json({ valid: true });
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  // Setup authentication
  configureAuth(app);

  // Note: Auth routes are already set up in authService.ts

  // Serve static HTML files for password reset
  app.use('/reset-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/reset-password.html'));
  });

  app.use('/forgot-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/forgot-password.html'));
  });

  // Admin Force Alerts Page
  app.get('/admin/force-alerts', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });

  // Admin Email Logs Page
  app.get('/admin/email-logs', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });

  // Admin Products Page
  app.get('/admin/products', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });

  // Admin email logs route
  app.get('/api/admin/logs', async (req, res) => {
    try {
      const { token, page = '1', limit = '20', email } = req.query;

      if (!token || token !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = db.select().from(emailLogs);

      if (email) {
        query = query.where(eq(emailLogs.recipientEmail, email as string));
      }

      const rawLogs = await query
        .orderBy(desc(emailLogs.sentAt))
        .limit(limitNum)
        .offset(offset);

      // Map database fields to frontend expectations
      const logs = rawLogs.map(log => ({
        id: log.id,
        to: log.recipientEmail,        // Map recipient_email to 'to'
        subject: log.subject,
        html: log.previewHtml,         // Map preview_html to 'html'
        createdAt: log.createdAt,
        sentAt: log.sentAt
      }));

      // Get total count for pagination
      let countQuery = db.select({ count: sql<number>`count(*)` }).from(emailLogs);
      if (email) {
        countQuery = countQuery.where(eq(emailLogs.recipientEmail, email as string));
      }
      const totalCount = await countQuery;

      console.log(`📋 Admin email logs request - Page: ${pageNum}, Limit: ${limitNum}, Email filter: ${email || 'none'}`);
      console.log(`📊 Found ${logs.length} logs, Total: ${totalCount[0].count}`);

      res.json({
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limitNum)
        }
      });
    } catch (error) {
      console.error('Email logs error:', error);
      res.status(500).json({ error: 'Failed to fetch email logs' });
    }
  });

  // Force price drop alerts (admin only)
  app.post('/api/dev/force-alerts', async (req, res) => {
    try {
      const { token, asins } = req.body;

      if (!token || token !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }

      if (!Array.isArray(asins) || asins.length === 0) {
        return res.status(400).json({ error: 'ASINs array is required' });
      }

      const results = [];

      for (const asin of asins) {
        try {
          // Get all tracking records for this ASIN
          const trackingRecords = await db.select()
            .from(productTracking)
            .leftJoin(users, eq(productTracking.userId, users.id))
            .leftJoin(products, eq(productTracking.productId, products.id))
            .where(eq(products.asin, asin));

          if (trackingRecords.length === 0) {
            results.push({
              asin,
              success: false,
              message: 'No users tracking this product'
            });
            continue;
          }

          let emailsSent = 0;

          // Force send alerts to all users tracking this product
          for (const record of trackingRecords) {
            if (record.users?.email && record.products) {
              try {
                const emailData = {
                  asin: asin,
                  productTitle: record.products.title || 'Unknown Product',
                  oldPrice: record.products.originalPrice || record.products.currentPrice || 0,
                  newPrice: record.products.currentPrice || 0,
                };

                const emailHtml = renderPriceDropTemplate(emailData);

                await sendEmail({
                  to: record.users.email,
                  subject: `Price Drop Alert: ${emailData.productTitle}`,
                  html: emailHtml,
                });

                // Log the email
                await db.insert(emailLogs).values({
                  recipientEmail: record.users.email,
                  productId: record.products.id,
                  subject: `Price Drop Alert: ${emailData.productTitle}`,
                  previewHtml: emailHtml,
                  sentAt: new Date(), // Add sentAt timestamp
                });

                emailsSent++;
              } catch (emailError) {
                console.error(`Failed to send alert to ${record.users.email}:`, emailError);
              }
            }
          }

          results.push({
            asin,
            success: true,
            message: `Forced alerts sent to ${emailsSent} users`,
            emailsSent
          });

        } catch (error) {
          console.error(`Error processing ASIN ${asin}:`, error);
          results.push({
            asin,
            success: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error('Force alerts error:', error);
      res.status(500).json({ error: 'Failed to force alerts' });
    }
  });

  // Dev route for testing email templates
  app.post('/api/dev/preview-email', async (req: Request, res: Response) => {
    try {
      const { token, asin, email } = req.body;

      if (!token || token !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }

      // Serve the admin email test page
      res.sendFile(path.join(__dirname, '../client/src/pages/admin-email-test.tsx'));
    } catch (error) {
      console.error('Error in preview-email route:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // QA Test Route: Drop price for a tracked product to trigger alerts
  app.get('/api/dev/drop-price/:id', async (req: Request, res: Response) => {
    try {
      const { token } = req.query;
      const { id } = req.params;

      // Validate admin token
      if (!token || token !== process.env.ADMIN_SECRET) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Invalid admin token'
        });
      }

      // Validate tracked product ID
      const trackedProductId = parseInt(id, 10);
      if (isNaN(trackedProductId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tracked product ID'
        });
      }

      // Get the tracked product with product details
      const trackedProduct = await db.select()
        .from(productTracking)
        .leftJoin(products, eq(productTracking.productId, products.id))
        .where(eq(productTracking.id, trackedProductId))
        .limit(1);

      if (trackedProduct.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Tracked product with ID ${trackedProductId} not found`
        });
      }

      const tracked = trackedProduct[0].tracked_products;
      const product = trackedProduct[0].products;

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Associated product not found'
        });
      }

      // Calculate new target price (current price + $10 to ensure alert triggers)
      const newTargetPrice = product.currentPrice + 10;
      const oldTargetPrice = tracked.targetPrice;

      // Update the tracked product
      await db.update(productTracking)
        .set({
          targetPrice: newTargetPrice,
          notified: false
        })
        .where(eq(productTracking.id, trackedProductId));

      console.log(`🧪 QA TEST: Updated tracked product ${trackedProductId}`);
      console.log(`  📦 Product: ${product.title} (ASIN: ${product.asin})`);
      console.log(`  💰 Current Price: $${product.currentPrice}`);
      console.log(`  🎯 Target Price: $${oldTargetPrice} → $${newTargetPrice}`);
      console.log(`  🔔 Notified: true → false`);
      console.log(`  📧 Email: ${tracked.email}`);

      res.json({
        success: true,
        message: 'Price drop simulation configured successfully',
        data: {
          trackedProductId,
          productTitle: product.title,
          asin: product.asin,
          currentPrice: product.currentPrice,
          oldTargetPrice,
          newTargetPrice,
          email: tracked.email,
          notified: false
        },
        nextStep: `Call GET /api/run-daily-alerts?token=${process.env.ALERT_TRIGGER_TOKEN} to trigger alerts`
      });

    } catch (error) {
      console.error('Error in drop-price route:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to configure price drop test',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start price checker background service
  console.log("Starting price checker background service...");
  startPriceChecker();

  // Manual price check endpoint for debugging
  app.post('/api/debug/run-price-check-manual', async (req, res) => {
    try {
      // console.log('Running manual price check...');
      await checkPricesAndNotify();
      res.json({ success: true, message: 'Price check completed' });
    } catch (error) {
      console.error('Manual price check failed:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Secure daily alerts trigger endpoint - accepts both GET and POST
  app.all('/api/run-daily-alerts', async (req: Request, res: Response) => {
    try {
      // Validate token from query parameter (GET) or request body (POST)
      const token = req.query.token || req.body.token;
      const expectedToken = process.env.ALERT_TRIGGER_TOKEN;

      if (!expectedToken) {
        console.error('ALERT_TRIGGER_TOKEN not configured in environment');
        return res.status(500).json({
          success: false,
          error: 'Alert trigger token not configured on server'
        });
      }

      if (!token || typeof token !== 'string') {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Missing token parameter'
        });
      }

      if (token !== expectedToken) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Invalid token'
        });
      }

      // Import and call the price alerts function
      const { processPriceAlerts } = await import('./emailTrigger');

      console.log('🔔 Manual daily alerts job triggered via API');
      console.log('📊 Checking for price drop alerts...');

      const startTime = new Date();
      const alertCount = await processPriceAlerts();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ Daily alerts job completed in ${duration}ms`);
      console.log(`📧 Total alerts processed: ${alertCount}`);

      res.json({
        success: true,
        message: 'Daily alerts job completed successfully',
        alertsProcessed: alertCount,
        timestamp: endTime.toISOString(),
        duration: `${duration}ms`
      });

    } catch (error: any) {
      console.error('❌ Daily alerts job failed:', error);
      res.status(500).json({
        success: false,
        error: 'Daily alerts job failed',
        details: error.message || 'Unknown error occurred'
      });
    }
  });

  // Temporary test route to update tracked product id 42 for price drop testing
  app.get('/api/dev/update-track-42', async (req: Request, res: Response) => {
    try {
      console.log('Updating tracked_products row with id = 42');

      const updated = await db.update(trackedProducts)
        .set({
          targetPrice: 16.00,
          notified: false
        })
        .where(eq(trackedProducts.id, 42))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tracked product with id = 42 not found'
        });
      }

      console.log('Successfully updated tracked product id 42:', updated[0]);

      res.json({
        success: true,
        message: 'Updated tracked product id 42 for price drop testing',
        data: updated[0]
      });
    } catch (error) {
      console.error('Error updating tracked product id 42:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update tracked product',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Temporary test route for productId 103
  app.get('/api/dev/test-track-103', async (req: Request, res: Response) => {
    try {
      console.log('Querying tracked_products table for productId = 103');

      const results = await db.select({
        id: trackedProducts.id,
        targetPrice: trackedProducts.targetPrice,
        notified: trackedProducts.notified,
        userId: trackedProducts.userId,
        productId: trackedProducts.productId
      })
      .from(trackedProducts)
      .where(eq(trackedProducts.productId, 103));

      // Also get all unique productIds to help with testing
      const allProductIds = await db.select({
        productId: trackedProducts.productId
      })
      .from(trackedProducts);

      const uniqueProductIds = [...new Set(allProductIds.map(p => p.productId))];

      console.log(`Found ${results.length} tracked products for productId 103:`, results);
      console.log(`Available productIds in database:`, uniqueProductIds);

      res.json({
        success: true,
        count: results.length,
        data: results,
        availableProductIds: uniqueProductIds,
        message: uniqueProductIds.length > 0 ?
          `No results for productId 103. Try testing with one of these productIds: ${uniqueProductIds.slice(0, 5).join(', ')}` :
          'No tracked products found in database'
      });
    } catch (error) {
      console.error('Error querying tracked products for productId 103:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      });
      res.status(500).json({
        success: false,
        error: 'Failed to query tracked products',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Environment variable diagnostic endpoint
  app.get('/api/debug/env-vars', async (req: Request, res: Response) => {
    try {
      // Get all environment variables
      const allEnvVars = { ...process.env };

      // Remove sensitive variables from the response
      const sensitiveKeys = [
        'AMAZON_SECRET_KEY',
        'GOOGLE_CLIENT_SECRET',
        'SESSION_SECRET',
        'OPENAI_API_KEY',
        'EMAIL_PASSWORD',
        'GMAIL_APP_PASSWORD',
        'ALERT_TRIGGER_TOKEN'
      ];

      const sensitiveVarsFound: string[] = [];

      const filteredEnvVars: Record<string, string> = {};
      Object.keys(allEnvVars).forEach(key => {
        // Check if the key is considered sensitive
        if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey.toLowerCase()))) {
          sensitiveVarsFound.push(key);
          filteredEnvVars[key] = '[REDACTED]';
        } else {
          filteredEnvVars[key] = allEnvVars[key] || '';
        }
      });

      // Check for tracking limit related variables
      const trackingLimitVars = {
        MAX_TRACKED_PRODUCTS: process.env.MAX_TRACKED_PRODUCTS || 'undefined',
        TRACKING_LIMIT: process.env.TRACKING_LIMIT || 'undefined',
        GUEST_TRACKING_LIMIT: process.env.GUEST_TRACKING_LIMIT || 'undefined',
        USER_TRACKING_LIMIT: process.env.USER_TRACKING_LIMIT || 'undefined'
      };

      // Get the actual limit being used in the code
      const trackingLimit = parseInt(process.env.MAX_TRACKED_PRODUCTS || process.env.GUEST_TRACKING_LIMIT || '3');

      res.json({
        success: true,
        environment: process.env.NODE_ENV || 'undefined',
        trackingLimitAnalysis: {
          trackingLimitVars,
          actualLimitUsed: trackingLimit,
          limitSource: process.env.MAX_TRACKED_PRODUCTS ? 'MAX_TRACKED_PRODUCTS' :
                      process.env.GUEST_TRACKING_LIMIT ? 'GUEST_TRACKING_LIMIT' :
                      'hardcoded default (3)'
        },
        totalEnvVars: Object.keys(allEnvVars).length,
        sensitiveVarsFound,
        allEnvironmentVariables: filteredEnvVars,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Environment diagnostic error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to analyze environment variables'
      });
    }
  });

  // OpenAI test endpoint
  app.get('/api/openai/test', async (req: Request, res: Response) => {
    try {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.'
        });
      }

      // Import OpenAI (dynamic import to avoid issues if not installed)
      const { OpenAI } = await import('openai');

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Respond with a brief, friendly message."
          },
          {
            role: "user",
            content: "Say hello and confirm the OpenAI integration is working!"
          }
        ],
        model: "gpt-3.5-turbo",
        max_tokens: 100,
      });

      const response = completion.choices[0]?.message?.content || "No response generated";

      res.json({
        success: true,
        message: "OpenAI integration successful!",
        response: response,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('OpenAI API error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to call OpenAI API',
        details: error.code || 'Unknown error'
      });
    }
  });

  // AI-powered product recommendations endpoint
  app.post('/api/ai/recommendations', async (req: Request, res: Response) => {
    try {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.'
        });
      }

      const { trackedProducts, userEmail } = req.body;

      if (!trackedProducts || trackedProducts.length === 0) {
        return res.status(400).json({
          error: 'No tracked products provided for analysis'
        });
      }

      // Import OpenAI
      const { OpenAI } = await import('openai');

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Prepare product data for AI analysis
      const productList = trackedProducts.map((product: any, index: number) =>
        `${index + 1}. ${product.title} - $${product.price}`
      ).join('\n');

      const prompt = `
Analyze this user's Amazon product watchlist and provide personalized recommendations:

TRACKED PRODUCTS:
${productList}

You must respond with ONLY valid JSON in this exact format (no extra text, no prices in product names):

{
  "category": "brief category description",
  "reasoning": "2-3 sentence explanation of their shopping patterns and why these recommendations fit",
  "suggestions": ["Product Name 1", "Product Name 2", "Product Name 3", "Product Name 4", "Product Name 5"],
  "searchTerms": ["search term 1", "search term 2", "search term 3", "search term 4", "search term 5"]
}

IMPORTANT RULES:
- Product names in "suggestions" should be clean product names WITHOUT prices or extra details
- Each suggestion should be a simple, searchable product name
- Respond with ONLY the JSON object, no other text
- Focus on complementary products that would interest this user
`;

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert Amazon product analyst who understands consumer behavior and can suggest highly relevant complementary products. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "gpt-3.5-turbo",
        max_tokens: 800,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response generated from AI');
      }

      // Parse the JSON response
      let recommendations;
      try {
        // Clean the response in case there's extra text
        const cleanedResponse = aiResponse.trim();
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;

        if (jsonStart === -1 || jsonEnd === 0) {
          throw new Error('No JSON found in AI response');
        }

        const jsonString = cleanedResponse.substring(jsonStart, jsonEnd);
        recommendations = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse AI response:', aiResponse);
        console.error('Parse error:', parseError);
        throw new Error('Invalid response format from AI');
      }

      // Validate the response structure
      if (!recommendations.category || !recommendations.reasoning ||
          !Array.isArray(recommendations.suggestions) || !Array.isArray(recommendations.searchTerms)) {
        console.error('Invalid AI response structure:', recommendations);
        throw new Error('Incomplete response from AI');
      }

      // Ensure we have the right number of items
      if (recommendations.suggestions.length === 0 || recommendations.searchTerms.length === 0) {
        throw new Error('AI response missing suggestions or search terms');
      }

      res.json({
        success: true,
        recommendations,
        timestamp: new Date().toISOString(),
        analysedProducts: trackedProducts.length
      });

    } catch (error: any) {
      console.error('AI recommendations error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate AI recommendations',
        details: error.code || 'Unknown error'
      });
    }
  });

  // AI-powered product search with real Amazon results
  app.post('/api/ai/product-search', async (req: Request, res: Response) => {
    try {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.'
        });
      }

      const { trackedProducts, userEmail } = req.body;

      if (!trackedProducts || trackedProducts.length === 0) {
        return res.status(400).json({
          error: 'No tracked products provided for analysis'
        });
      }

      // Import OpenAI
      const { OpenAI } = await import('openai');

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Step 1: Generate search terms using AI
      const productList = trackedProducts.map((product: any, index: number) =>
        `${index + 1}. ${product.title} - $${product.price}`
      ).join('\n');

      const prompt = `
Based on this user's Amazon watchlist, generate optimized search terms for finding complementary products:

TRACKED PRODUCTS:
${productList}

Generate 3-5 specific search terms that would find products that complement their interests. Focus on:
- Related accessories or compatible items
- Products in similar categories but different subcategories
- Items that enhance or work with their current products
- Search terms that are specific enough to find relevant products but broad enough to return good results

Respond with ONLY a JSON array of search terms, like this:
["search term 1", "search term 2", "search term 3", "search term 4", "search term 5"]

Keep search terms short (1-3 words) and product-focused.
`;

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert at generating Amazon search terms. Always respond with only a valid JSON array of search terms."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "gpt-3.5-turbo",
        max_tokens: 200,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No search terms generated from AI');
      }

      // Parse the JSON response
      let searchTerms;
      try {
        searchTerms = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('Failed to parse AI search terms:', aiResponse);
        throw new Error('Invalid search terms format from AI');
      }

      // Validate that we got an array of strings
      if (!Array.isArray(searchTerms) || searchTerms.length === 0) {
        throw new Error('AI did not return valid search terms');
      }

      // Step 2: Search Amazon for each term and collect results
      const allProducts = [];
      const searchResults = {};

      for (const searchTerm of searchTerms) {
        try {
          console.log(`Searching Amazon for: "${searchTerm}"`);
          const amazonResults = await searchAmazonProducts(searchTerm);

          if (amazonResults && amazonResults.length > 0) {
            // Take first 3 results from each search
            const topResults = amazonResults.slice(0, 3).map((item: any) => ({
              asin: item.ASIN,
              title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
              price: item.Offers?.Listings?.[0]?.Price?.Amount || null,
              originalPrice: item.Offers?.Listings?.[0]?.SavingBasis?.Amount || null,
              imageUrl: item.Images?.Primary?.Medium?.URL || item.Images?.Primary?.Small?.URL || null,
              url: item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}`,
              affiliateUrl: addAffiliateTag(item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}`, AFFILIATE_TAG),
              searchTerm: searchTerm,
              couponDetected: item.Offers?.Listings?.[0]?.Promotions?.length > 0 || false
            }));

            searchResults[searchTerm] = topResults;
            allProducts.push(...topResults);
          } else {
            searchResults[searchTerm] = [];
          }
        } catch (searchError) {
          console.error(`Error searching for "${searchTerm}":`, searchError);
          searchResults[searchTerm] = [];
        }
      }

      // Step 3: Generate AI analysis of the results
      const analysisPrompt = `
Based on the user's tracked products and the search results found, provide a brief analysis:

USER'S TRACKED PRODUCTS:
${productList}

SEARCH TERMS USED: ${searchTerms.join(', ')}

Provide a brief 2-3 sentence explanation of why these search results would be valuable for this user, focusing on how the recommended products complement their current interests.

Respond with just the analysis text, no JSON needed.
`;

      const analysisCompletion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a product recommendation expert. Provide clear, helpful analysis."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        model: "gpt-3.5-turbo",
        max_tokens: 200,
        temperature: 0.7,
      });

      const aiAnalysis = analysisCompletion.choices[0]?.message?.content ||
        "These products complement your current watchlist with related accessories and compatible items.";

      // Return comprehensive results
      res.json({
        success: true,
        searchTerms,
        analysis: aiAnalysis,
        products: allProducts,
        searchResults, // Organized by search term
        totalProducts: allProducts.length,
        timestamp: new Date().toISOString(),
        basedOnProducts: trackedProducts.length
      });

    } catch (error: any) {
      console.error('AI product search error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate AI product search',
        details: error.code || 'Unknown error'
      });
    }
  });

  // Admin-only email preview and send route
  app.get('/api/dev/preview-email', async (req: Request, res: Response) => {
    try {
      const { asin, productTitle, oldPrice, newPrice, email, send, token } = req.query;

      // Validate admin token
      if (token !== process.env.ADMIN_SECRET) {
        console.log('Invalid admin token provided:', token);
        return res.status(403).json({ error: 'Unauthorized access' });
      }

      // Validate required parameters
      if (!asin || !oldPrice || !newPrice) {
        return res.status(400).json({
          error: 'Missing required parameters: asin, oldPrice, newPrice'
        });
      }

      const emailData = {
        asin: asin as string,
        productTitle: (productTitle as string) || 'Unnamed Product',
        oldPrice: parseFloat(oldPrice as string),
        newPrice: parseFloat(newPrice as string),
      };

      // Generate the email HTML
      const emailHtml = renderPriceDropTemplate(emailData);

      // If send=true, send the email
      if (send === 'true') {
        const recipientEmail = (email as string) || process.env.TEST_ADMIN_EMAIL;

        if (!recipientEmail) {
          return res.status(400).json({
            error: 'No recipient email provided and TEST_ADMIN_EMAIL not set'
          });
        }

        console.log(`Attempting to send test email to: ${recipientEmail}`);

        const { generateEmailSubject } = await import('./emailTemplates');
        const dynamicSubject = generateEmailSubject(emailData);

        await sendEmail({
          to: recipientEmail,
          subject: dynamicSubject,
          html: emailHtml,
        });

        console.log(`Test email sent successfully to: ${recipientEmail}`);
        return res.json({
          success: true,
          message: `Test email sent to ${recipientEmail}`
        });
      }

      // Otherwise, return the HTML preview as text (not HTML headers)
      res.setHeader('Content-Type', 'text/plain');
      res.send(emailHtml);
    } catch (error) {
      console.error('Error in preview-email route:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get email logs for admin
  app.get('/api/admin/logs', async (req, res) => {
    const { token } = req.query;

    if (!token || token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const logs = await db.select().from(emailLogs)
        .orderBy(desc(emailLogs.sentAt))
        .limit(100);

      res.json(logs);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      res.status(500).json({ error: 'Failed to fetch email logs' });
    }
  });

  // Get all tracked products for admin
  app.get('/api/admin/products', async (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token || token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const trackedProductsList = await db
        .select({
          id: trackedProducts.id,
          userId: trackedProducts.userId,
          email: trackedProducts.email,
          productId: trackedProducts.productId,
          targetPrice: trackedProducts.targetPrice,
          percentageAlert: trackedProducts.percentageAlert,
          percentageThreshold: trackedProducts.percentageThreshold,
          notified: trackedProducts.notified,
          createdAt: trackedProducts.createdAt,
          product: {
            id: products.id,
            asin: products.asin,
            title: products.title,
            url: products.url,
            imageUrl: products.imageUrl,
            currentPrice: products.currentPrice,
            originalPrice: products.originalPrice,
            lastChecked: products.lastChecked,
            lowestPrice: products.lowestPrice,
            highestPrice: products.highestPrice,
            priceDropped: products.priceDropped,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt
          }
        })
        .from(trackedProducts)
        .leftJoin(products, eq(trackedProducts.productId, products.id))
        .orderBy(desc(trackedProducts.createdAt));

      console.log(`Admin: Retrieved ${trackedProductsList.length} tracked products`);
      res.json(trackedProductsList);
    } catch (error) {
      console.error('Error fetching tracked products for admin:', error);
      res.status(500).json({ error: 'Failed to fetch tracked products' });
    }
  });

  // Reset notified status for a tracked product
  app.post('/api/admin/products/:id/reset-notified', async (req: Request, res: Response) => {
    const { token } = req.query;
    const { id } = req.params;

    if (!token || token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const productId = parseInt(id, 10);
      if (isNaN(productId)) {
        return res.status(400).json({ error: 'Invalid product ID' });
      }

      const updated = await db
        .update(trackedProducts)
        .set({ notified: false })
        .where(eq(trackedProducts.id, productId))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: 'Tracked product not found' });
      }

      console.log(`Admin: Reset notification status for tracked product ${productId}`);
      res.json({
        success: true,
        message: 'Notification status reset successfully',
        data: updated[0]
      });
    } catch (error) {
      console.error('Error resetting notification status:', error);
      res.status(500).json({ error: 'Failed to reset notification status' });
    }
  });

  // Force alert for a tracked product
  app.post('/api/admin/products/:id/force-alert', async (req: Request, res: Response) => {
    const { token } = req.query;
    const { id } = req.params;

    if (!token || token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const productId = parseInt(id, 10);
      if (isNaN(productId)) {
        return res.status(400).json({ error: 'Invalid product ID' });
      }

      // Get the tracked product with product details
      const trackedProduct = await db
        .select({
          id: trackedProducts.id,
          userId: trackedProducts.userId,
          email: trackedProducts.email,
          productId: trackedProducts.productId,
          targetPrice: trackedProducts.targetPrice,
          percentageAlert: trackedProducts.percentageAlert,
          percentageThreshold: trackedProducts.percentageThreshold,
          notified: trackedProducts.notified,
          createdAt: trackedProducts.createdAt,
          product: {
            id: products.id,
            asin: products.asin,
            title: products.title,
            url: products.url,
            imageUrl: products.imageUrl,
            currentPrice: products.currentPrice,
            originalPrice: products.originalPrice,
            lastChecked: products.lastChecked,
            lowestPrice: products.lowestPrice,
            highestPrice: products.highestPrice,
            priceDropped: products.priceDropped,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt
          }
        })
        .from(trackedProducts)
        .leftJoin(products, eq(trackedProducts.productId, products.id))
        .where(eq(trackedProducts.id, productId))
        .limit(1);

      if (trackedProduct.length === 0) {
        return res.status(404).json({ error: 'Tracked product not found' });
      }

      const item = trackedProduct[0];
      if (!item.product) {
        return res.status(404).json({ error: 'Associated product not found' });
      }

      // Force trigger the alert by simulating a price drop
      try {
        console.log(`Admin: Force triggering alert for product ${item.product.asin} (tracked product ${productId})`);

        // Import emailService dynamically to avoid circular dependencies
        const emailService = await import('./emailService');

        // Calculate savings
        const originalPrice = item.product.originalPrice || item.product.currentPrice;
        const savings = originalPrice - item.product.currentPrice;
        const savingsPercentage = Math.round((savings / originalPrice) * 100);

        await emailService.sendPriceDropAlert({
          email: item.email,
          productTitle: item.product.title,
          asin: item.product.asin,
          oldPrice: originalPrice,
          newPrice: item.product.currentPrice,
          targetPrice: item.targetPrice,
          savings: `$${savings.toFixed(2)} (${savingsPercentage}%)`,
          productUrl: addAffiliateTag(item.product.url, AFFILIATE_TAG),
          imageUrl: item.product.imageUrl || undefined
        });

        // Mark as notified
        await db
          .update(trackedProducts)
          .set({ notified: true })
          .where(eq(trackedProducts.id, productId));

        console.log(`Admin: Force alert sent successfully for product ${item.product.asin}`);
        res.json({
          success: true,
          message: `Force alert sent to ${item.email} for ${item.product.title}`
        });
      } catch (emailError) {
        console.error('Error sending force alert email:', emailError);
        res.status(500).json({
          error: 'Failed to send alert email',
          details: emailError instanceof Error ? emailError.message : 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error forcing alert:', error);
      res.status(500).json({ error: 'Failed to force alert' });
    }
  });

  // Import routes
  app.use('/api/admin', adminAuthRoutes);

  // Admin email routes - mount at /api/admin for direct access
  console.log('🔧 Mounting admin email routes at /api/admin...');
  app.use('/api/admin', adminEmailRoutes);
  console.log('✅ Admin email routes mounted successfully');

  app.use('/api/admin', adminToolsRoutes);

  // Admin affiliate routes
  const adminAffiliateRoutes = await import('./routes/adminAffiliate');
  app.use('/api/admin/affiliate', adminAffiliateRoutes.default);

  // Email testing routes
  app.use('/api/admin', emailTestRoutes);

  // Affiliate redirect routes
  const affiliateRoutes = await import('./routes/affiliate');
  app.use('/', affiliateRoutes.default);

  app.use('/api', amazonRouter);
  // console.log(">>> [DEBUG] Registered amazonRouter at /api");

  return httpServer;
}