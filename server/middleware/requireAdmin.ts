import { Request, Response, NextFunction } from 'express';

const ADMIN_TOKEN = process.env.ADMIN_SECRET || process.env.ADMIN_TOKEN || '6f32d418c8234c93b85f0f41fda31cfb';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  console.log('[RequireAdmin] Request path:', req.path);
  console.log('[RequireAdmin] Headers auth:', req.headers.authorization);
  console.log('[RequireAdmin] Headers x-admin-token:', req.headers['x-admin-token']);
  console.log('[RequireAdmin] Headers x-admin-secret:', req.headers['x-admin-secret']);
  console.log('[RequireAdmin] Query token:', req.query.token);
  console.log('[RequireAdmin] Expected token:', ADMIN_TOKEN);

  // Check multiple token sources
  let token = null;

  // 1. Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    console.log('[RequireAdmin] Found token in Authorization header');
  }

  // 2. x-admin-token header (used by templates)
  if (!token) {
    token = req.headers['x-admin-token'] as string;
    if (token) console.log('[RequireAdmin] Found token in x-admin-token header');
  }

  // 3. x-admin-secret header (fallback)
  if (!token) {
    token = req.headers['x-admin-secret'] as string;
    if (token) console.log('[RequireAdmin] Found token in x-admin-secret header');
  }

  // 4. Query parameter (backward compatibility)
  if (!token) {
    token = req.query.token as string;
    if (token) console.log('[RequireAdmin] Found token in query parameter');
  }

  if (!token) {
    console.log('[RequireAdmin] No token found in any location');
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