console.log('Running from server/index.ts');
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureAuth } from "./authService";
import { adminSessionConfig, attachAdminToRequest } from "./middleware/adminSession";
import { adminSecurityMiddleware } from "./middleware/adminSecurity";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminEmailRoutes from "./routes/adminEmail.js";
import adminEmailLogsRoutes from './routes/adminEmailLogs.js';
import sendgridWebhookRoutes from './routes/sendgridWebhook';
import { scheduleTokenCleanup } from './utils/tokenCleanup';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// Add CORS configuration for cookie handling
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`[CORS] Request from origin: ${origin}`);
  
  // Allow requests from the specific Replit origin
  const allowedOrigin = 'https://f387a246-37c5-4883-8c86-d114beeb1939-00-4mzroumvci77.spock.replit.dev';
  
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (origin === allowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // For same-origin requests (no Origin header)
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure authentication with OAuth providers
configureAuth(app);

// Admin session and security middleware (scoped to /admin paths)
app.use('/admin', adminSecurityMiddleware);
app.use('/admin', adminSessionConfig);
app.use('/admin', attachAdminToRequest);

// Admin routes
app.use('/admin/api', adminAuthRoutes);
app.use('/admin/api/email', adminEmailRoutes);
app.use('/api/admin', adminEmailLogsRoutes);

// Mount webhook routes (no auth required for webhooks)
app.use(sendgridWebhookRoutes);


// Enhanced logging middleware for debugging API failures
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  let capturedError: any = undefined;

  // Log incoming API requests
  if (path.startsWith("/api")) {
    console.log(`\n🌐 [REQUEST] ${req.method} ${path}`);
    if (Object.keys(req.query).length > 0) {
      console.log("[REQUEST] Query params:", req.query);
    }
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      console.log("[REQUEST] Body:", JSON.stringify(req.body, null, 2));
    }
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Capture errors
  const originalResStatus = res.status;
  res.status = function (code) {
    if (code >= 400) {
      console.error(`[RESPONSE] Error status ${code} for ${req.method} ${path}`);
    }
    return originalResStatus.apply(res, [code]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `[RESPONSE] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Add error details for failed requests
      if (res.statusCode >= 400) {
        console.error(`❌ ${logLine}`);
        if (capturedJsonResponse) {
          console.error("[RESPONSE] Error details:", JSON.stringify(capturedJsonResponse, null, 2));
        }
      } else {
        console.log(`✅ ${logLine}`);
        if (capturedJsonResponse && process.env.LOG_LEVEL === 'debug') {
          console.log("[RESPONSE] Success data:", JSON.stringify(capturedJsonResponse, null, 2).slice(0, 200) + "...");
        }
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const PORT = process.env.PORT || 5000;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);

    // Start token cleanup scheduler
    scheduleTokenCleanup();
  });
})();