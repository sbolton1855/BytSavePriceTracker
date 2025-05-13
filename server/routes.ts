import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getProductInfo, searchProducts, extractAsinFromUrl, isValidAsin, addAffiliateTag } from "./amazonApi";
import { startPriceChecker } from "./priceChecker";
import { requireAuth, configureAuth } from "./authService";
import { z } from "zod";
import { trackingFormSchema } from "@shared/schema";

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
    const significantTimePassed = hoursSinceLastUpdate > 12; // 12 hour threshold
    
    if (priceChanged || significantTimePassed) {
      const reason = priceChanged ? "price changed" : "time threshold exceeded";
      console.log(`Creating new price history entry for product ${productId} at $${currentPrice} (reason: ${reason})`);
      
      await storage.createPriceHistory({
        productId,
        price: currentPrice,
        timestamp: new Date()
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  configureAuth(app);

  // Note: Auth routes are already set up in authService.ts

  // Create HTTP server
  const httpServer = createServer(app);

  // API endpoints - prefix with /api
  
  // Get highlighted deals (products with biggest price drops)
  app.get('/api/products/deals', async (req: Request, res: Response) => {
    try {
      // Extract category filter if provided
      const { category } = req.query;
      
      // Get all products
      const products = await storage.getAllProducts();
      
      // Define category-based filters for promotions
      const categoryFilters = {
        beauty: (product: any) => 
          product.title.toLowerCase().includes("beauty") || 
          product.title.toLowerCase().includes("makeup") || 
          product.title.toLowerCase().includes("skincare") || 
          product.title.toLowerCase().includes("haircare") ||
          product.title.toLowerCase().includes("fragrance"),
        
        seasonal: (product: any) => {
          // Determine current season
          const now = new Date();
          const month = now.getMonth();
          
          // Spring: March-May (2-4), Summer: June-August (5-7), Fall: Sept-Nov (8-10), Winter: Dec-Feb (11, 0, 1)
          const seasonalKeywords = {
            spring: ["spring", "easter", "gardening", "cleaning", "renewal"],
            summer: ["summer", "beach", "pool", "vacation", "outdoors", "bbq", "grill"],
            fall: ["fall", "autumn", "halloween", "thanksgiving", "harvest"],
            winter: ["winter", "christmas", "holiday", "snow", "gift"]
          };
          
          let currentSeasonKeywords;
          if (month >= 2 && month <= 4) currentSeasonKeywords = seasonalKeywords.spring;
          else if (month >= 5 && month <= 7) currentSeasonKeywords = seasonalKeywords.summer;
          else if (month >= 8 && month <= 10) currentSeasonKeywords = seasonalKeywords.fall;
          else currentSeasonKeywords = seasonalKeywords.winter;
          
          return currentSeasonKeywords.some(keyword => 
            product.title.toLowerCase().includes(keyword)
          );
        },
        
        events: (product: any) => {
          // Check for event keywords
          const eventKeywords = [
            "prime day", "black friday", "cyber monday", "deal", "promotion", 
            "limited time", "special offer", "sale", "discount", "clearance"
          ];
          
          return eventKeywords.some(keyword => 
            product.title.toLowerCase().includes(keyword)
          );
        }
      };
      
      // Apply category filter if specified
      let filteredProducts = products;
      if (category && typeof category === 'string' && Object.keys(categoryFilters).includes(category)) {
        filteredProducts = products.filter((categoryFilters as any)[category]);
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
      
      // If we have too few deals for a good display, include some recently added products
      if (deals.length < 5) {
        console.log('Not enough deals found, adding recently added products');
        
        // Get recently added products (that aren't already in the deals list)
        const existingIds = new Set(deals.map(d => d.id));
        const recentProducts = filteredProducts
          .filter(p => !existingIds.has(p.id))
          .sort((a, b) => {
            // Sort by lastChecked date (newest first)
            const aDate = a.lastChecked ? new Date(a.lastChecked).getTime() : 0;
            const bDate = b.lastChecked ? new Date(b.lastChecked).getTime() : 0;
            return bDate - aDate;
          })
          .slice(0, 5) // Take up to 5 recent products
          .map(product => {
            // Format them like deals
            const originalPrice = product.originalPrice !== null ? product.originalPrice : product.highestPrice;
            // Use a safe default if originalPrice is null/undefined
            const safeOriginalPrice = originalPrice ?? product.currentPrice;
            
            const discountPercentage = safeOriginalPrice > 0 
              ? ((safeOriginalPrice - product.currentPrice) / safeOriginalPrice) * 100 
              : 0;
            
            return {
              ...product,
              discountPercentage: Math.round(discountPercentage),
              savings: Math.round((safeOriginalPrice - product.currentPrice) * 100) / 100,
              affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG),
              isNewAddition: true // Flag to identify recent additions
            };
          });
        
        // Combine the two lists
        deals = [...deals, ...recentProducts];
      }
      
      // Take top deals (use all for category-specific, otherwise limit to 8)
      deals = deals.slice(0, category ? undefined : 8);
      
      res.json(deals);
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
      
      const results = await searchProducts(q);
      
      // Format results with affiliate links
      // Format results with affiliate links, also check if product exists in DB to get ID
      const formattedResults = await Promise.all(results.map(async result => {
        // Check if product exists in our database to get its ID
        const existingProduct = await storage.getProductByAsin(result.asin);
        
        return {
          ...result,
          id: existingProduct?.id, // Include ID if product exists in DB
          affiliateUrl: addAffiliateTag(result.url, AFFILIATE_TAG),
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
        // If not found in DB, fetch from Amazon API
        const amazonProduct = await getProductInfo(productAsin);
        
        // Save to our database
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
      
      // Check if email provided as query param
      if (email && typeof email === 'string') {
        const trackedProducts = await storage.getTrackedProductsWithDetailsByEmail(email);
        
        // Add affiliate urls to response
        const response = trackedProducts.map(item => ({
          ...item,
          product: {
            ...item.product,
            affiliateUrl: addAffiliateTag(item.product.url, AFFILIATE_TAG)
          }
        }));
        
        return res.json(response);
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
      const trackedProducts = await storage.getTrackedProductsByUserId(userId);
      
      // For each tracked product, fetch the product details
      const fullDetails = await Promise.all(
        trackedProducts.map(async (item) => {
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
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching user tracked products:', error);
      res.status(500).json({ error: 'Failed to fetch tracked products' });
    }
  });

  // Track a product without authentication (email only)
  app.post('/api/track', async (req: Request, res: Response) => {
    try {
      // Log the incoming request data for debugging
      console.log('Non-auth track request received:', req.body);
      
      // Validate request body
      const result = trackingFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid request data', details: result.error.format() });
      }
      
      const { productUrl, targetPrice, email, percentageAlert, percentageThreshold, productId } = result.data;
      
      // Email is required for non-authenticated tracking
      if (!email) {
        return res.status(400).json({ error: 'Email is required for non-authenticated tracking' });
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
            return res.status(500).json({ error: 'Failed to fetch product information' });
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
      const tracking = await storage.createTrackedProduct({
        userId,
        email,
        productId: product.id,
        targetPrice,
        percentageAlert: percentageAlert || false,
        percentageThreshold: percentageThreshold || null,
        createdAt: new Date()
      });
      
      console.log('Created new tracking:', tracking);
      res.status(201).json(tracking);
    } catch (error: any) {
      console.error('Error tracking product:', error);
      res.status(500).json({ error: error.message || 'Failed to track product' });
    }
  });

  // Delete a tracked product
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
      
      // Fetch fresh data from Amazon
      const amazonProduct = await getProductInfo(product.asin);
      
      // Calculate new lowest and highest prices with null checks
      const lowestPrice = product.lowestPrice !== null
        ? Math.min(product.lowestPrice, amazonProduct.price)
        : amazonProduct.price;
      const highestPrice = product.highestPrice !== null
        ? Math.max(product.highestPrice, amazonProduct.price)
        : amazonProduct.price;
      
      // Update our product record
      const updated = await storage.updateProduct(id, {
        currentPrice: amazonProduct.price,
        lowestPrice,
        highestPrice,
        lastChecked: new Date()
      });
      
      // Intelligently add a price history entry (only when needed)
      await intelligentlyAddPriceHistory(id, amazonProduct.price);
      
      // Add affiliate link to response
      const response = {
        ...updated,
        affiliateUrl: addAffiliateTag(updated!.url, AFFILIATE_TAG)
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('Error refreshing price:', error);
      res.status(500).json({ error: error.message || 'Failed to refresh price' });
    }
  });

  // Start price checker background service
  startPriceChecker();

  return httpServer;
}