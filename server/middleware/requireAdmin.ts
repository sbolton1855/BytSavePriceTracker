
import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.admin) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Check for token in header first, then query params
  const token = req.headers['x-admin-token'] || req.query.token;
  
  if (!token || token !== process.env.ADMIN_SECRET) {
    console.log('Admin auth failed:', {
      headerToken: !!req.headers['x-admin-token'],
      queryToken: !!req.query.token,
      expectedSecret: !!process.env.ADMIN_SECRET
    });
    return res.status(403).json({ error: 'unauthorized' });
  }

  next();
}
