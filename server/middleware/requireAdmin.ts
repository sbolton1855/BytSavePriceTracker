import { Request, Response, NextFunction } from 'express';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.ADMIN_SECRET || 'admin-test-token';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  console.log('[RequireAdmin] Headers:', req.headers.authorization);
  console.log('[RequireAdmin] Expected token:', ADMIN_TOKEN);

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Fallback to query parameter for backward compatibility
  if (!token) {
    token = req.query.token as string;
  }

  if (!token) {
    console.log('[RequireAdmin] No token found in header or query');
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  if (token !== ADMIN_TOKEN) {
    console.log('[RequireAdmin] Token mismatch. Got:', token, 'Expected:', ADMIN_TOKEN);
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  console.log('[RequireAdmin] Auth successful');
  next();
}