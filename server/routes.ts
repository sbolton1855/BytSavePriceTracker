import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getProductInfo, searchProducts, extractAsinFromUrl, isValidAsin, addAffiliateTag } from "./amazonApi";
import { startPriceChecker } from "./priceChecker";
import { requireAuth, configureAuth } from "./authService";
import { z } from "zod";
import { trackingFormSchema } from "@shared/schema";

const AFFILIATE_TAG = process.env.AMAZON_PARTNER_TAG || 'bytsave-20';

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
      const deals = filteredProducts
        .filter(product => {
          // Ensure we have a valid originalPrice to compare against
          const originalPrice = product.originalPrice !== null ? product.originalPrice : product.highestPrice;
          return originalPrice > product.currentPrice;
        })
        .map(product => {
          // Ensure we have a valid originalPrice for calculation
          const originalPrice = product.originalPrice !== null ? product.originalPrice : product.highestPrice;
          // Avoid division by zero
          const discountPercentage = originalPrice > 0 
            ? ((originalPrice - product.currentPrice) / originalPrice) * 100 
            : 0;
          return {
            ...product,
            discountPercentage: Math.round(discountPercentage),
            // Add affiliate link
            affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
          };
        })
        // Sort by discount percentage descending
        .sort((a, b) => b.discountPercentage - a.discountPercentage)
        // Take top deals (use all for category-specific, otherwise limit to 8)
        .slice(0, category ? undefined : 8);
      
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
      const formattedResults = results.map(result => ({
        ...result,
        affiliateUrl: addAffiliateTag(result.url, AFFILIATE_TAG),
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

  // Track a new product
  app.post('/api/my/track', requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = trackingFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid request data', details: result.error.format() });
      }
      
      const { productUrl, targetPrice, email, percentageAlert, percentageThreshold } = result.data;
      
      // Extract ASIN from product URL
      const extractedAsin = extractAsinFromUrl(productUrl);
      if (!extractedAsin) {
        return res.status(400).json({ error: 'Invalid Amazon URL or ASIN' });
      }
      const productAsin = extractedAsin;
      
      if (!isValidAsin(productAsin)) {
        return res.status(400).json({ error: 'Invalid ASIN format' });
      }
      
      // Check if product exists in our database
      let product = await storage.getProductByAsin(productAsin);
      
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
        
        // Also create initial price history entry
        await storage.createPriceHistory({
          productId: product.id,
          price: amazonProduct.price,
          timestamp: new Date()
        });
      }
      
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
        notified: false,
        updatedAt: new Date()
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
      
      // Calculate new lowest and highest prices
      const lowestPrice = Math.min(product.lowestPrice, amazonProduct.price);
      const highestPrice = Math.max(product.highestPrice, amazonProduct.price);
      
      // Update our product record
      const updated = await storage.updateProduct(id, {
        currentPrice: amazonProduct.price,
        lowestPrice,
        highestPrice,
        lastChecked: new Date()
      });
      
      // Also create a price history entry
      await storage.createPriceHistory({
        productId: id,
        price: amazonProduct.price,
        timestamp: new Date()
      });
      
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