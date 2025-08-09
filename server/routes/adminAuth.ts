
import express from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { adminLoginRateLimit, csrfProtection } from '../middleware/adminSecurity';
import { requireAdmin } from '../middleware/requireAdmin';

const router = express.Router();

// Login schema validation
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// POST /admin/api/login
router.post('/login', adminLoginRateLimit, async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        details: validation.error.format()
      });
    }

    const { email, password } = validation.data;

    // Check if email matches admin email
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminPasswordHash) {
      console.error('Admin credentials not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (email !== adminEmail) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await argon2.verify(adminPasswordHash, password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.admin = {
      email: adminEmail,
      roles: ['admin']
    };

    res.json({ 
      success: true,
      admin: {
        email: adminEmail,
        roles: ['admin']
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/api/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    res.clearCookie(process.env.COOKIE_NAME || 'admin.sid', { path: '/admin' });
    res.json({ success: true });
  });
});

// GET /admin/api/me
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    authenticated: !!req.session.admin,
    admin: req.session.admin || null
  });
});

// GET /admin/api/csrf
router.get('/csrf', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

export default router;
