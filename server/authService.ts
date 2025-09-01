import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
// OAuth strategies removed - using local authentication only
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { pool } from "./db";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import sgMail from '@sendgrid/mail';

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

      // Always return success to prevent email enumeration
      // This is a security best practice
      const response = { 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      };

      try {
        // Check if user exists
        const user = await storage.getUserByEmail(email);

        if (user && isEmailConfigured()) {
          // Generate JWT token valid for 15 minutes
          const resetToken = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '15m' }
          );

          // Create reset URL
          const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

          // Send email using SendGrid
          const msg = {
            to: email,
            from: process.env.EMAIL_FROM!, // Sender email address
            subject: 'Reset your BytSave password',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Password Reset</h2>
                <p style="color: #555; line-height: 1.6;">Hello,</p>
                <p style="color: #555; line-height: 1.6;">You requested to reset your password for your BytSave account.</p>
                <p style="margin: 20px 0;">
                  <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Reset Password
                  </a>
                </p>
                <p style="color: #555; line-height: 1.6;">
                  If the button above doesn't work, you can also copy and paste the following link into your browser:
                </p>
                <p style="color: #007bff; word-break: break-all;">${resetUrl}</p>
                <p style="color: #777; font-size: 12px; margin-top: 20px;">
                  This password reset link will expire in 15 minutes. If you did not request a password reset, please ignore this email.
                </p>
                <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">Thank you,<br>The BytSave Team</p>
              </div>
            `,
          };

          await sgMail.send(msg);
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

      if (password.length < 6) {
        return res.status(400).json({ 
          message: 'Password must be at least 6 characters long'
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as any;
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(400).json({ 
          message: 'Invalid or expired reset token'
        });
      }

      // Find the user
      const user = await storage.getUserByEmail(decoded.email);
      if (!user) {
        return res.status(400).json({ 
          message: 'Invalid reset token'
        });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(password);

      // Update the user's password
      await db.update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      console.log(`Password reset successful for user: ${user.email}`);

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
      const { loginSchema } = await import('../shared/schema.js');
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