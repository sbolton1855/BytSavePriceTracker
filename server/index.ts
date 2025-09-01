
console.log('[BOOT] Running from server/index.ts');
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureAuth } from "./authService";
import { adminSessionConfig, attachAdminToRequest } from "./middleware/adminSession";
import { adminSecurityMiddleware } from "./middleware/adminSecurity";
import adminAuthRoutes from "./routes/adminAuth";
import adminEmailRoutes from "./routes/adminEmail";

const app = express();

// Make app available for email logging fallback
module.exports = { app };
(global as any).app = app;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health endpoint first
app.get('/_health', (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// Configure authentication with OAuth providers
configureAuth(app);

// Admin session and security middleware (scoped to /admin paths)
app.use('/admin', adminSecurityMiddleware);
app.use('/admin', adminSessionConfig);
app.use('/admin', attachAdminToRequest);

// Admin routes
app.use('/admin/api', adminAuthRoutes);
app.use('/admin/api/email', adminEmailRoutes);

// Enhanced logging middleware for API requests only
app.use('/api', (req, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  console.log(`[API] ${req.method} ${path}`);
  
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.error(`[API] ❌ ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    } else {
      console.log(`[API] ✅ ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  
  next();
});

(async () => {
  // Register all API routes first
  const server = await registerRoutes(app);

  // Global error handler for API routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`[API] Error ${status}:`, message);
    res.status(status).json({ 
      error: 'internal_error',
      message,
      timestamp: new Date().toISOString()
    });
  });

  // API 404 guard - prevent API routes from falling through to SPA
  app.use('/api/*', (req, res) => {
    console.log(`[API] 404 - ${req.path}`);
    res.status(404).type('application/json').json({
      error: 'not_found',
      path: req.path,
      timestamp: new Date().toISOString()
    });
  });

  // Only setup static serving if we're in production or if client build exists
  const clientPath = path.resolve('./client');
  const buildPath = path.resolve('./dist/public');
  
  if (app.get("env") === "development") {
    console.log('[BOOT] Development mode - setting up Vite');
    await setupVite(app, server);
  } else {
    console.log('[STATIC] Production mode - serving static files');
    try {
      // Check if build exists
      const fs = await import('fs');
      if (fs.existsSync(buildPath)) {
        app.use(express.static(buildPath));
        console.log('[STATIC] Serving built client from', buildPath);
      } else if (fs.existsSync(clientPath)) {
        app.use(express.static(clientPath));
        console.log('[STATIC] Serving client from', clientPath);
      } else {
        console.log('[STATIC] No client build found, skipping static serving');
      }
      
      // SPA fallback - serve index.html for any non-API routes
      app.get('*', (req, res) => {
        const indexPath = fs.existsSync(path.join(buildPath, 'index.html')) 
          ? path.join(buildPath, 'index.html')
          : path.join(clientPath, 'index.html');
          
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).json({ error: 'not_found', message: 'Client not built' });
        }
      });
    } catch (error) {
      console.error('[STATIC] Error setting up static serving:', error);
    }
  }

  // Use PORT from environment or default to 5000
  const port = process.env.PORT || 5000;
  server.listen({
    port: Number(port),
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`[BOOT] Server running on port ${port}`);
    console.log(`[BOOT] Health check: http://0.0.0.0:${port}/_health`);
  });
})();
