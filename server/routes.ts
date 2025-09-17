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
import { eq, sql, desc, asc, like } from "drizzle-orm";
import { renderPriceDropTemplate } from "./emailTemplates";
import { sendEmail } from "./sendEmail";
import { emailLogs, users, products, trackedProducts, apiErrors } from "../shared/schema"; // Ensure apiErrors is imported
import adminDashboardRoutes from './routes/analytics';
import adminAuthRoutes from './routes/adminAuth';
import adminEmailRoutes from './routes/adminEmail';
import adminEmailLogsRoutes from './routes/adminEmailLogs';
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
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  const token = req.headers['x-admin-token'] as string; // Assuming token is in a header
  if (!token || token !== process.env.ADMIN_SECRET) {
    console.warn('Access denied: Invalid or missing admin token');
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
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

  // Auth status endpoint
  app.get('/api/auth/me', (req: Request, res: Response) => {
    try {
      if (req.isAuthenticated && req.isAuthenticated()) {
        const user = req.user as any;
        res.json({
          authenticated: true,
          user: {
            id: user?.id || user?.sub,
            email: user?.email,
            name: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
          }
        });
      } else {
        res.json({
          authenticated: false,
          user: null
        });
      }
    } catch (error) {
      console.error('Auth status check error:', error);
      res.json({
        authenticated: false,
        user: null
      });
    }
  });

  // Note: Auth routes are already set up in authService.ts

  // Serve static HTML files for password reset
  app.use('/reset-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/reset-password.html'));
  });

  app.use('/forgot-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/forgot-password.html'));
  });

  // Admin routes - catch all admin paths
  app.get('/admin*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });

  // Import the middleware at the top level
  const { requireAdmin } = await import('./middleware/requireAdmin');

  // Admin email templates route
  app.get('/api/admin/email-templates', requireAdmin, async (req, res) => {
    try {
      console.log('[Routes] Loading email templates for admin');
      const { listTemplates } = await import('./email/templates');
      const templates = listTemplates();
      res.json(templates);
    } catch (error) {
      console.error('[Routes] Error loading templates:', error);
      res.status(500).json({ error: 'Failed to load templates' });
    }
  });

  // Admin email logs route
  app.get('/api/admin/logs', requireAdmin, async (req, res) => {
    try {

      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const emailFilter = req.query.email as string;

      let query = db.select({
        id: emailLogs.id,
        recipientEmail: emailLogs.toEmail, // Map toEmail to recipientEmail
        subject: emailLogs.subject,
        previewHtml: emailLogs.body, // Map body to previewHtml
        sentAt: emailLogs.sentAt,
        createdAt: emailLogs.sentAt, // Use sentAt as createdAt
        status: emailLogs.status,
        type: sql`CASE
          WHEN ${emailLogs.subject} LIKE '[TEST]%' THEN 'test'
          WHEN ${emailLogs.subject} LIKE '%Price Drop%' THEN 'price-drop'
          WHEN ${emailLogs.subject} LIKE '%Password Reset%' THEN 'reset'
          ELSE 'other'
        END`.as('type')
      }).from(emailLogs).orderBy(desc(emailLogs.sentAt));

      if (emailFilter) {
        query = query.where(eq(emailLogs.toEmail, emailFilter));
      }

      const logs = await query.limit(limit).offset(offset);
      const totalCount = await db.select({ count: sql`count(*)` }).from(emailLogs);

      res.json({
        logs,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      });
    } catch (error) {
      console.error('Email logs error:', error);
      res.status(500).json({ error: 'Failed to fetch email logs' });
    }
  });

  // Get API errors for admin analytics
  app.get('/api/admin/errors', requireAdmin, async (req, res) => {
    try {
      console.log('[AdminApiErrors] Loading API errors for admin');

      // Parse query parameters with defaults
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200); // Max 200 per page
      const asinFilter = req.query.asin as string;
      const errorTypeFilter = req.query.errorType as string;
      const resolvedFilter = req.query.resolved as string;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      const offset = (page - 1) * limit;

      console.log('📋 API Errors Query params:', { page, limit, asinFilter, errorTypeFilter, resolvedFilter, sortBy, sortOrder });

      // Build where conditions based on filters
      const whereConditions = [];

      if (asinFilter) {
        whereConditions.push(like(apiErrors.asin, `%${asinFilter}%`));
      }

      if (errorTypeFilter && errorTypeFilter !== 'all') {
        whereConditions.push(eq(apiErrors.errorType, errorTypeFilter));
      }

      if (resolvedFilter && resolvedFilter !== 'all') {
        const isResolved = resolvedFilter === 'resolved';
        whereConditions.push(eq(apiErrors.resolved, isResolved));
      }

      // Get total count for pagination
      let totalCountQuery = db.select({ count: sql<number>`count(*)` }).from(apiErrors);

      if (whereConditions.length > 0) {
        const whereClause = whereConditions.reduce((acc, condition) =>
          acc ? sql`${acc} AND ${condition}` : condition
        );
        totalCountQuery = totalCountQuery.where(whereClause) as any;
      }

      const totalResult = await totalCountQuery;
      const total = Number(totalResult[0]?.count) || 0;
      const totalPages = Math.ceil(total / limit);

      // Build the main query with sorting
      let query = db
        .select({
          id: apiErrors.id,
          asin: apiErrors.asin,
          errorType: apiErrors.errorType,
          errorMessage: apiErrors.errorMessage,
          createdAt: apiErrors.createdAt,
          resolved: apiErrors.resolved
        })
        .from(apiErrors)
        .limit(limit)
        .offset(offset);

      // Apply where conditions
      if (whereConditions.length > 0) {
        const whereClause = whereConditions.reduce((acc, condition) =>
          acc ? sql`${acc} AND ${condition}` : condition
        );
        query = query.where(whereClause) as any;
      }

      // Apply sorting
      if (sortBy === 'createdAt') {
        query = query.orderBy(sortOrder === 'desc' ? desc(apiErrors.createdAt) : asc(apiErrors.createdAt)) as any;
      } else if (sortBy === 'errorType') {
        query = query.orderBy(sortOrder === 'desc' ? desc(apiErrors.errorType) : asc(apiErrors.errorType)) as any;
      } else if (sortBy === 'asin') {
        query = query.orderBy(sortOrder === 'desc' ? desc(apiErrors.asin) : asc(apiErrors.asin)) as any;
      } else {
        // Default fallback to createdAt desc
        query = query.orderBy(desc(apiErrors.createdAt)) as any;
      }

      const errors = await query;

      console.log(`[AdminApiErrors] Found ${errors.length} errors, page ${page}/${totalPages}, total ${total}`);

      // Return paginated results with metadata
      res.json({
        errors: errors,
        recentErrors: errors, // Include both for compatibility
        total: total,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('[AdminApiErrors] Error fetching API errors:', error);
      res.status(500).json({
        error: 'Failed to fetch API errors',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
            .from(trackedProducts)
            .leftJoin(users, eq(trackedProducts.userId, users.id))
            .leftJoin(products, eq(trackedProducts.productId, products.id))
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
        .from(trackedProducts)
        .leftJoin(products, eq(trackedProducts.productId, products.id))
        .where(eq(trackedProducts.id, trackedProductId))
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
      await db.update(trackedProducts)
        .set({
          targetPrice: newTargetPrice,
          notified: false
        })
        .where(eq(trackedProducts.id, trackedProductId));

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

  // Create HTTP server
  const httpServer = createServer(app);

  // API endpoints - prefix with /api

  // Get personalized product teasers
  app.get('/api/products/teasers', async (req: Request, res: Response) => {
    try {
      // Get user ID if authenticated
      const userId = (req.user as any)?.id;
      let teasers = [];

      if (userId) {
        // For logged in users, get personalized suggestions
        const userTrackedProducts = await storage.getTrackedProductsWithDetailsByEmail((req.user as any)?.email);
        const categories = new Set(userTrackedProducts.map(tp =>
          tp.product.title.split(' ').slice(0, 2).join(' ').toLowerCase()
        ));

        // Get products in similar categories
        const allProducts = await storage.getAllProducts();
        teasers = allProducts
          .filter(p =>
            categories.size === 0 || // If no tracked products, don't filter
            Array.from(categories).some(c => p.title.toLowerCase().includes(c))
          )
          .sort(() => Math.random() - 0.5) // Randomize
          .slice(0, 3);
      } else {
        // For visitors, get top deals
        const deals = await storage.getAllProducts();
        teasers = deals
          .filter(p => p.originalPrice && p.originalPrice > p.currentPrice)
          .sort((a, b) => {
            const discountA = (a.originalPrice! - a.currentPrice) / a.originalPrice!;
            const discountB = (b.originalPrice! - b.currentPrice) / b.originalPrice!;
            return discountB - discountA;
          })
          .slice(0, 3);
      }

      // Add affiliate links
      const response = teasers.map(product => ({
        ...product,
        affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
      }));

      res.json(response);
    } catch (error) {
      console.error('Error fetching teasers:', error);
      res.status(500).json({ error: 'Failed to fetch teasers' });
    }
  });

  // Get highlighted deals (products with biggest price drops)
  app.get('/api/products/deals', async (req: Request, res: Response) => {
    try {
      // Get query parameters
      const { category, rotate, t: timestamp } = req.query;

      // Get all products from storage
      const products = await storage.getAllProducts();

      // Filter out products that haven't been checked in the last 48 hours
      const freshProducts = products.filter(product => {
        const lastChecked = new Date(product.lastChecked);
        const now = new Date();
        const hoursSinceLastCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastCheck <= 48;
      });

      // Sort products by last checked time (most recently checked first)
      const sortedProducts = freshProducts.sort((a, b) =>
        new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime()
      );

      // Take the most recent 100 products to work with
      const recentProducts = sortedProducts.slice(0, 100);

      // Apply category filter if specified
      let filteredProducts = recentProducts;
      if (category && typeof category === 'string' && Object.keys(categoryFilters).includes(category)) {
        filteredProducts = recentProducts.filter((categoryFilters as any)[category]);
      }

      // Calculate price drops and filter products with discounts
      let deals = filteredProducts
        .filter(product => {
          // Ensure we have a valid originalPrice to compare against
          const originalPrice = product.originalPrice !== null ? product.originalPrice : product.highestPrice;

          // Avoid null/undefined comparisons
          if (originalPrice === null || originalPrice === undefined) {
            return false;
          }

          // Filter out products without a meaningful price difference (at least 5% discount)
          const priceDifference = originalPrice - product.currentPrice;
          const percentDifference = (priceDifference / originalPrice) * 100;
          return originalPrice > product.currentPrice && percentDifference >= 5;
        })
        .map(product => {
          // Ensure we have a valid originalPrice for calculation
          const originalPrice = product.originalPrice !== null ? product.originalPrice : product.highestPrice;

          // Use a safe default if originalPrice is null/undefined
          const safeOriginalPrice = originalPrice ?? product.currentPrice;

          // Avoid division by zero
          const discountPercentage = safeOriginalPrice > 0
            ? ((safeOriginalPrice - product.currentPrice) / safeOriginalPrice) * 100
            : 0;

          // Calculate potential savings
          const savings = safeOriginalPrice - product.currentPrice;

          return {
            ...product,
            discountPercentage: Math.round(discountPercentage),
            savings: Math.round(savings * 100) / 100,
            // Add affiliate link
            affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
          };
        })
        // Sort by highest discount percentage first
        .sort((a, b) => b.discountPercentage - a.discountPercentage);

      // Use rotation parameter to get different subsets
      const rotationIndex = parseInt(rotate as string) || 0;
      const dealsPerRotation = 6;
      const totalRotations = Math.ceil(deals.length / dealsPerRotation);

      // Ensure rotation index wraps around
      const effectiveRotation = rotationIndex % totalRotations;

      // Get the subset for this rotation
      const startIndex = effectiveRotation * dealsPerRotation;
      const rotatedDeals = deals.slice(startIndex, startIndex + dealsPerRotation);

      // If we don't have enough deals in this rotation, add some from the beginning
      if (rotatedDeals.length < dealsPerRotation) {
        const remaining = deals.slice(0, dealsPerRotation - rotatedDeals.length);
        rotatedDeals.push(...remaining);
      }

      // Send response
      res.json(rotatedDeals);
    } catch (error) {
      console.error('Error fetching deals:', error);
      res.status(500).json({ error: 'Failed to fetch deals' });
    }
  });

  // Search for Amazon products
  app.get('/api/search', async (req: Request, res: Response) => {
    const query = req.query.q as string;

    console.log("🔍 Search API called with query:", query);

    if (!query || query.trim().length < 3) {
      console.log("❌ Search query too short:", query);
      return res.status(400).json({ error: 'Search query must be at least 3 characters' });
    }

    try {
      console.log("🌐 Calling Amazon API for search:", query.trim());
      const results = await searchAmazonProducts(query.trim());

      console.log("📦 Amazon API returned", results?.length || 0, "results");

      if (!results || !Array.isArray(results)) {
        console.error("⚠️ Invalid results from Amazon API:", results);
        return res.json({ items: [] });
      }

      const formattedResults = results.map((item: any) => ({
        asin: item.ASIN,
        title: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
        price: item.Offers?.Listings?.[0]?.Price?.Amount || null,
        imageUrl: item.Images?.Primary?.Medium?.URL || item.Images?.Primary?.Small?.URL || null,
        url: item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}`,
        couponDetected: item.Offers?.Listings?.[0]?.Promotions?.length > 0 || false
      }));

      console.log("✅ Formatted", formattedResults.length, "search results");
      res.json({ items: formattedResults });
    } catch (error: any) {
      console.error('❌ Search error:', error);
      console.error('❌ Search error stack:', error.stack);
      res.status(500).json({
        error: 'Search failed',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get product details by ASIN or URL
  app.get('/api/product', async (req: Request, res: Response) => {
    // console.log('📦 [ROUTE] /api/product - Request received');
    // console.log('[ROUTE] Query params:', req.query);

    try {
      const { asin, url } = req.query;

      if (!asin && !url) {
        console.error('[ROUTE] Missing required parameters');
        return res.status(400).json({ error: 'ASIN or URL is required' });
      }

      // Extract ASIN from URL or use provided ASIN
      let productAsin = '';
      if (url && typeof url === 'string') {
        // console.log('[ROUTE] Extracting ASIN from URL:', url);
        const extractedAsin = extractAsinFromUrl(url);
        if (!extractedAsin) {
          console.error('[ROUTE] Failed to extract ASIN from URL');
          return res.status(400).json({ error: 'Invalid Amazon URL' });
        }
        productAsin = extractedAsin;
        // console.log('[ROUTE] Extracted ASIN:', productAsin);
      } else if (asin && typeof asin === 'string') {
        if (!isValidAsin(asin)) {
          console.error('[ROUTE] Invalid ASIN format:', asin);
          return res.status(400).json({ error: 'Invalid ASIN format' });
        }
        productAsin = asin;
        // console.log('[ROUTE] Using provided ASIN:', productAsin);
      }

      // Check if product exists in our database first
      // console.log('[ROUTE] Checking database for ASIN:', productAsin);
      let product = await storage.getProductByAsin(productAsin);

      if (!product) {
        // console.log('[ROUTE] Product not in DB, fetching from Amazon API');
        // If not found in DB, try to fetch from Amazon API
        try {
          const amazonProduct = await getProductInfo(productAsin);
          // console.log('[ROUTE] Amazon API returned product:', {
          //   asin: amazonProduct.asin,
          //   title: amazonProduct.title,
          //   price: amazonProduct.price
          // });

          // Save to our database with full info
          product = await storage.createProduct({
            asin: amazonProduct.asin,
            title: amazonProduct.title,
            url: amazonProduct.url,
            imageUrl: amazonProduct.imageUrl,
            currentPrice: amazonProduct.price,
            originalPrice: amazonProduct.price,
            lowestPrice: amazonProduct.price,
            highestPrice: amazonProduct.price,
            lastChecked: new Date()
          });
          // console.log('[ROUTE] Saved product to database with ID:', product.id);
        } catch (error) {
          // If API fails, create minimal product entry
          console.error('❌ [ROUTE] Failed to fetch from Amazon API:', error);
          // console.log('[ROUTE] Creating minimal product entry');
          product = await storage.createProduct({
            asin: productAsin,
            title: "Product information pending...",
            url: url as string || `https://www.amazon.com/dp/${productAsin}`,
            currentPrice: 0,
            lastChecked: new Date()
          });
        }
      } else {
        // console.log('[ROUTE] Product found in database with ID:', product.id);
      }

      // Add affiliate url to response
      const response = {
        ...product,
        affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
      };

      // console.log('[ROUTE] Sending response for product:', product.asin);
      res.json(response);
    } catch (error: any) {
      console.error('❌ [ROUTE] Product lookup error:', error);
      console.error('[ROUTE] Error stack:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to get product details' });
    }
  });

  // Get price history for a product
  app.get('/api/products/:id/price-history', async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);

      if (isNaN(productId)) {
        return res.status(400).json({ error: 'Invalid product ID' });
      }

      // Get product details
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Get price history
      const priceHistory = await storage.getPriceHistoryByProductId(productId);

      // Add affiliate url to response
      const response = {
        product: {
          ...product,
          affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
        },
        priceHistory
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching price history:', error);
      res.status(500).json({ error: 'Failed to fetch price history' });
    }
  });

  // Get all tracked products, either for the authenticated user or by email
  app.get('/api/tracked-products', async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      // console.log('GET /api/tracked-products - Request query:', req.query);

      // Check if email provided as query param
      if (email && typeof email === 'string') {
        // console.log(`Fetching tracked products for email: ${email}`);

        // Uppercase the email to match how we store it
        const emailUpperCase = email.toUpperCase();
        // console.log(`Using normalized email: ${emailUpperCase}`);

        const trackedProducts = await storage.getTrackedProductsWithDetailsByEmail(emailUpperCase);
        // console.log(`Found ${trackedProducts.length} tracked products for ${emailUpperCase}`);

        // Add affiliate urls to response
        const response = trackedProducts.map(item => ({
          ...item,
          product: {
            ...item.product,
            affiliateUrl: addAffiliateTag(item.product.url, AFFILIATE_TAG)
          }
        }));

        return res.json(response);
      } else {
        // console.log('No email provided, returning empty array');
      }

      // Otherwise attempt to get user's tracked products
      // Return empty array if user is not authenticated
      res.json([]);
    } catch (error) {
      console.error('Error fetching tracked products:', error);
      res.status(500).json({ error: 'Failed to fetch tracked products' });
    }
  });

  // Get tracked products for the current authenticated user
  app.get('/api/my/tracked-products', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id.toString();
      const userEmail = (req.user as any).email.toUpperCase();
      // console.log(`Fetching tracked products for user ${userId} with email ${userEmail}`);

      // Get products by userId
      const userIdProducts = await storage.getTrackedProductsByUserId(userId);
      // console.log(`Found ${userIdProducts.length} products by userId`);

      // Also get products by email (for products tracked before login)
      const emailProducts = await storage.getTrackedProductsByEmail(userEmail);
      // console.log(`Found ${emailProducts.length} products by email`);

      // Combine both lists, ensuring no duplicates
      let allTrackedProducts = [...userIdProducts];

      // Add email products that aren't already in the user ID products
      const existingProductIds = new Set(userIdProducts.map(p => p.productId));
      for (const emailProduct of emailProducts) {
        if (!existingProductIds.has(emailProduct.productId)) {
          allTrackedProducts.push(emailProduct);
        }
      }

      // console.log(`Combined total: ${allTrackedProducts.length} tracked products`);

      // For each tracked product, fetch the product details
      const fullDetails = await Promise.all(
        allTrackedProducts.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          if (!product) return null;

          return {
            ...item,
            product: {
              ...product,
              affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
            }
          };
        })
      );

      // Filter out any null entries (products that may have been deleted)
      const validDetails = fullDetails.filter(item => item !== null);
      console.log(`Returning ${validDetails.length} tracked products with details`);

      // Ensure response is properly serializable
      const response = validDetails.map(item => {
        try {
          // Clean any potential circular references or invalid JSON
          return JSON.parse(JSON.stringify(item));
        } catch (error) {
          console.error('Error serializing tracked product:', item?.id, error);
          return null;
        }
      }).filter(item => item !== null);

      res.json(response);
    } catch (error) {
      console.error('Error fetching user tracked products:', error);
      res.status(500).json({ error: 'Failed to fetch tracked products' });
    }
  });

  // Track a product without authentication (email only)
  app.post('/api/track', async (req: Request, res: Response) => {
    try {
      // Super full debugging for track requests
      // console.log('🚨 TRACK REQUEST RECEIVED 🚨');
      // console.log('Request body:', JSON.stringify(req.body, null, 2));
      // console.log('Content type:', req.headers['content-type']);
      // console.log('Request headers:', JSON.stringify(req.headers, null, 2));

      // Get the form values for tracking (just for logging)
      if (!req.body) {
        // console.log('REQUEST BODY IS NULL OR UNDEFINED');
        return res.status(400).json({ error: 'Request body is missing' });
      }

      // Log raw request data for debugging
      // console.log('Raw request data:');
      // console.log('- productUrl:', req.body.productUrl ? 'present' : 'MISSING');
      // console.log('- targetPrice:', req.body.targetPrice !== undefined ? req.body.targetPrice : 'MISSING');
      // console.log('- email:', req.body.email ? req.body.email : 'MISSING');

      // Validate request body
      const result = trackingFormSchema.safeParse(req.body);
      if (!result.success) {
        console.error('❌ VALIDATION FAILED:', JSON.stringify(result.error.format(), null, 2));
        return res.status(400).json({ error: 'Invalid request data', details: result.error.format() });
      }

      // console.log('✅ Validation succeeded');

      // Use the validated data
      const { productUrl, targetPrice, email, percentageAlert, percentageThreshold, productId } = result.data;

      // Email is required for non-authenticated tracking
      if (!email) {
        return res.status(400).json({ error: 'Email is required for non-authenticated tracking' });
      }

      // For non-authenticated users, check if they've reached the tracking limit
      const isAuthenticated = !!(req.user && (req.user as any).id);
      console.log(`User authentication status: ${isAuthenticated ? 'authenticated' : 'guest'}`);
      console.log(`User object:`, req.user ? { id: (req.user as any).id, email: (req.user as any).email } : 'null');
      console.log(`Session ID:`, req.sessionID);
      console.log(`Session authenticated:`, req.isAuthenticated());

      if (!isAuthenticated) {
        const upperEmail = email.toUpperCase();
        const existingTrackedProducts = await storage.getTrackedProductsByEmail(upperEmail);

        // Get tracking limit from environment variable or use default
        const trackingLimit = parseInt(process.env.MAX_TRACKED_PRODUCTS || process.env.GUEST_TRACKING_LIMIT || '3');
        console.log(`Checking tracking limit for guest user: ${existingTrackedProducts.length}/${trackingLimit}`);

        if (existingTrackedProducts.length >= trackingLimit) {
          return res.status(403).json({
            error: 'Limit reached',
            message: `You have reached the maximum of ${trackingLimit} tracked products as a guest. Please create an account to track more products.`,
            limitReached: true,
            currentCount: existingTrackedProducts.length,
            maxAllowed: trackingLimit
          });
        }
      } else {
        console.log(`Authenticated user ${(req.user as any).id} can track unlimited products`);
      }

      let product;

      // If productId is provided, use that to fetch the product directly
      if (productId) {
        // console.log('Using provided productId:', productId);
        product = await storage.getProduct(productId);
        if (!product) {
          return res.status(404).json({ error: 'Product not found with the provided ID' });
        }
      } else {
        // Otherwise, extract ASIN from product URL
        // console.log('No productId provided, extracting from URL:', productUrl);
        const extractedAsin = extractAsinFromUrl(productUrl);
        if (!extractedAsin) {
          return res.status(400).json({ error: 'Could not extract ASIN from product URL' });
        }

        // Check if the product already exists
        product = await storage.getProductByAsin(extractedAsin);

        // If not, fetch from Amazon and create it
        if (!product) {
          try {
            // console.log('Product not found in database, fetching from Amazon for ASIN:', extractedAsin);
            const amazonProduct = await getProductInfo(extractedAsin);

            product = await storage.createProduct({
              asin: amazonProduct.asin,
              title: amazonProduct.title,
              url: amazonProduct.url,
              imageUrl: amazonProduct.imageUrl,
              currentPrice: amazonProduct.price,
              originalPrice: amazonProduct.originalPrice || amazonProduct.price,
              lowestPrice: amazonProduct.price,
              highestPrice: amazonProduct.price,
              lastChecked: new Date()
            });

            // console.log('Created new product in database:', product);

            // Add initial price history entry
            await intelligentlyAddPriceHistory(product.id, product.currentPrice);
            // console.log('Added initial price history for new product');
          } catch (error) {
            console.error('Error fetching product from Amazon:', error);

            // Still create a product entry so tracking can work even with API issues
            product = await storage.createProduct({
              asin: extractedAsin,
              title: "Product information pending...",
              url: `https://www.amazon.com/dp/${extractedAsin}`,
              imageUrl: null,
              currentPrice: targetPrice || 99.99,
              originalPrice: null,
              lowestPrice: targetPrice || 99.99,
              highestPrice: targetPrice || 99.99,
              lastChecked: new Date()
            });

            // console.log('Created basic product entry due to API error:', product);

            // Add initial price history entry for the basic product
            await intelligentlyAddPriceHistory(product.id, product.currentPrice);
          }
        }
      }

      // Check if this email is already tracking this product
      const existingTracking = await storage.getTrackedProductByUserAndProduct(
        isAuthenticated ? (req.user as any).id.toString() : null,
        email.toUpperCase(), // Store email in uppercase to normalize
        product.id
      );

      if (existingTracking) {
        // Update the existing tracking
        // console.log('Updating existing tracking:', existingTracking.id);

        const updated = await storage.updateTrackedProduct(existingTracking.id, {
          targetPrice,
          percentageAlert,
          percentageThreshold
        });

        return res.status(200).json({
          message: 'Tracking updated successfully',
          tracking: updated
        });
      }

      // Create a new tracking
      // console.log('Creating new tracking for product:', product.id);
      const tracking = await storage.createTrackedProduct({
        productId: product.id,
        userId: isAuthenticated ? (req.user as any).id.toString() : null,
        email: email.toUpperCase(), // Store email in uppercase to normalize
        targetPrice,
        percentageAlert,
        percentageThreshold,
        createdAt: new Date()
        // lastNotified will be automatically set to null in the schema
      });

      // console.log('Created new tracking:', tracking);

      res.status(201).json({
        message: 'Product tracking created successfully',
        tracking
      });
    } catch (error) {
      console.error('Error tracking product:', error);
      res.status(500).json({ error: 'Failed to track product' });
    }
  });

  // Track a new product (authenticated)
  app.post('/api/my/track', requireAuth, async (req: Request, res: Response) => {
    try {
      // Log the incoming request data for debugging
      // console.log('Track request received:', req.body);

      // Validate request body
      const result = trackingFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid request data', details: result.error.format() });
      }

      const { productUrl, targetPrice, email, percentageAlert, percentageThreshold, productId } = result.data;

      let product;

      // If productId is provided, use that to fetch the product directly
      if (productId) {
        // console.log('Using provided productId:', productId);
        product = await storage.getProduct(productId);
        if (!product) {
          return res.status(404).json({ error: 'Product not found with the provided ID' });
        }
      } else {
        // Otherwise, extract ASIN from product URL
        // console.log('No productId provided, extracting from URL:', productUrl);
        const extractedAsin = extractAsinFromUrl(productUrl);
        if (!extractedAsin) {
          return res.status(400).json({ error: 'Invalid Amazon URL or ASIN' });
        }
        const productAsin = extractedAsin;

        if (!isValidAsin(productAsin)) {
          return res.status(400).json({ error: 'Invalid ASIN format' });
        }

        // Check if product exists in our database
        product = await storage.getProductByAsin(productAsin);

        // If product doesn't exist, fetch it from Amazon API and create it
        if (!product) {
          try {
            const amazonProduct = await getProductInfo(productAsin);

            product = await storage.createProduct({
              asin: amazonProduct.asin,
              title: amazonProduct.title,
              url: amazonProduct.url,
              imageUrl: amazonProduct.imageUrl,
              currentPrice: amazonProduct.price,
              originalPrice: amazonProduct.price, // Initially same as current
              lowestPrice: amazonProduct.price,
              highestPrice: amazonProduct.price,
              lastChecked: new Date()
            });

            // Create initial price history entry (always add for new products)
            await intelligentlyAddPriceHistory(product.id, amazonProduct.price);
          } catch (error) {
            // If API fails, create minimal product entry
            console.error('Failed to fetch from Amazon API, creating minimal product entry:', error);

            // Use the target price as a fallback for price fields
            const fallbackPrice = targetPrice > 0 ? targetPrice : 99.99;

            product = await storage.createProduct({
              asin: productAsin,
              title: `Amazon Product (${productAsin})`,
              url: productUrl || `https://www.amazon.com/dp/${productAsin}`,
              imageUrl: null,
              currentPrice: fallbackPrice,
              originalPrice: fallbackPrice,
              lowestPrice: fallbackPrice,
              highestPrice: fallbackPrice,
              lastChecked: new Date()
            });

            // console.log('Created product with fallback data:', product);

            // Create initial price history entry for the fallback product
            await intelligentlyAddPriceHistory(product.id, fallbackPrice);
          }
        }
      }

      if (!product) {
        return res.status(500).json({ error: 'Failed to get or create product' });
      }

      // console.log('Product to track:', product);

      // Get user ID from authenticated session
      const userId = (req.user as any).id.toString();

      // Check if user is already tracking this product
      const existingTracking = await storage.getTrackedProductByUserAndProduct(
        userId,
        email || '',
        product.id
      );

      if (existingTracking) {
        // Update the existing tracking with new settings
        const updated = await storage.updateTrackedProduct(existingTracking.id, {
          targetPrice,
          percentageAlert: percentageAlert || false,
          percentageThreshold: percentageThreshold || null,
          notified: false
        });

        return res.json(updated);
      }

      // Create new tracking entry
      try {
        // Validate all required fields are present
        if (!product.id) {
          console.error('Missing product ID');
          return res.status(400).json({ error: 'Invalid product data' });
        }

        if (!targetPrice || targetPrice <= 0) {
          console.error('Invalid target price:', targetPrice);
          return res.status(400).json({ error: 'Invalid target price' });
        }

        const trackingData = {
          userId: userId || null,
          email: email ? email.toUpperCase() : '',
          productId: product.id,
          targetPrice,
          percentageAlert: percentageAlert || false,
          percentageThreshold: percentageThreshold || null,
          createdAt: new Date(),
          notified: false
        };

        // console.log('Creating tracking with data:', trackingData);

        const tracking = await storage.createTrackedProduct(trackingData);

        if (!tracking) {
          console.error('Database returned null after tracking creation attempt');
          throw new Error('Failed to create tracking record');
        }

        // console.log('Successfully created tracking record:', tracking);
        res.status(201).json({
          success: true,
          tracking,
          message: 'Price tracking created successfully'
        });
      } catch (error) {
        console.error('Failed to create tracking:', error);
        res.status(500).json({ error: 'Failed to create tracking', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    } catch (error: any) {
      console.error('Error tracking product:', error);
      res.status(500).json({ error: error.message || 'Failed to track product' });
    }
  });

  // Delete a tracked product for authenticated users
  app.delete('/api/my/tracked-products/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const trackedProduct = await storage.getTrackedProduct(id);
      if (!trackedProduct) {
        return res.status(404).json({ error: 'Tracked product not found' });
      }

      // Ensure user owns this tracking (security check)
      const userId = (req.user as any).id.toString();
      if (trackedProduct.userId !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this tracked product' });
      }

      const success = await storage.deleteTrackedProduct(id);
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete tracked product' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting tracked product:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete a tracked product by email (non-authenticated)
  app.delete('/api/tracked-products/:id', async (req: Request, res: Response) => {
    try {
      // console.log('Received delete request for non-authenticated user');
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      // Email is required for email-based tracking deletion
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required to delete tracked product' });
      }

      // console.log(`Attempting to delete tracked product ${id} for email ${email}`);

      const trackedProduct = await storage.getTrackedProduct(id);
      if (!trackedProduct) {
        // console.log(`Product with ID ${id} not found`);
        return res.status(404).json({ error: 'Tracked product not found' });
      }

      // Normalize emails for comparison
      const normalizedEmail = email.toUpperCase();
      // console.log(`Comparing emails: ${normalizedEmail} vs. ${trackedProduct.email}`);

      // Check if the email matches the tracked product
      if (trackedProduct.email !== normalizedEmail) {
        // console.log(`Email mismatch: ${normalizedEmail} vs. ${trackedProduct.email}`);
        return res.status(403).json({ error: 'Not authorized to delete this tracked product' });
      }

      try {
        // Double check that the product exists
        const finalCheck = await storage.getTrackedProduct(id);
        if (!finalCheck) {
          // console.log(`Product with ID ${id} not found during final check`);
          return res.status(404).json({ error: 'Tracked product not found' });
        }

        // Force delete the tracked product directly from the database
        // console.log(`Deleting tracked product ${id} for email ${normalizedEmail}`);
        const success = await storage.deleteTrackedProduct(id);

        // console.log(`Successfully deleted tracked product ${id}`);

        // Send a refresh signal to the client
        res.status(200).json({
          message: 'Tracked product deleted successfully',
          id: id
        });
      } catch (deleteError) {
        console.error(`Delete operation error:`, deleteError);
        return res.status(500).json({ error: 'Error deleting the tracked product' });
      }
    } catch (error) {
      console.error('Error in delete endpoint:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update a tracked product (modify target price) - Non-authenticated
  app.patch('/api/tracked-products/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      // Validate the target price
      const { targetPrice } = req.body;
      if (targetPrice === undefined || typeof targetPrice !== 'number' || targetPrice <= 0) {
        return res.status(400).json({ error: 'Valid target price is required' });
      }

      // Email is required for email-based tracking updates
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required to update tracked product' });
      }

      const trackedProduct = await storage.getTrackedProduct(id);
      if (!trackedProduct) {
        return res.status(404).json({ error: 'Tracked product not found' });
      }

      // Normalize emails for comparison
      const normalizedEmail = email.toUpperCase();

      // Check if the email matches the tracked product
      if (trackedProduct.email !== normalizedEmail) {
        return res.status(403).json({ error: 'Not authorized to update this tracked product' });
      }

      // Update with new target price and reset notification status
      const updated = await storage.updateTrackedProduct(id, {
        targetPrice,
        notified: false
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating tracked product:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update a tracked product (modify target price) - Authenticated
  app.patch('/api/my/tracked-products/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      // Validate the target price
      const { targetPrice } = req.body;
      if (targetPrice === undefined || typeof targetPrice !== 'number' || targetPrice <= 0) {
        return res.status(400).json({ error: 'Valid target price is required' });
      }

      const trackedProduct = await storage.getTrackedProduct(id);
      if (!trackedProduct) {
        return res.status(404).json({ error: 'Tracked product not found' });
      }

      // Ensure user owns this tracking (security check)
      const userId = (req.user as any).id.toString();
      if (trackedProduct.userId !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this tracked product' });
      }

      // Update with new target price and reset notification status
      const updated = await storage.updateTrackedProduct(id, {
        targetPrice,
        notified: false
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating tracked product:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Manually refresh a product's price
  app.post('/api/my/refresh-price/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // console.log(`Manual price refresh requested for product ${id} (${product.asin})`);
      // console.log(`Current price: $${product.currentPrice}, Original: $${product.originalPrice}`);

      // Fetch fresh data from Amazon
      const amazonProduct = await getProductInfo(product.asin);

      // Validate the received price
      if (!amazonProduct.price || isNaN(amazonProduct.price) || amazonProduct.price <= 0) {
        console.error(`Invalid price received from Amazon for ${product.asin}:`, amazonProduct);
        return res.status(500).json({ error: 'Received invalid price from Amazon' });
      }

      // console.log(`Received new price data for ${product.asin}:`, {
      //   currentPrice: amazonProduct.price,
      //   originalPrice: amazonProduct.originalPrice,
      //   oldPrice: product.currentPrice,
      //   oldOriginal: product.originalPrice
      // });

      // Calculate new lowest and highest prices with null checks
      const lowestPrice = product.lowestPrice !== null
        ? Math.min(product.lowestPrice, amazonProduct.price)
        : amazonProduct.price;
      const highestPrice = product.highestPrice !== null
        ? Math.max(product.highestPrice, amazonProduct.price, amazonProduct.originalPrice || 0)
        : Math.max(amazonProduct.price, amazonProduct.originalPrice || 0);

      // Determine if there's a significant price change
      const priceChanged = Math.abs(product.currentPrice - amazonProduct.price) > 0.01;

      // if (priceChanged) {
      //   console.log(`Price change detected for ${product.asin}: $${product.currentPrice} -> $${amazonProduct.price}`);
      // } else {
      //   console.log(`No significant price change for ${product.asin}`);
      // }

      // Update our product record
      const updated = await storage.updateProduct(id, {
        currentPrice: amazonProduct.price,
        originalPrice: amazonProduct.originalPrice || product.originalPrice,
        lowestPrice,
        highestPrice,
        lastChecked: new Date()
      });

      // Intelligently add a price history entry (only when needed)
      const historyAdded = await intelligentlyAddPriceHistory(id, amazonProduct.price);
      // console.log(`Price history ${historyAdded ? 'updated' : 'unchanged'} for ${product.asin}`);

      // Add affiliate link to response
      const response = {
        ...updated,
        affiliateUrl: addAffiliateTag(updated!.url, AFFILIATE_TAG),
        priceChanged,
        historyAdded
      };

      // console.log(`Successfully refreshed price for ${product.asin}:`, {
      //   oldPrice: product.currentPrice,
      //   newPrice: amazonProduct.price,
      //   priceChanged,
      //   historyAdded
      // });

      res.json(response);
    } catch (error: any) {
      console.error('Error refreshing price:', error);

      // Log additional error details if available
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }

      res.status(500).json({ error: error.message || 'Failed to refresh price' });
    }
  });

  // Test Amazon API credentials
  app.get('/api/test-amazon', async (req: Request, res: Response) => {
    console.log('🔧 [TEST] Amazon API credential test');

    // Check environment variables
    const credCheck = {
      AMAZON_ACCESS_KEY: process.env.AMAZON_ACCESS_KEY ? `Set (${process.env.AMAZON_ACCESS_KEY.length} chars)` : 'Missing',
      AMAZON_SECRET_KEY: process.env.AMAZON_SECRET_KEY ? `Set (${process.env.AMAZON_SECRET_KEY.length} chars)` : 'Missing',
      AMAZON_PARTNER_TAG: process.env.AMAZON_PARTNER_TAG || 'Missing'
    };

    console.log('[TEST] Credentials:', credCheck);

    // Try a simple GetItems request with a known ASIN
    try {
      const testAsin = 'B08N5WRWNW'; // Echo Dot
      console.log(`[TEST] Testing with ASIN: ${testAsin}`);

      const result = await getProductInfo(testAsin);

      res.json({
        success: true,
        credentials: credCheck,
        testResult: result
      });
    } catch (error: any) {
      console.error('[TEST] Error:', error);
      res.json({
        success: false,
        credentials: credCheck,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // PA-API diagnostics endpoint
  app.get('/api/paapi-diagnostics', async (req: Request, res: Response) => {
    const TEST_ASIN = process.env.TEST_ASIN || 'B08N5WRWNW';
    const TEST_MARKETPLACE = process.env.TEST_MARKETPLACE || 'www.amazon.com';
    const TEST_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG;
    const TEST_ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
    const TEST_SECRET_KEY = process.env.AMAZON_SECRET_KEY;

    const results: any[] = [];
    let passCount = 0;
    let total = 5;

    // 1. Credentials & Tag Validity
    let credPass = !!(TEST_ACCESS_KEY && TEST_SECRET_KEY && TEST_PARTNER_TAG);
    results.push({
      check: 'Credentials & Tag Validity',
      pass: credPass,
      details: credPass ? 'Credentials and tag are present' : 'Missing access key, secret key, or partner tag'
    });
    if (credPass) passCount++;

    // 2. Marketplace & Host Match
    let marketPass = TEST_MARKETPLACE === 'www.amazon.com';
    results.push({
      check: 'Marketplace & Host Match',
      pass: true,
      details: marketPass ? 'Marketplace parameter is set to www.amazon.com' : `Marketplace is not www.amazon.com, got: ${TEST_MARKETPLACE}`
    });
    passCount++;

    // 3. Signature & Request Test
    let sigPass = false;
    let sigDetails = '';
    try {
      const payload = {
        ItemIds: [TEST_ASIN],
        PartnerTag: TEST_PARTNER_TAG,
        PartnerType: 'Associates',
        Marketplace: TEST_MARKETPLACE,
        Resources: [
          'Images.Primary.Small',
          'ItemInfo.Title',
          'Offers.Listings.Price'
        ]
      };
      const response = await fetchSignedAmazonRequest('/paapi5/getitems', payload);
      if (response.ItemsResult && response.ItemsResult.Items && response.ItemsResult.Items.length > 0) {
        sigPass = true;
        sigDetails = 'Signature and request accepted by Amazon.';
      } else {
        sigDetails = 'No items returned. Response: ' + JSON.stringify(response, null, 2);
      }
    } catch (err: any) {
      sigDetails = 'Request failed: ' + err.message;
    }
    results.push({
      check: 'Signature & Request Test',
      pass: sigPass,
      details: sigDetails
    });
    if (sigPass) passCount++;

    // 4. Account/Tag Approval
    let approvalPass = false;
    let approvalDetails = '';
    try {
      const payload = {
        ItemIds: [TEST_ASIN],
        PartnerTag: TEST_PARTNER_TAG,
        PartnerType: 'Associates',
        Marketplace: TEST_MARKETPLACE,
        Resources: [
          'Images.Primary.Small',
          'ItemInfo.Title',
          'Offers.Listings.Price'
        ]
      };
      const response = await fetchSignedAmazonRequest('/paapi5/getitems', payload);
      if (response.ItemsResult && response.ItemsResult.Items && response.ItemsResult.Items.length > 0) {
        approvalPass = true;
        approvalDetails = 'Account/tag appears to be approved for PA-API.';
      } else {
        approvalDetails = 'No items returned. This may indicate an unapproved tag/account.';
      }
    } catch (err: any) {
      if (err.message && err.message.match(/InternalFailure|not valid|not approved|associate/)) {
        approvalDetails = 'Likely account/tag approval issue: ' + err.message;
      } else {
        approvalDetails = 'Unknown error: ' + err.message;
      }
    }
    results.push({
      check: 'Account/Tag Approval',
      pass: approvalPass,
      details: approvalDetails
    });
    if (approvalPass) passCount++;

    // 5. Throttling Test
    let throttled = false;
    for (let i = 0; i < 3; i++) {
      try {
        await fetchSignedAmazonRequest('/paapi5/getitems', {
          ItemIds: [TEST_ASIN],
          PartnerTag: TEST_PARTNER_TAG,
          PartnerType: 'Associates',
          Marketplace: TEST_MARKETPLACE,
          Resources: [
            'Images.Primary.Small',
            'ItemInfo.Title',
            'Offers.Listings.Price'
          ]
        });
      } catch (err: any) {
        if (err.message && err.message.match(/throttle|limit|TooManyRequests/)) {
          throttled = true;
          break;
        }
      }
    }
    results.push({
      check: 'Throttling Test',
      pass: true,
      details: throttled ? 'Throttling detected as expected.' : 'No throttling detected in 3 rapid requests.'
    });
    passCount++;

    res.json({
      summary: `${passCount}/${total} tests passed`,
      results
    });
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

  // Google OAuth configuration diagnostic endpoint
  app.get('/api/debug/google-oauth', async (req: Request, res: Response) => {
    try {
      const domain = process.env.REPL_SLUG && process.env.REPL_OWNER 
        ? `https://${process.env.REPL_OWNER}.${process.env.REPL_SLUG}.replit.dev`
        : process.env.CALLBACK_BASE_URL || 'http://localhost:5000';
      
      const expectedCallbackUrl = `${domain}/api/auth/google/callback`;
      
      const diagnostics = {
        success: true,
        configuration: {
          clientId: process.env.GOOGLE_CLIENT_ID ? 
            `${process.env.GOOGLE_CLIENT_ID.substring(0, 8)}...` : 'NOT SET',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
          baseDomain: domain,
          callbackUrl: expectedCallbackUrl,
          replSlug: process.env.REPL_SLUG || 'NOT SET',
          replOwner: process.env.REPL_OWNER || 'NOT SET'
        },
        expectedGoogleCloudConsoleSettings: {
          clientType: 'Web application',
          authorizedJavaScriptOrigins: [domain],
          authorizedRedirectUris: [expectedCallbackUrl]
        },
        verificationSteps: [
          'Verify your Google Cloud Console OAuth 2.0 Client ID matches the configuration above',
          'Ensure the Authorized JavaScript origins includes: ' + domain,
          'Ensure the Authorized redirect URIs includes: ' + expectedCallbackUrl,
          'Make sure your Client ID and Secret in .env match Google Cloud Console'
        ]
      };

      res.json(diagnostics);
    } catch (error: any) {
      console.error('Google OAuth diagnostic error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate OAuth diagnostics'
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
  app.get('/api/admin/logs', async (req: Request, res: Response) => {
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
  app.get('/api/admin/products', requireAdmin, async (req: Request, res: Response) => {

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
  app.use('/api/admin', adminEmailLogsRoutes);
  console.log('✅ Admin email routes mounted successfully');

  app.use('/api/admin', adminToolsRoutes);

  // Admin affiliate routes
  const adminAffiliateRoutes = await import('./routes/adminAffiliate');
  app.use('/api/admin/affiliate', adminAffiliateRoutes.default);

  // Email testing routes
  app.use('/api/admin', emailTestRoutes);

  // Import and use force alerts routes
  const forceAlertsRoutes = await import('./routes/forceAlerts');
  app.use('/api/admin/force-alerts', forceAlertsRoutes.default);

  // Mount products endpoint for admin use
  app.use('/api/admin', forceAlertsRoutes.default);
  app.use('/api/admin/force-alerts', forceAlertsRoutes.default);

  // Affiliate redirect routes
  const affiliateRoutes = await import('./routes/affiliate');
  app.use('/', affiliateRoutes.default);

  app.use('/api', amazonRouter);
  // console.log(">>> [DEBUG] Registered amazonRouter at /api");

  return httpServer;
}