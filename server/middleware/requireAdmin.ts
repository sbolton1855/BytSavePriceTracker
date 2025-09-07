import { Request, Response, NextFunction } from 'express';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.ADMIN_SECRET || 'admin-test-token';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  console.log('[RequireAdmin] Request path:', req.path);
  console.log('[RequireAdmin] Headers auth:', req.headers.authorization);
  console.log('[RequireAdmin] Query token:', req.query.token);
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

  // Additional fallback - check X-Admin-Secret header
  if (!token) {
    token = req.headers['x-admin-secret'] as string;
  }

  if (!token) {
    console.log('[RequireAdmin] No token found in header, query, or X-Admin-Secret header');
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  // Trim whitespace and compare
  const cleanToken = token.trim();
  const cleanExpected = ADMIN_TOKEN.trim();

  if (cleanToken !== cleanExpected) {
    console.log('[RequireAdmin] Token mismatch. Got:', `"${cleanToken}"`, 'Expected:', `"${cleanExpected}"`);
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  console.log('[RequireAdmin] Auth successful for path:', req.path);
  next();
}