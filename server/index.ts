
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import { setupRoutes } from './routes';

// Initialize cache
import '../server/lib/cache.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public health endpoint
app.get('/_health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Setup API routes first
setupRoutes(app);

// JSON 404 handler for API routes
app.use('/api', (_req, res) => {
  res.status(404).type('application/json').json({ error: 'not_found' });
});

// Static serving LAST (only if built)
const CLIENT_DIST = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  console.log('[STATIC] Serving', CLIENT_DIST);
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  console.log('[STATIC] No client build; skipping');
}

// Listen
const port = Number(process.env.PORT) || 5000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[BOOT] listening on :${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received, closing server...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, closing server...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});
