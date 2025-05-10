import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getProductInfo, searchProducts, extractAsinFromUrl, isValidAsin, addAffiliateTag } from "./amazonApi";
import { startPriceChecker } from "./priceChecker";
import { requireAuth, setupAuth } from "./replitAuth";
import { z } from "zod";
import { trackingFormSchema } from "@shared/schema";

const AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || 'bytsave-20';

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Configure authentication
  await setupAuth(app);

  // API endpoints - prefix with /api
  
  // Get highlighted deals (products with biggest price drops)
  app.get('/api/products/deals', async (req: Request, res: Response) => {
    try {
      // Get all products
      const products = await storage.getAllProducts();
      
      // Calculate price drops and filter products with discounts
      const deals = products
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
        // Take top deals
        .slice(0, 8);
      
      res.json(deals);
    } catch (error) {
      console.error('Error fetching deals:', error);
      res.status(500).json({ message: 'Failed to fetch deals' });
    }
  });
  
  // Search products by keyword
  app.get('/api/products/search', async (req, res) => {
    try {
      const keyword = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!keyword || keyword.length < 3) {
        return res.status(400).json({ 
          message: 'Search query must be at least 3 characters long' 
        });
      }
      
      const searchResults = await searchProducts(keyword, limit);
      
      // Add affiliate links to URLs
      const resultsWithAffiliateLinks = searchResults.map(result => ({
        ...result,
        affiliateUrl: addAffiliateTag(result.url, AFFILIATE_TAG)
      }));
      
      res.status(200).json(resultsWithAffiliateLinks);
    } catch (error) {
      console.error('Error searching products:', error);
      res.status(500).json({ message: 'Failed to search products' });
    }
  });
  
  // Get a single product by ID
  app.get('/api/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.status(200).json({
        ...product,
        affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
      });
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ message: 'Failed to fetch product' });
    }
  });
  
  // Track a new product (non-authenticated)
  app.post('/api/track', async (req, res) => {
    try {
      // Validate request body
      const validation = trackingFormSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid form data', 
          errors: validation.error.format() 
        });
      }
      
      const { productUrl, targetPrice, email } = validation.data;
      
      // Extract ASIN from URL or use directly if it's an ASIN
      let asin: string | null = null;
      
      if (productUrl.includes('amazon.com')) {
        asin = extractAsinFromUrl(productUrl);
      } else if (isValidAsin(productUrl)) {
        asin = productUrl;
      }
      
      if (!asin) {
        return res.status(400).json({
          message: 'Invalid Amazon URL or ASIN provided'
        });
      }
      
      // Check if product exists in our database
      let product = await storage.getProductByAsin(asin);
      
      // If not, fetch product info and create it
      if (!product) {
        const productInfo = await getProductInfo(asin);
        
        product = await storage.createProduct({
          asin: productInfo.asin,
          title: productInfo.title,
          url: productInfo.url,
          imageUrl: productInfo.imageUrl,
          currentPrice: productInfo.price,
          originalPrice: productInfo.originalPrice,
          lastChecked: new Date(),
          lowestPrice: productInfo.price,
          highestPrice: productInfo.price
        });
      }
      
      // Check if user is already tracking this product
      const existingTracking = await storage.getTrackedProductByUserAndProduct(
        null, // No user ID since we're using email
        email, 
        product.id
      );
      
      if (existingTracking) {
        // Update the existing tracking with new target price
        const updated = await storage.updateTrackedProduct(existingTracking.id, {
          targetPrice,
          notified: product.currentPrice <= targetPrice ? false : existingTracking.notified
        });
        
        return res.status(200).json({
          message: 'Updated existing product tracking',
          tracking: updated
        });
      }
      
      // Create new tracked product
      const trackedProduct = await storage.createTrackedProduct({
        userId: null, // No user ID since we're using email
        email,
        productId: product.id,
        targetPrice,
        createdAt: new Date()
      });
      
      res.status(201).json({
        message: 'Product tracking created successfully',
        tracking: trackedProduct
      });
    } catch (error) {
      console.error('Error tracking product:', error);
      res.status(500).json({ message: 'Failed to track product' });
    }
  });
  
  // Get all tracked products for a user (by email for non-authenticated users)
  app.get('/api/tracked-products', async (req, res) => {
    try {
      const email = req.query.email as string;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      const trackedProducts = await storage.getTrackedProductsWithDetailsByEmail(email);
      
      // Add affiliate links to product URLs
      const productsWithAffiliateLinks = trackedProducts.map(tp => ({
        ...tp,
        product: {
          ...tp.product,
          affiliateUrl: addAffiliateTag(tp.product.url, AFFILIATE_TAG)
        }
      }));
      
      res.status(200).json(productsWithAffiliateLinks);
    } catch (error) {
      console.error('Error fetching tracked products:', error);
      res.status(500).json({ message: 'Failed to fetch tracked products' });
    }
  });
  
  // Get all tracked products for authenticated user
  app.get('/api/my/tracked-products', requireAuth, async (req: Request, res: Response) => {
    try {
      // Use the authenticated user's ID
      const userId = req.user!.id;
      
      // Get tracked products for the authenticated user
      const trackedProducts = await storage.getTrackedProductsByUserId(userId);
      
      // Get full product details for each tracked product
      const result = [];
      for (const tp of trackedProducts) {
        const product = await storage.getProduct(tp.productId);
        if (product) {
          result.push({
            ...tp,
            product: {
              ...product,
              affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
            }
          });
        }
      }
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching tracked products for authenticated user:', error);
      res.status(500).json({ message: 'Failed to fetch tracked products' });
    }
  });
  
  // Track a new product (authenticated user)
  app.post('/api/my/track', requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = trackingFormSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid form data', 
          errors: validation.error.format() 
        });
      }
      
      const { productUrl, targetPrice } = validation.data;
      const userId = req.user!.id;
      
      // Extract ASIN from URL or use directly if it's an ASIN
      let asin: string | null = null;
      
      if (productUrl.includes('amazon.com')) {
        asin = extractAsinFromUrl(productUrl);
      } else if (isValidAsin(productUrl)) {
        asin = productUrl;
      }
      
      if (!asin) {
        return res.status(400).json({
          message: 'Invalid Amazon URL or ASIN provided'
        });
      }
      
      // Check if product exists in our database
      let product = await storage.getProductByAsin(asin);
      
      // If not, fetch product info and create it
      if (!product) {
        const productInfo = await getProductInfo(asin);
        
        product = await storage.createProduct({
          asin: productInfo.asin,
          title: productInfo.title,
          url: productInfo.url,
          imageUrl: productInfo.imageUrl,
          currentPrice: productInfo.price,
          originalPrice: productInfo.originalPrice,
          lastChecked: new Date(),
          lowestPrice: productInfo.price,
          highestPrice: productInfo.price
        });
      }
      
      // Check if user is already tracking this product
      const existingTracking = await storage.getTrackedProductByUserAndProduct(
        userId,
        req.user!.email, 
        product.id
      );
      
      if (existingTracking) {
        // Update the existing tracking with new target price
        const updated = await storage.updateTrackedProduct(existingTracking.id, {
          targetPrice,
          notified: product.currentPrice <= targetPrice ? false : existingTracking.notified
        });
        
        return res.status(200).json({
          message: 'Updated existing product tracking',
          tracking: updated
        });
      }
      
      // Create new tracked product
      const trackedProduct = await storage.createTrackedProduct({
        userId,
        email: req.user!.email,
        productId: product.id,
        targetPrice,
        createdAt: new Date()
      });
      
      res.status(201).json({
        message: 'Product tracking created successfully',
        tracking: trackedProduct
      });
    } catch (error) {
      console.error('Error tracking product for authenticated user:', error);
      res.status(500).json({ message: 'Failed to track product' });
    }
  });
  
  // Delete a tracked product
  app.delete('/api/tracked-products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const deleted = await storage.deleteTrackedProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Tracked product not found' });
      }
      
      res.status(200).json({ message: 'Tracked product deleted successfully' });
    } catch (error) {
      console.error('Error deleting tracked product:', error);
      res.status(500).json({ message: 'Failed to delete tracked product' });
    }
  });
  
  // Update a tracked product's target price
  app.patch('/api/tracked-products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const { targetPrice } = req.body;
      
      // Validate target price
      if (typeof targetPrice !== 'number' || targetPrice <= 0) {
        return res.status(400).json({ message: 'Invalid target price' });
      }
      
      const trackedProduct = await storage.getTrackedProduct(id);
      
      if (!trackedProduct) {
        return res.status(404).json({ message: 'Tracked product not found' });
      }
      
      // Get the product to check current price
      const product = await storage.getProduct(trackedProduct.productId);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Update the tracked product
      const updated = await storage.updateTrackedProduct(id, {
        targetPrice,
        // Reset notification status if price is already below target
        notified: product.currentPrice <= targetPrice ? false : trackedProduct.notified
      });
      
      res.status(200).json({
        message: 'Target price updated successfully',
        tracking: updated
      });
    } catch (error) {
      console.error('Error updating tracked product:', error);
      res.status(500).json({ message: 'Failed to update tracked product' });
    }
  });
  
  // Delete a tracked product (authenticated user)
  app.delete('/api/my/tracked-products/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      // Get the tracked product
      const trackedProduct = await storage.getTrackedProduct(id);
      
      if (!trackedProduct) {
        return res.status(404).json({ message: 'Tracked product not found' });
      }
      
      // Check if the tracked product belongs to the authenticated user
      if (trackedProduct.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to delete this tracked product' });
      }
      
      const deleted = await storage.deleteTrackedProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Failed to delete tracked product' });
      }
      
      res.status(200).json({ message: 'Tracked product deleted successfully' });
    } catch (error) {
      console.error('Error deleting tracked product for authenticated user:', error);
      res.status(500).json({ message: 'Failed to delete tracked product' });
    }
  });
  
  // Update a tracked product (authenticated user)
  app.patch('/api/my/tracked-products/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const { targetPrice } = req.body;
      
      // Validate target price
      if (typeof targetPrice !== 'number' || targetPrice <= 0) {
        return res.status(400).json({ message: 'Invalid target price' });
      }
      
      // Get the tracked product
      const trackedProduct = await storage.getTrackedProduct(id);
      
      if (!trackedProduct) {
        return res.status(404).json({ message: 'Tracked product not found' });
      }
      
      // Check if the tracked product belongs to the authenticated user
      if (trackedProduct.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to update this tracked product' });
      }
      
      // Get the product to check current price
      const product = await storage.getProduct(trackedProduct.productId);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Update the tracked product
      const updated = await storage.updateTrackedProduct(id, {
        targetPrice,
        // Reset notification status if price is already below target
        notified: product.currentPrice <= targetPrice ? false : trackedProduct.notified
      });
      
      res.status(200).json({
        message: 'Target price updated successfully',
        tracking: updated
      });
    } catch (error) {
      console.error('Error updating tracked product for authenticated user:', error);
      res.status(500).json({ message: 'Failed to update tracked product' });
    }
  });
  
  // Get price history for a product
  app.get('/api/products/:id/price-history', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      // Check if product exists
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Get price history
      const priceHistory = await storage.getPriceHistoryByProductId(id);
      
      res.status(200).json({
        product: {
          ...product,
          affiliateUrl: addAffiliateTag(product.url, AFFILIATE_TAG)
        },
        priceHistory
      });
    } catch (error) {
      console.error('Error fetching price history:', error);
      res.status(500).json({ message: 'Failed to fetch price history' });
    }
  });
  
  // Manually refresh a product's price
  app.post('/api/refresh-price/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const trackedProduct = await storage.getTrackedProduct(id);
      
      if (!trackedProduct) {
        return res.status(404).json({ message: 'Tracked product not found' });
      }
      
      const product = await storage.getProduct(trackedProduct.productId);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Fetch latest product info
      const productInfo = await getProductInfo(product.asin);
      
      // Update product
      const updatedProduct = await storage.updateProduct(product.id, {
        currentPrice: productInfo.price,
        originalPrice: productInfo.originalPrice || product.originalPrice,
        lastChecked: new Date(),
        lowestPrice: product.lowestPrice ? Math.min(product.lowestPrice, productInfo.price) : productInfo.price,
        highestPrice: product.highestPrice ? Math.max(product.highestPrice, productInfo.price) : productInfo.price
      });
      
      // Check if we need to update notification status
      if (productInfo.price <= trackedProduct.targetPrice && trackedProduct.notified) {
        await storage.updateTrackedProduct(trackedProduct.id, { notified: false });
      }
      
      res.status(200).json({
        message: 'Product price refreshed successfully',
        product: updatedProduct
      });
    } catch (error) {
      console.error('Error refreshing product price:', error);
      res.status(500).json({ message: 'Failed to refresh product price' });
    }
  });
  
  // Get price history for a product
  app.get('/api/price-history/:productId', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: 'Invalid product ID format' });
      }
      
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      const priceHistory = await storage.getPriceHistoryByProductId(productId);
      
      res.status(200).json(priceHistory);
    } catch (error) {
      console.error('Error fetching price history:', error);
      res.status(500).json({ message: 'Failed to fetch price history' });
    }
  });

  // Refresh price for authenticated user's tracked product
  app.post('/api/my/refresh-price/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      // Get the tracked product
      const trackedProduct = await storage.getTrackedProduct(id);
      
      if (!trackedProduct) {
        return res.status(404).json({ message: 'Tracked product not found' });
      }
      
      // Check if the tracked product belongs to the authenticated user
      if (trackedProduct.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to refresh this product' });
      }
      
      const product = await storage.getProduct(trackedProduct.productId);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Fetch latest product info
      const productInfo = await getProductInfo(product.asin);
      
      // Update product
      const updatedProduct = await storage.updateProduct(product.id, {
        currentPrice: productInfo.price,
        originalPrice: productInfo.originalPrice || product.originalPrice,
        lastChecked: new Date(),
        lowestPrice: product.lowestPrice ? Math.min(product.lowestPrice, productInfo.price) : productInfo.price,
        highestPrice: product.highestPrice ? Math.max(product.highestPrice, productInfo.price) : productInfo.price
      });
      
      // Check if we need to update notification status
      if (productInfo.price <= trackedProduct.targetPrice && trackedProduct.notified) {
        await storage.updateTrackedProduct(trackedProduct.id, { notified: false });
      }
      
      res.status(200).json({
        message: 'Product price refreshed successfully',
        product: updatedProduct
      });
    } catch (error) {
      console.error('Error refreshing product price for authenticated user:', error);
      res.status(500).json({ message: 'Failed to refresh product price' });
    }
  });
  
  // Start price checker in the background
  startPriceChecker();

  return httpServer;
}
