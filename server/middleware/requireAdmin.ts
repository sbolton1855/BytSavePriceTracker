
import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret) {
    console.error('[admin-auth] ADMIN_SECRET not configured');
    return res.status(500).json({
      error: 'admin_not_configured',
      message: 'Admin authentication not properly configured'
    });
  }
  
  // Check x-admin-token header first, then ?token= query parameter
  const token = req.headers['x-admin-token'] as string || req.query.token as string;
  
  if (!token) {
    return res.status(401).json({
      error: 'missing_token',
      message: 'Admin token required'
    });
  }
  
  if (token !== adminSecret) {
    console.error('[admin-auth] Invalid admin token attempt');
    return res.status(403).json({
      error: 'invalid_token',
      message: 'Invalid admin token'
    });
  }
  
  // Token is valid, continue
  next();
}
