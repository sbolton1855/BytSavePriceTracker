import { type Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { trackedProducts } from "../migrations/schema";
import { eq } from "drizzle-orm";

// Import all route modules
import amazonRoutes from "./routes/amazon";
import trackedProductsRoutes from "./routes/trackedProducts";
import dealsRoutes from "./routes/deals";
import analyticsRoutes from "./routes/analytics";
import systemHealthRoutes from "./routes/systemHealth";
import errorsRoutes from "./routes/errors";
import testRoutes from "./routes/test";

export function setupRoutes(app: Express): Promise<Server> {
  console.log('[BOOT] Registering API routes');

  // Mount all API routes
  app.use('/api/amazon', amazonRoutes);
  app.use('/api/tracked-products', trackedProductsRoutes);
  app.use('/api/deals', dealsRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/system', systemHealthRoutes);
  app.use('/api/errors', errorsRoutes);
  app.use('/api/test', testRoutes);

  // Legacy product tracking endpoint (alias)
  app.use('/api/products', trackedProductsRoutes);

  // Simple product tracking endpoint
  app.post("/api/track", async (req, res) => {
    try {
      console.log('[track] New tracking request');

      const { productUrl, targetPrice, email } = req.body;

      if (!productUrl || !targetPrice || !email) {
        return res.status(400).json({
          error: 'missing_fields',
          message: 'productUrl, targetPrice, and email are required'
        });
      }

      // Extract ASIN from Amazon URL
      const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/);
      if (!asinMatch) {
        return res.status(400).json({
          error: 'invalid_url',
          message: 'Invalid Amazon product URL'
        });
      }

      const asin = asinMatch[1];

      // For now, just store the tracking request
      // TODO: Implement actual product data fetching
      const result = await db.insert(trackedProducts).values({
        asin,
        email: email.toLowerCase(),
        targetPrice: parseFloat(targetPrice),
        title: `Product ${asin}`, // Placeholder
        currentPrice: parseFloat(targetPrice),
        image: '', // Placeholder
      }).returning();

      console.log('[track] ✅ Created tracking for', asin);

      res.json({
        success: true,
        message: 'Product tracking started',
        product: result[0]
      });

    } catch (error) {
      console.error('[track] ❌ Error:', error);
      res.status(500).json({
        error: 'tracking_failed',
        message: 'Failed to start tracking'
      });
    }
  });

  const server = createServer(app);
  console.log('[BOOT] Routes registered');

  return Promise.resolve(server);
}