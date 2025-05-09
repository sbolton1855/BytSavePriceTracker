import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getProductInfo, extractAsinFromUrl, isValidAsin, addAffiliateTag } from "./amazonApi";
import { startPriceChecker } from "./priceChecker";
import { z } from "zod";
import { trackingFormSchema } from "@shared/schema";

const AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || 'bytsave-20';

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // API endpoints - prefix with /api
  
  // Track a new product
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
  
  // Get all tracked products for a user (by email)
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

  // Start price checker in the background
  startPriceChecker();

  return httpServer;
}
