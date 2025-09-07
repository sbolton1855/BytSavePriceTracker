import { Request, Response, NextFunction } from 'express';

const ADMIN_TOKEN = process.env.ADMIN_SECRET || process.env.ADMIN_TOKEN || 'admin-test-token';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  console.log('[RequireAdmin] Request path:', req.path);
  console.log('[RequireAdmin] Headers auth:', req.headers.authorization);
  console.log('[RequireAdmin] Expected token length:', ADMIN_TOKEN?.length);
  console.log('[RequireAdmin] Token from env ADMIN_SECRET:', process.env.ADMIN_SECRET?.length ? 'SET' : 'NOT SET');

  // Only accept Authorization header with Bearer token
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[RequireAdmin] Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    console.log('[RequireAdmin] No token in Authorization header');
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  // Trim whitespace and compare
  const cleanToken = token.trim();
  const cleanExpected = ADMIN_TOKEN.trim();

  console.log('[RequireAdmin] Token lengths - received:', cleanToken.length, 'expected:', cleanExpected.length);

  if (cleanToken !== cleanExpected) {
    console.log('[RequireAdmin] Token mismatch. Got:', `"${cleanToken.substring(0, 8)}..."`, 'Expected:', `"${cleanExpected.substring(0, 8)}..."`);
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  console.log('[RequireAdmin] Auth successful for path:', req.path);
  next();
}