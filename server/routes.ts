import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { getProductInfo, searchProducts, extractAsinFromUrl, isValidAsin, addAffiliateTag } from "./amazonApi";
import { startPriceChecker } from "./priceChecker";
import { requireAuth, configureAuth } from "./authService";
import { z } from "zod";
import { trackingFormSchema, type Product } from "@shared/schema";

const AFFILIATE_TAG = process.env.AMAZON_PARTNER_TAG || 'bytsave-20';

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
      console.log(`Creating first price history entry for product ${productId} at $${currentPrice}`);
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
      console.log(`Creating new price history entry for product ${productId} at $${currentPrice} (reason: ${reason})`);

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

    console.log(`Skipping price history entry for product ${productId} ($${currentPrice}) - no significant change`);
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  configureAuth(app);

  // Note: Auth routes are already set up in authService.ts

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
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      // Use the existing working search function from amazonApi
      const amazonItems = await searchProducts(q);
      
      // Transform Amazon response to our format and add affiliate links
      const formattedResults = await Promise.all(amazonItems.map(async (item: any) => {
        const asin = item.ASIN;
        const title = item.ItemInfo?.Title?.DisplayValue || 'Unknown Title';
        const imageUrl = item.Images?.Primary?.Medium?.URL || '';
        const priceAmount = item.Offers?.Listings?.[0]?.Price?.Amount || 0;
        const price = typeof priceAmount === 'number' ? priceAmount / 100 : 0; // Convert cents to dollars
        const url = `https://www.amazon.com/dp/${asin}?tag=${AFFILIATE_TAG}&linkCode=ogi&th=1&psc=1`;
        
        // Check if product exists in our database to get its ID
        const existingProduct = await storage.getProductByAsin(asin);

        return {
          asin,
          title,
          imageUrl,
          price,
          url,
          id: existingProduct?.id, // Include ID if product exists in DB
          affiliateUrl: url,
        };
      }));

      res.json(formattedResults);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Get product details by ASIN or URL
  app.get('/api/product', async (req: Request, res: Response) => {
    try {
      const { asin, url } = req.query;

      if (!asin && !url) {
        return res.status(400).json({ error: 'ASIN or URL is required' });
      }

      // Extract ASIN from URL or use provided ASIN
      let productAsin = '';
      if (url && typeof url === 'string') {
        const extractedAsin = extractAsinFromUrl(url);
        if (!extractedAsin) {
          return res.status(400).json({ error: 'Invalid Amazon URL' });
        }
        productAsin = extractedAsin;
      } else if (asin && typeof asin === 'string') {
        if (!isValidAsin(asin)) {
          return res.status(400).json({ error: 'Invalid ASIN format' });
        }
        productAsin = asin;
      }

      // Check if product exists in our database first
      let product = await storage.getProductByAsin(productAsin);

      if (!product) {
        // If not found in DB, try to fetch from Amazon API
        try {
          const amazonProduct = await getProductInfo(productAsin);

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
        } catch (error) {
          // If API fails, create minimal product entry
          console.log('Failed to fetch from Amazon API, creating minimal product entry:', error);
          product = await storage.createProduct({
            asin: productAsin,
            title: "Product information pending...",
            url: url as string,
            currentPrice: 0,
            lastChecked: new Date()
          });
        }
      }

      // Add affiliate url to response
      const response = {
        ...product,
        affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
      };

      res.json(response);
    } catch (error: any) {
      console.error('Product lookup error:', error);
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
      
      console.log('GET /api/tracked-products - Request query:', req.query);

      // Check if email provided as query param
      if (email && typeof email === 'string') {
        console.log(`Fetching tracked products for email: ${email}`);
        
        // Uppercase the email to match how we store it
        const emailUpperCase = email.toUpperCase();
        console.log(`Using normalized email: ${emailUpperCase}`);
        
        const trackedProducts = await storage.getTrackedProductsWithDetailsByEmail(emailUpperCase);
        console.log(`Found ${trackedProducts.length} tracked products for ${emailUpperCase}`);

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
        console.log('No email provided, returning empty array');
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
      console.log(`Fetching tracked products for user ${userId} with email ${userEmail}`);
      
      // Get products by userId
      const userIdProducts = await storage.getTrackedProductsByUserId(userId);
      console.log(`Found ${userIdProducts.length} products by userId`);
      
      // Also get products by email (for products tracked before login)
      const emailProducts = await storage.getTrackedProductsByEmail(userEmail);
      console.log(`Found ${emailProducts.length} products by email`);
      
      // Combine both lists, ensuring no duplicates
      let allTrackedProducts = [...userIdProducts];
      
      // Add email products that aren't already in the user ID products
      const existingProductIds = new Set(userIdProducts.map(p => p.productId));
      for (const emailProduct of emailProducts) {
        if (!existingProductIds.has(emailProduct.productId)) {
          allTrackedProducts.push(emailProduct);
        }
      }
      
      console.log(`Combined total: ${allTrackedProducts.length} tracked products`);

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
      const response = fullDetails.filter(item => item !== null);
      console.log(`Returning ${response.length} tracked products with details`);

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
      console.log('🚨 TRACK REQUEST RECEIVED 🚨');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('Content type:', req.headers['content-type']);
      console.log('Request headers:', JSON.stringify(req.headers, null, 2));
      
      // Get the form values for tracking (just for logging)
      if (!req.body) {
        console.log('REQUEST BODY IS NULL OR UNDEFINED');
        return res.status(400).json({ error: 'Request body is missing' });
      }
      
      // Log raw request data for debugging
      console.log('Raw request data:');
      console.log('- productUrl:', req.body.productUrl ? 'present' : 'MISSING');
      console.log('- targetPrice:', req.body.targetPrice !== undefined ? req.body.targetPrice : 'MISSING');
      console.log('- email:', req.body.email ? req.body.email : 'MISSING');

      // Validate request body
      const result = trackingFormSchema.safeParse(req.body);
      if (!result.success) {
        console.log('❌ VALIDATION FAILED:', JSON.stringify(result.error.format(), null, 2));
        return res.status(400).json({ error: 'Invalid request data', details: result.error.format() });
      }
      
      console.log('✅ Validation succeeded');
      
      // Use the validated data
      const { productUrl, targetPrice, email, percentageAlert, percentageThreshold, productId } = result.data;

      // Email is required for non-authenticated tracking
      if (!email) {
        return res.status(400).json({ error: 'Email is required for non-authenticated tracking' });
      }
      
      // For non-authenticated users, check if they've reached the limit of 3 tracked products
      if (!req.user) {
        const upperEmail = email.toUpperCase();
        const existingTrackedProducts = await storage.getTrackedProductsByEmail(upperEmail);
        
        if (existingTrackedProducts.length >= 3) {
          return res.status(403).json({ 
            error: 'Limit reached', 
            message: 'You have reached the maximum of 3 tracked products as a guest. Please create an account to track more products.',
            limitReached: true 
          });
        }
      }

      let product;

      // If productId is provided, use that to fetch the product directly
      if (productId) {
        console.log('Using provided productId:', productId);
        product = await storage.getProduct(productId);
        if (!product) {
          return res.status(404).json({ error: 'Product not found with the provided ID' });
        }
      } else {
        // Otherwise, extract ASIN from product URL
        console.log('No productId provided, extracting from URL:', productUrl);
        const extractedAsin = extractAsinFromUrl(productUrl);
        if (!extractedAsin) {
          return res.status(400).json({ error: 'Could not extract ASIN from product URL' });
        }

        // Check if the product already exists
        product = await storage.getProductByAsin(extractedAsin);

        // If not, fetch from Amazon and create it
        if (!product) {
          try {
            console.log('Product not found in database, fetching from Amazon for ASIN:', extractedAsin);
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
            
            console.log('Created new product in database:', product);
            
            // Add initial price history entry
            await intelligentlyAddPriceHistory(product.id, product.currentPrice);
            console.log('Added initial price history for new product');
          } catch (error) {
            console.error('Error fetching product from Amazon:', error);
            
            // Still create a product entry so tracking can work even with API issues
            product = await storage.createProduct({
              asin: extractedAsin,
              title: `Amazon Product (${extractedAsin})`,
              url: `https://www.amazon.com/dp/${extractedAsin}`,
              imageUrl: null,
              currentPrice: targetPrice || 99.99,
              originalPrice: null,
              lowestPrice: targetPrice || 99.99,
              highestPrice: targetPrice || 99.99,
              lastChecked: new Date()
            });
            
            console.log('Created basic product entry due to API error:', product);
            
            // Add initial price history entry for the basic product
            await intelligentlyAddPriceHistory(product.id, product.currentPrice);
          }
        }
      }

      // Check if this email is already tracking this product
      const existingTracking = await storage.getTrackedProductByUserAndProduct(
        null, 
        email.toUpperCase(), // Store email in uppercase to normalize
        product.id
      );

      if (existingTracking) {
        // Update the existing tracking
        console.log('Updating existing tracking:', existingTracking.id);

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
      console.log('Creating new tracking for product:', product.id);
      const tracking = await storage.createTrackedProduct({
        productId: product.id,
        userId: null, // No user for email-only tracking
        email: email.toUpperCase(), // Store email in uppercase to normalize
        targetPrice,
        percentageAlert,
        percentageThreshold,
        createdAt: new Date()
        // lastNotified will be automatically set to null in the schema
      });

      console.log('Created new tracking:', tracking);

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
      console.log('Track request received:', req.body);

      // Validate request body
      const result = trackingFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid request data', details: result.error.format() });
      }

      const { productUrl, targetPrice, email, percentageAlert, percentageThreshold, productId } = result.data;

      let product;

      // If productId is provided, use that to fetch the product directly
      if (productId) {
        console.log('Using provided productId:', productId);
        product = await storage.getProduct(productId);
        if (!product) {
          return res.status(404).json({ error: 'Product not found with the provided ID' });
        }
      } else {
        // Otherwise, extract ASIN from product URL
        console.log('No productId provided, extracting from URL:', productUrl);
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
            console.log('Failed to fetch from Amazon API, creating minimal product entry:', error);
            
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
            
            console.log('Created product with fallback data:', product);
            
            // Create initial price history entry for the fallback product
            await intelligentlyAddPriceHistory(product.id, fallbackPrice);
          }
        }
      }

      if (!product) {
        return res.status(500).json({ error: 'Failed to get or create product' });
      }

      console.log('Product to track:', product);

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
        
        console.log('Creating tracking with data:', trackingData);
        
        const tracking = await storage.createTrackedProduct(trackingData);

        if (!tracking) {
          console.error('Database returned null after tracking creation attempt');
          throw new Error('Failed to create tracking record');
        }

        console.log('Successfully created tracking record:', tracking);
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
      console.log('Received delete request for non-authenticated user');
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }
      
      // Email is required for email-based tracking deletion
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required to delete tracked product' });
      }
      
      console.log(`Attempting to delete tracked product ${id} for email ${email}`);
      
      const trackedProduct = await storage.getTrackedProduct(id);
      if (!trackedProduct) {
        console.log(`Product with ID ${id} not found`);
        return res.status(404).json({ error: 'Tracked product not found' });
      }
      
      // Normalize emails for comparison
      const normalizedEmail = email.toUpperCase();
      console.log(`Comparing emails: ${normalizedEmail} vs. ${trackedProduct.email}`);
      
      // Check if the email matches the tracked product
      if (trackedProduct.email !== normalizedEmail) {
        console.log(`Email mismatch: ${normalizedEmail} vs. ${trackedProduct.email}`);
        return res.status(403).json({ error: 'Not authorized to delete this tracked product' });
      }
      
      try {
        // Double check that the product exists
        const finalCheck = await storage.getTrackedProduct(id);
        if (!finalCheck) {
          console.log(`Product with ID ${id} not found during final check`);
          return res.status(404).json({ error: 'Tracked product not found' });
        }
        
        // Force delete the tracked product directly from the database
        console.log(`Deleting tracked product ${id} for email ${normalizedEmail}`);
        const success = await storage.deleteTrackedProduct(id);
        
        console.log(`Successfully deleted tracked product ${id}`);
        
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

  // Update a tracked product (modify target price)
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

      console.log(`Manual price refresh requested for product ${id} (${product.asin})`);
      console.log(`Current price: $${product.currentPrice}, Original: $${product.originalPrice}`);

      // Fetch fresh data from Amazon
      const amazonProduct = await getProductInfo(product.asin);

      // Validate the received price
      if (!amazonProduct.price || isNaN(amazonProduct.price) || amazonProduct.price <= 0) {
        console.error(`Invalid price received from Amazon for ${product.asin}:`, amazonProduct);
        return res.status(500).json({ error: 'Received invalid price from Amazon' });
      }

      console.log(`Received new price data for ${product.asin}:`, {
        currentPrice: amazonProduct.price,
        originalPrice: amazonProduct.originalPrice,
        oldPrice: product.currentPrice,
        oldOriginal: product.originalPrice
      });

      // Calculate new lowest and highest prices with null checks
      const lowestPrice = product.lowestPrice !== null
        ? Math.min(product.lowestPrice, amazonProduct.price)
        : amazonProduct.price;
      const highestPrice = product.highestPrice !== null
        ? Math.max(product.highestPrice, amazonProduct.price, amazonProduct.originalPrice || 0)
        : Math.max(amazonProduct.price, amazonProduct.originalPrice || 0);

      // Determine if there's a significant price change
      const priceChanged = Math.abs(product.currentPrice - amazonProduct.price) > 0.01;
      
      if (priceChanged) {
        console.log(`Price change detected for ${product.asin}: $${product.currentPrice} -> $${amazonProduct.price}`);
      } else {
        console.log(`No significant price change for ${product.asin}`);
      }

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
      console.log(`Price history ${historyAdded ? 'updated' : 'unchanged'} for ${product.asin}`);

      // Add affiliate link to response
      const response = {
        ...updated,
        affiliateUrl: addAffiliateTag(updated!.url, AFFILIATE_TAG),
        priceChanged,
        historyAdded
      };

      console.log(`Successfully refreshed price for ${product.asin}:`, {
        oldPrice: product.currentPrice,
        newPrice: amazonProduct.price,
        priceChanged,
        historyAdded
      });

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

  // Start price checker background service
  startPriceChecker();

  return httpServer;
}