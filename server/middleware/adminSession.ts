
import session from 'express-session';
import RedisStore from 'connect-redis';
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

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

// Create session store
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'admin:sess:'
});

// Session configuration
export const adminSessionConfig = session({
  store: redisStore,
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
