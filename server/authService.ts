import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, passwordResetTokens } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { storage } from "./storage";
import { pool } from "./db";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import sgMail from '@sendgrid/mail';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Extend the Express.User type
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      profileImageUrl?: string | null;
      provider?: string | null;
      providerId?: string | null;
    }
  }
}

// Password utility functions
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    // Check if stored password has the correct format (hash.salt)
    if (!stored || !stored.includes('.')) {
      console.error('Invalid stored password format');
      return false;
    }

    const [hashed, salt] = stored.split('.');

    if (!hashed || !salt) {
      console.error('Missing hash or salt components');
      return false;
    }

    // Convert hash to buffer
    const hashedBuf = Buffer.from(hashed, 'hex');

    // Hash the supplied password with the same salt
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

    // Compare the two buffers
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error in password comparison:', error);
    return false; // Return false on any error
  }
}

// Helper function to convert DB user to Express.User
function dbUserToExpressUser(dbUser: any): Express.User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    username: dbUser.username,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    profileImageUrl: dbUser.profileImageUrl,
    provider: dbUser.provider,
    providerId: dbUser.providerId
  };
}

// JWT secret for password reset tokens
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || Math.random().toString(36).substring(2);

// Check if SendGrid is configured
const isEmailConfigured = () => {
  return !!(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
};

// Helper function to get the correct domain for OAuth callbacks
function getBaseDomain(): string {
  // First priority: BASE_URL (most flexible for deployment)
  if (process.env.BASE_URL) {
    console.log(`🌐 Using BASE_URL for OAuth: ${process.env.BASE_URL}`);
    return process.env.BASE_URL;
  }
  
  // Second priority: REPLIT_APP_URL (reliable for deployed apps)
  if (process.env.REPLIT_APP_URL) {
    const appUrl = process.env.REPLIT_APP_URL;
    console.log(`🌐 Using REPLIT_APP_URL for OAuth: ${appUrl}`);
    return appUrl;
  }
  
  // Third priority: Custom domain override
  if (process.env.CALLBACK_BASE_URL) {
    console.log(`🌐 Using CALLBACK_BASE_URL for OAuth: ${process.env.CALLBACK_BASE_URL}`);
    return process.env.CALLBACK_BASE_URL;
  }
  
  // Legacy fallback for older Replit environments
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    const legacyUrl = `https://${process.env.REPL_OWNER}.${process.env.REPL_SLUG}.replit.dev`;
    console.log(`🌐 Using legacy REPL_SLUG/REPL_OWNER for OAuth: ${legacyUrl}`);
    return legacyUrl;
  }
  
  // Development fallback
  console.log(`🌐 Using development fallback for OAuth: http://localhost:5000`);
  return 'http://localhost:5000';
}

// Function to initialize authentication
export function configureAuth(app: Express) {
  // Secret is required for session
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET not set. Using a random string (not recommended for production).");
  }

  const sessionSecret = process.env.SESSION_SECRET || Math.random().toString(36).substring(2);
  
  // Set SendGrid API key if available
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  // Create PostgreSQL session store
  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({
    pool,
    tableName: 'sessions',
    createTableIfMissing: false, // We've already created it with Drizzle
  });

  // Configure Express to trust proxy (required for Replit)
  app.set('trust proxy', 1);
  
  // Configure session middleware
  app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to false for Replit deployment
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    }
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Local Strategy for username/password auth
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const user = await storage.getUserByEmail(email);

        if (!user || !user.password) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Verify password
        console.log(`Attempting to verify password for user: ${email}`);

        try {
          const isValidPassword = await comparePasswords(password, user.password);

          if (!isValidPassword) {
            console.log(`Password verification failed for user: ${email}`);
            return done(null, false, { message: 'Invalid email or password' });
          }

          console.log(`Password verified successfully for user: ${email}`);
        } catch (error) {
          console.error(`Error verifying password: ${error instanceof Error ? error.message : 'unknown error'}`);
          console.error(`Password structure in DB: ${user.password ? "exists" : "missing"}`);
          return done(null, false, { message: 'Error during password verification' });
        }

        return done(null, dbUserToExpressUser(user));
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Configure Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const domain = getBaseDomain();
    const callbackUrl = `${domain}/api/auth/google/callback`;
    
    console.log(`🔧 Setting up Google OAuth with Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 8)}...`);
    console.log(`🔗 Using callback URL: ${callbackUrl}`);
    console.log(`🌐 Base domain detected: ${domain}`);
    console.log(`📋 Environment variables available (in priority order):`);
    console.log(`   BASE_URL: ${process.env.BASE_URL || 'NOT SET'}`);
    console.log(`   REPLIT_APP_URL: ${process.env.REPLIT_APP_URL || 'NOT SET'}`);
    console.log(`   CALLBACK_BASE_URL: ${process.env.CALLBACK_BASE_URL || 'NOT SET'}`);
    console.log(`   REPL_SLUG: ${process.env.REPL_SLUG || 'NOT SET'}`);
    console.log(`   REPL_OWNER: ${process.env.REPL_OWNER || 'NOT SET'}`);
    console.log(`⚠️  EXPECTED Google Cloud Console Redirect URI: ${callbackUrl}`);
    
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackUrl
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(`👤 Google OAuth callback received for user: ${profile.emails?.[0]?.value}`);
        
        const email = profile.emails?.[0]?.value;
        
        if (!email) {
          console.error('❌ No email found in Google profile');
          return done(new Error('No email found in Google profile'), false);
        }

        // Check if user exists by email
        let user = await storage.getUserByEmail(email);
        
        if (!user) {
          console.log(`✨ Creating new user for Google login: ${email}`);
          // Create new user with Google data
          user = await storage.upsertUser({
            email,
            username: profile.displayName || null,
            firstName: profile.name?.givenName || null,
            lastName: profile.name?.familyName || null,
            profileImageUrl: profile.photos?.[0]?.value || null,
            provider: 'google',
            providerId: profile.id,
            password: null, // No password for OAuth users
          });
        } else {
          console.log(`✅ Existing user found for Google login: ${email}`);
          // Update existing user with Google data if they don't have it
          if (!user.provider || user.provider === 'local') {
            user = await storage.upsertUser({
              ...user,
              provider: 'google',
              providerId: profile.id,
              profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value || null,
            });
          }
        }

        console.log(`✅ Google OAuth successful for: ${email}`);
        return done(null, dbUserToExpressUser(user));
      } catch (error) {
        console.error('❌ Google OAuth error:', error);
        return done(error, false);
      }
    }));
  } else {
    console.warn('⚠️  Google OAuth not configured. Missing GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET environment variables.');
  }

  // Serialize user for session storage
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        done(null, dbUserToExpressUser(user));
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error, false);
    }
  });

  // Note: OAuth providers removed - using local authentication only

  // Google OAuth routes
  app.get('/api/auth/google', (req, res, next) => {
    const currentDomain = getBaseDomain();
    const expectedRedirectUri = `${currentDomain}/api/auth/google/callback`;
    
    console.log(`🚀 Starting Google OAuth flow from: ${req.get('host')}`);
    console.log(`🔗 Referer: ${req.get('referer') || 'none'}`);
    console.log(`🎯 REDIRECT_URI being sent to Google: ${expectedRedirectUri}`);
    console.log(`📋 Verify this matches your Google Cloud Console settings exactly:`);
    console.log(`   Authorized JavaScript origins: ${currentDomain}`);
    console.log(`   Authorized redirect URIs: ${expectedRedirectUri}`);
    
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get('/api/auth/google/callback', (req, res, next) => {
    // Detect protocol - trust X-Forwarded-Proto header for Replit
    const forwardedProto = req.get('X-Forwarded-Proto');
    const detectedProtocol = forwardedProto || req.protocol;
    
    // Force HTTPS when running in Replit environment
    const isReplit = process.env.REPLIT_APP_URL || process.env.REPL_SLUG;
    const correctedProtocol = isReplit ? 'https' : detectedProtocol;
    
    const actualCallbackUrl = `${correctedProtocol}://${req.get('host')}${req.originalUrl}`;
    const expectedCallbackUrl = `${getBaseDomain()}/api/auth/google/callback`;
    
    console.log(`📞 Google OAuth callback received`);
    console.log(`🌐 Environment detection - isReplit: ${!!isReplit}`);
    console.log(`🔒 Protocol detection - req.protocol: ${req.protocol}, X-Forwarded-Proto: ${forwardedProto}, corrected: ${correctedProtocol}`);
    console.log(`🔗 Actual callback URL: ${actualCallbackUrl}`);
    console.log(`🎯 Expected callback URL: ${expectedCallbackUrl}`);
    console.log(`✅ URLs match: ${actualCallbackUrl.startsWith(expectedCallbackUrl)}`);
    console.log(`📋 Query params:`, req.query);
    console.log(`🌐 Request host: ${req.get('host')}`);
    console.log(`📝 Session ID before auth: ${req.sessionID}`);
    
    passport.authenticate('google', { 
      failureRedirect: '/auth?error=google_auth_failed',
      failureMessage: true 
    })(req, res, next);
  }, (req, res) => {
    console.log(`✅ Google OAuth successful for user: ${req.user?.email}`);
    console.log(`📝 Session ID after auth: ${req.sessionID}`);
    console.log(`🔐 Session authenticated: ${req.isAuthenticated()}`);
    console.log(`👤 User object:`, {
      id: req.user?.id,
      email: req.user?.email,
      provider: req.user?.provider
    });
    
    // Force session save to ensure persistence
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.redirect('/auth?error=session_save_failed');
      }
      console.log(`💾 Session saved successfully`);
      res.redirect('/dashboard');
    });
  });

  // Logout route
  app.post('/api/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });

  // Request password reset route
  app.post('/api/reset-password/request', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ 
          message: 'Email is required'
        });
      }

      // Validate email format
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({
          message: 'Please enter a valid email address'
        });
      }

      // Always return success to prevent email enumeration
      const response = { 
        message: 'If an account with that email exists, a password reset link has been sent.',
        success: true
      };

      try {
        // Check if user exists
        const user = await storage.getUserByEmail(email);

        if (user && isEmailConfigured()) {
          // Clean up old tokens for this user
          await db.delete(passwordResetTokens)
            .where(eq(passwordResetTokens.userId, user.id));

          // Generate secure random token (32 bytes = 64 hex chars)
          const resetToken = randomBytes(32).toString('hex');
          
          // Set expiration to 1 hour from now for production
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

          // Store token in database
          await db.insert(passwordResetTokens).values({
            userId: user.id,
            token: resetToken,
            expiresAt,
            used: false
          });

          // Create reset URL
          const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

          // Use SendGrid service directly for better error handling
          const { sendGridEmail } = await import('./emailService');
          
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Password Reset - BytSave</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px 20px; background: #f9f9f9; }
                .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                  <p>Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
                  <p>We received a request to reset your password for your BytSave account.</p>
                  <p>Click the button below to reset your password:</p>
                  <p style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset My Password</a>
                  </p>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="word-break: break-all;">${resetUrl}</p>
                  <p><strong>This link will expire in 1 hour.</strong></p>
                  <p>If you didn't request this password reset, please ignore this email.</p>
                </div>
                <div class="footer">
                  <p>© 2024 BytSave. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await sendGridEmail(
            email,
            'Reset Your BytSave Password',
            emailHtml
          );

          console.log(`Password reset email sent to ${email} via SendGrid`);
        } else if (!isEmailConfigured()) {
          console.warn("Email credentials not configured. Password reset emails will not be sent.");
        }
      } catch (error) {
        console.error('Error in password reset request:', error);
        // Don't expose the error to the client for security
      }

      // Always return the same response regardless of whether user exists
      res.status(200).json(response);
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ message: 'An error occurred. Please try again.' });
    }
  });

  // Confirm password reset route
  app.post('/api/reset-password/confirm', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;

      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ 
          message: 'Token, password, and confirm password are required'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ 
          message: 'Passwords do not match'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({ 
          message: 'Password must be at least 8 characters long'
        });
      }

      // Enhanced password validation
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ 
          message: 'Password must contain at least one uppercase letter'
        });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ 
          message: 'Password must contain at least one number'
        });
      }

      // Find and validate the reset token
      const resetTokenRecord = await db
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
          expiresAt: passwordResetTokens.expiresAt,
          used: passwordResetTokens.used,
          email: users.email
        })
        .from(passwordResetTokens)
        .innerJoin(users, eq(passwordResetTokens.userId, users.id))
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (resetTokenRecord.length === 0) {
        return res.status(400).json({ 
          message: 'Invalid or expired reset token'
        });
      }

      const tokenData = resetTokenRecord[0];

      // Hash the new password
      const hashedPassword = await hashPassword(password);

      // Start transaction to update password and mark token as used
      await db.transaction(async (tx) => {
        // Update the user's password
        await tx.update(users)
          .set({
            password: hashedPassword,
            updatedAt: new Date()
          })
          .where(eq(users.id, tokenData.userId));

        // Mark token as used
        await tx.update(passwordResetTokens)
          .set({ used: true })
          .where(eq(passwordResetTokens.id, tokenData.id));
      });

      console.log(`Password reset successful for user: ${tokenData.email}`);

      res.status(200).json({ 
        message: 'Password reset successful. You can now login with your new password.'
      });
    } catch (error) {
      console.error('Password reset confirm error:', error);
      res.status(500).json({ message: 'Password reset failed. Please try again.' });
    }
  });

  // Register route
  app.post('/api/register', async (req, res) => {
    try {
      console.log('Registration request body:', req.body);

      // Validate with schema - using a modified version to handle password confirmation
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          message: 'Email and password are required', 
          errors: { 
            email: !email ? { _errors: ["Email is required"] } : undefined,
            password: !password ? { _errors: ["Password is required"] } : undefined
          }
        });
      }

      // Validate email format
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({
          message: 'Invalid email format',
          errors: { email: { _errors: ["Please enter a valid email address"] } }
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          message: 'Password is too short',
          errors: { password: { _errors: ["Password must be at least 8 characters"] } }
        });
      }

      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({
          message: 'Password must contain uppercase letter',
          errors: { password: { _errors: ["Password must contain at least one uppercase letter"] } }
        });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({
          message: 'Password must contain a number',
          errors: { password: { _errors: ["Password must contain at least one number"] } }
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        return res.status(400).json({ 
          message: 'User with this email already exists',
          emailExists: true
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user with minimal information
      const newUser = await storage.upsertUser({
        email,
        password: hashedPassword,
        username: null,
        firstName: null,
        lastName: null,
        provider: 'local',
        providerId: null,
      });

      // Log the user in
      req.login(dbUserToExpressUser(newUser), (err) => {
        if (err) {
          console.error('Login after registration error:', err);
          return res.status(500).json({ message: 'Error during login after registration' });
        }

        // Return user data without password
        const { password, ...userWithoutPassword } = newUser;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed due to server error' });
    }
  });

  // Login route
  app.post('/api/login', async (req, res, next) => {
    try {
      // Validate the login data first
      const { loginSchema } = await import('@shared/schema');
      const validation = loginSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Please check your credentials', 
          errors: validation.error.format() 
        });
      }

      // Check if user exists before attempting authentication
      const { email } = validation.data;
      const existingUser = await storage.getUserByEmail(email);

      if (!existingUser) {
        return res.status(401).json({ 
          message: 'Account not found. Please check your email or register for a new account.',
          userNotFound: true
        });
      }

      // Proceed with authentication
      passport.authenticate('local', (err: any, user: Express.User | false, info: { message?: string }) => {
        if (err) {
          console.error('Authentication error:', err);
          return next(err);
        }

        if (!user) {
          console.error('Authentication failed - no user returned. Info:', info);
          return res.status(401).json({ 
            message: 'Incorrect password. Please try again or use password reset.',
            passwordIncorrect: true
          });
        }

        console.log('User authenticated successfully:', user.email);

        req.login(user, (err) => {
          if (err) {
            console.error('Session login error:', err);
            return next(err);
          }

          console.log('User login session created successfully');
          return res.json(user);
        });
      })(req, res, next);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'An unexpected error occurred. Please try again.' });
    }
  });

  // Current user route
  app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });
}

// Middleware to ensure authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Authentication required' });
}