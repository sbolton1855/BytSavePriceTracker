console.log('Running from server/index.ts');
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureAuth } from "./authService";
import { adminSessionConfig, attachAdminToRequest } from "./middleware/adminSession";
import { adminSecurityMiddleware } from "./middleware/adminSecurity";
import adminAuthRoutes from "./routes/adminAuth";
import adminEmailRoutes from "./routes/adminEmail";
import adminEmailLogsRoutes from './routes/adminEmailLogs';
import sendgridWebhookRoutes from './routes/sendgridWebhook';
import LiveDealsPreview from "@/components/LiveDealsPreview";
import { scheduleTokenCleanup } from './utils/tokenCleanup';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sgMail from '@sendgrid/mail';
import { db } from './db'; // Assuming you have a db instance configured

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

// Function to send email with logging
async function sendEmail(recipient_email: string, subject: string, html_content: string): Promise<void> {
  console.log(`[sendEmail] Preparing to send email to: ${recipient_email} with subject: ${subject}`);

  const msg = {
    to: recipient_email,
    from: process.env.SENDGRID_FROM_EMAIL as string,
    subject: subject,
    html: html_content,
  };

  const logStatus = {
    recipient_email: recipient_email,
    subject: subject,
    status: 'pending',
  };

  try {
    console.log(`[SendGrid] Preparing email to ${recipient_email} with subject: ${subject}`);
    const response = await sgMail.send(msg);
    console.log(`[SendGrid] Email sent successfully.`);
    console.log(`[SendGrid] Response status code: ${response[0].statusCode}`);
    console.log(`[SendGrid] Response headers:`, response[0].headers);

    logStatus.status = 'sent';
  } catch (error) {
    console.error(`[SendGrid] Error sending email:`, error);
    logStatus.status = 'failed';
    if (error.response) {
      console.error(`[SendGrid] Error response body:`, error.response.body);
    }
  }

  try {
    console.log(`[DB] Inserting into email_logs with recipient_email: ${logStatus.recipient_email}, subject: ${logStatus.subject}, status: ${logStatus.status}`);
    await db.collection('email_logs').insertOne(logStatus);
    console.log(`[DB] Successfully inserted into email_logs.`);
  } catch (error) {
    console.error(`[DB] Error inserting into email_logs:`, error);
  }
}

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
  if (path.startsWith("/api") || path.startsWith("/email")) {
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
    if (path.startsWith("/api") || path.startsWith("/email")) {
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

// Create a standalone test route
const emailTestRouter = express.Router();
emailTestRouter.get('/test', async (req: Request, res: Response) => {
  console.log(`[Email Test Route] Starting execution. Query params:`, req.query);

  const testRecipient = 'test@example.com'; // Replace with your email address
  const testSubject = 'Test Email from /email/test';
  const testHtmlContent = '<p>This is a test email to verify the email sending pipeline.</p>';

  try {
    await sendEmail(testRecipient, testSubject, testHtmlContent);

    // Retrieve the latest log entry from email_logs
    const logEntry = await db.collection('email_logs').findOne(
      { recipient_email: testRecipient, subject: testSubject },
      { sort: { timestamp: -1 } } // Assuming you have a timestamp field
    );

    if (logEntry) {
      console.log(`[Email Test Route] Log entry found:`, logEntry);
      res.status(200).json({ message: 'Test email sent and log entry retrieved.', log: logEntry });
    } else {
      console.log(`[Email Test Route] Log entry not found.`);
      res.status(500).json({ message: 'Test email sent, but log entry could not be retrieved.' });
    }
  } catch (error) {
    console.error(`[Email Test Route] An error occurred:`, error);
    res.status(500).json({ message: 'An error occurred during the email test.', error: error });
  }
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize token cleanup
  scheduleTokenCleanup();

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
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`Server running on port ${port}`);

    // Start token cleanup scheduler
    scheduleTokenCleanup();
  });
})();