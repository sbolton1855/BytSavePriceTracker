
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';

// Rate limiter for admin login attempts
const adminLoginLimiter = new RateLimiterMemory({
  keyPrefix: 'admin_login',
  points: 5, // 5 attempts
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60 // block for 15 minutes
});

// CSRF protection for admin email routes
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
});

// Rate limiting middleware for admin login
export async function adminLoginRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const key = `${req.ip}_${req.body.email || 'unknown'}`;
    await adminLoginLimiter.consume(key);
    next();
  } catch (rejRes) {
    const totalHits = rejRes.hits || 0;
    const remainingPoints = rejRes.remainingPoints || 0;
    const msBeforeNext = rejRes.msBeforeNext || 1;

    res.status(429).json({
      error: 'Too many login attempts',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
}

// Security middleware bundle
export const adminSecurityMiddleware = [
  helmet(),
  cookieParser()
];
