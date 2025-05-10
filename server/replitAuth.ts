import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as TwitterStrategy } from "passport-twitter";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { db } from "./db";
import { eq, or } from "drizzle-orm";
import { users } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function getBaseDomain() {
  return process.env.REPLIT_DOMAINS ? 
    `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
    'http://localhost:5000';
}

function dbUserToExpressUser(dbUser: any) {
  // Don't expose password hash to client
  const { password, ...user } = dbUser;
  return user;
}

export async function setupAuth(app: Express) {
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  }));
  
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // User serialization for sessions
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ? dbUserToExpressUser(user) : null);
    } catch (err) {
      done(err, null);
    }
  });
  
  // Local strategy for username/password login
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        
        if (!user || !user.password) {
          return done(null, false, { message: 'Incorrect email or password' });
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
          return done(null, false, { message: 'Incorrect email or password' });
        }
        
        return done(null, dbUserToExpressUser(user));
      } catch (err) {
        return done(err);
      }
    }
  ));
  
  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const callbackURL = `${getBaseDomain()}/api/auth/google/callback`;
    console.log(`Setting up Google OAuth with callback URL: ${callbackURL}`);
    console.log(`Client ID starts with: ${process.env.GOOGLE_CLIENT_ID.substring(0, 5)}...`);
    
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google auth callback received with profile:', profile.id);
        if (profile.emails && profile.emails[0]) {
          console.log('Email from profile:', profile.emails[0].value);
        }
        
        // Check if user exists by provider ID or email
        const [existingUser] = await db.select().from(users).where(
          or(
            eq(users.providerId, profile.id),
            eq(users.email, profile.emails?.[0]?.value || '')
          )
        );
        
        if (existingUser) {
          // Update provider details if needed
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
        
        const newUser = await storage.createUser({
          email,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          profileImageUrl: profile.photos?.[0]?.value,
          provider: 'google',
          providerId: profile.id,
        });
        
        return done(null, dbUserToExpressUser(newUser));
      } catch (error) {
        console.error('Google auth error:', error);
        return done(error, false);
      }
    }));
  }
  
  // Authentication routes
  app.get('/api/auth/google', (req, res, next) => {
    console.log('Starting Google OAuth flow...');
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
  
  // Register route
  app.post('/api/register', async (req, res) => {
    try {
      // Remove passwordConfirm before sending to database
      const { passwordConfirm, ...userData } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      
      // Hash password
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      
      // Create user
      const newUser = await storage.createUser({
        ...userData,
        provider: 'local',
        providerId: null,
      });
      
      // Log the user in
      req.login(dbUserToExpressUser(newUser), (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error during login after registration' });
        }
        
        // Return user data without password
        const { password, ...userWithoutPassword } = newUser;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });
  
  // Login route
  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: { message?: string }) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info.message || 'Authentication failed' });
      }
      
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        
        return res.json(user);
      });
    })(req, res, next);
  });
  
  // Logout route
  app.post('/api/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      res.status(200).json({ message: 'Logged out successfully' });
    });
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