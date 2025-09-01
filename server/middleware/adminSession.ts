
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import { Request, Response, NextFunction } from 'express';

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    admin?: {
      email: string;
      roles: string[];
    };
  }
}

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      admin?: {
        email: string;
        roles: string[];
      } | null;
    }
  }
}

// Create session store with Redis fallback to memory
let sessionStore: any;

// Try to connect to Redis if REDIS_URL exists
const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  try {
    const redisClient = createClient({ url: redisUrl });
    
    // Only log errors once, don't spam
    let hasLoggedError = false;
    redisClient.on('error', (err) => {
      if (!hasLoggedError) {
        console.warn('[ADMIN-SESSION] Redis connection error, falling back to memory store:', err.message);
        hasLoggedError = true;
      }
    });
    
    redisClient.on('connect', () => {
      console.log('[ADMIN-SESSION] Redis connected successfully');
    });
    
    // Try to connect, but don't fail if it doesn't work
    redisClient.connect().catch(() => {
      console.warn('[ADMIN-SESSION] Redis failed to connect, using memory store');
    });
    
    sessionStore = new RedisStore({
      client: redisClient,
      prefix: 'admin:sess:'
    });
  } catch (err) {
    console.warn('[ADMIN-SESSION] Redis setup failed, using memory store:', err instanceof Error ? err.message : 'Unknown error');
    sessionStore = undefined;
  }
} else {
  console.log('[ADMIN-SESSION] No REDIS_URL found, using memory store');
}

// Session configuration
export const adminSessionConfig = session({
  store: sessionStore, // Will be undefined if Redis failed, so it falls back to memory
  name: process.env.COOKIE_NAME || 'admin.sid',
  secret: process.env.SESSION_SECRET || 'dev-admin-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: (parseInt(process.env.SESSION_TTL_SECONDS || '1800')) * 1000 // 30 minutes default
  }
});

// Middleware to attach admin data to request
export function attachAdminToRequest(req: Request, res: Response, next: NextFunction) {
  req.admin = req.session?.admin || null;
  next();
}
