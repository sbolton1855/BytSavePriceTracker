import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as TwitterStrategy } from "passport-twitter";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { storage } from "./storage";
import { pool } from "./db";

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
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
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

// Function to initialize authentication
export function configureAuth(app: Express) {
  // Secret is required for session
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET not set. Using a random string (not recommended for production).");
  }
  
  const sessionSecret = process.env.SESSION_SECRET || Math.random().toString(36).substring(2);
  
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
        const isValidPassword = await comparePasswords(password, user.password);
        
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
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
  
  // Helper function to get the base domain for callbacks
  function getBaseDomain() {
    return process.env.REPLIT_DOMAINS ? 
      `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
      'http://localhost:5000';
  }

  // Configure Google Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const domain = getBaseDomain();
    const callbackUrl = `${domain}/api/auth/google/callback`;
    
    console.log(`Setting up Google OAuth with credential ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 8)}...`);
    console.log(`Using callback URL: ${callbackUrl}`);
    
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackUrl,
      passReqToCallback: true
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Find user by provider ID or email
        const [existingUser] = await db.select().from(users).where(
          or(
            eq(users.providerId, profile.id),
            eq(users.email, profile.emails?.[0]?.value || '')
          )
        );
        
        if (existingUser) {
          // Update existing user if needed
          if (existingUser.provider !== 'google' || existingUser.providerId !== profile.id) {
            const [updatedUser] = await db.update(users)
              .set({
                provider: 'google',
                providerId: profile.id,
                updatedAt: new Date()
              })
              .where(eq(users.id, existingUser.id))
              .returning();
            
            return done(null, dbUserToExpressUser(updatedUser));
          }
          return done(null, dbUserToExpressUser(existingUser));
        }
        
        // Create new user
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('Email is required'), false);
        }
        
        const newUser = await storage.upsertUser({
          email,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          profileImageUrl: profile.photos?.[0]?.value,
          provider: 'google',
          providerId: profile.id,
        });
        
        return done(null, dbUserToExpressUser(newUser));
      } catch (error) {
        return done(error, false);
      }
    }));
  }
  
  // Configure Facebook Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    const domain = getBaseDomain();
    
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${domain}/api/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'picture.type(large)']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Find user by provider ID or email
        const [existingUser] = await db.select().from(users).where(
          or(
            eq(users.providerId, profile.id),
            eq(users.email, profile.emails?.[0]?.value || '')
          )
        );
        
        if (existingUser) {
          // Update existing user if needed
          if (existingUser.provider !== 'facebook' || existingUser.providerId !== profile.id) {
            const [updatedUser] = await db.update(users)
              .set({
                provider: 'facebook',
                providerId: profile.id,
                updatedAt: new Date()
              })
              .where(eq(users.id, existingUser.id))
              .returning();
            
            return done(null, dbUserToExpressUser(updatedUser));
          }
          return done(null, dbUserToExpressUser(existingUser));
        }
        
        // Create new user
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('Email is required'), false);
        }
        
        const newUser = await storage.upsertUser({
          email,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          profileImageUrl: profile.photos?.[0]?.value,
          provider: 'facebook',
          providerId: profile.id,
        });
        
        return done(null, dbUserToExpressUser(newUser));
      } catch (error) {
        return done(error, false);
      }
    }));
  }
  
  // Configure Twitter Strategy
  if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
    const domain = getBaseDomain();
    
    passport.use(new TwitterStrategy({
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: `${domain}/api/auth/twitter/callback`,
      includeEmail: true
    }, async (token, tokenSecret, profile, done) => {
      try {
        // Find user by provider ID or username
        const [existingUser] = await db.select().from(users).where(
          or(
            eq(users.providerId, profile.id),
            eq(users.username, profile.username || '')
          )
        );
        
        if (existingUser) {
          // Update existing user if needed
          if (existingUser.provider !== 'twitter' || existingUser.providerId !== profile.id) {
            const [updatedUser] = await db.update(users)
              .set({
                provider: 'twitter',
                providerId: profile.id,
                updatedAt: new Date()
              })
              .where(eq(users.id, existingUser.id))
              .returning();
            
            return done(null, dbUserToExpressUser(updatedUser));
          }
          return done(null, dbUserToExpressUser(existingUser));
        }
        
        // Create new user
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('Email is required'), false);
        }
        
        const newUser = await storage.upsertUser({
          email,
          username: profile.username,
          profileImageUrl: profile.photos?.[0]?.value?.replace('_normal', ''),
          provider: 'twitter',
          providerId: profile.id,
        });
        
        return done(null, dbUserToExpressUser(newUser));
      } catch (error) {
        return done(error, false);
      }
    }));
  }
  
  // Authentication routes
  app.get('/api/auth/google', (req, res, next) => {
    console.log('Starting Google OAuth flow...');
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers.host);
    
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'select_account'
    })(req, res, next);
  });
  
  app.get('/api/auth/google/callback', (req, res, next) => {
    console.log('Google OAuth callback received');
    console.log('Query parameters:', req.query);
    
    passport.authenticate('google', { 
      failureRedirect: '/auth',
      failureMessage: true
    })(req, res, (err: any) => {
      if (err) {
        console.error('Google auth error:', err);
        return next(err);
      }
      console.log('Google authentication successful, redirecting to dashboard');
      res.redirect('/dashboard');
    });
  });
  
  app.get('/api/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
  app.get('/api/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/auth' }),
    (req, res) => res.redirect('/dashboard')
  );
  
  app.get('/api/auth/twitter', passport.authenticate('twitter'));
  app.get('/api/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/auth' }),
    (req, res) => res.redirect('/dashboard')
  );
  
  // Logout route
  app.post('/api/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      res.status(200).json({ message: 'Logged out successfully' });
    });
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
          return next(err);
        }
        
        if (!user) {
          return res.status(401).json({ 
            message: 'Incorrect password. Please try again or use password reset.',
            passwordIncorrect: true
          });
        }
        
        req.login(user, (err) => {
          if (err) {
            return next(err);
          }
          
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