// Cache implementation with robust Redis fallback
// Provides high-performance caching for Amazon API responses and user sessions

import { createClient } from 'redis';

let client: any = null;
let redisAvailable = false;

// Initialize Redis client with environment-based configuration
async function initializeRedis() {
  try {
    // Skip Redis entirely in development if REDIS_URL not provided
    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'development') {
      console.log('📋 [CACHE] No REDIS_URL found, using in-memory cache for development');
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    console.log('🔄 [CACHE] Attempting Redis connection...');

    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 2000, // Shorter timeout
        lazyConnect: true,
      }
    });

    client.on('error', (err: Error) => {
      console.warn('⚠️ [CACHE] Redis error:', err.message);
      redisAvailable = false;
    });

    client.on('connect', () => {
      console.log('✅ [CACHE] Redis connected');
      redisAvailable = true;
    });

    client.on('disconnect', () => {
      console.log('📡 [CACHE] Redis disconnected');
      redisAvailable = false;
    });

    // Try to connect with timeout
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 3000)
      )
    ]);

    redisAvailable = true;

  } catch (error) {
    console.warn('⚠️ [CACHE] Redis initialization failed:', (error as Error).message);
    console.log('📋 [CACHE] Using in-memory cache as fallback');
    client = null;
    redisAvailable = false;
  }
}

// In-memory cache fallback
const memoryCache = new Map<string, { value: any; expiry: number }>();

// Clean up expired memory cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expiry) {
      memoryCache.delete(key);
    }
  }
}, 300000);

export const cache = {
  async set(key: string, value: any, expirationSeconds: number = 300): Promise<void> {
    try {
      if (client && redisAvailable && client.isReady) {
        const serializedValue = JSON.stringify(value);
        await client.setEx(key, expirationSeconds, serializedValue);
        console.log(`💾 [CACHE] Redis set: ${key}`);
      } else {
        const expiry = Date.now() + (expirationSeconds * 1000);
        memoryCache.set(key, { value, expiry });
        console.log(`💾 [CACHE] Memory set: ${key}`);
      }
    } catch (error) {
      console.warn('⚠️ [CACHE] Set error:', (error as Error).message);
      const expiry = Date.now() + (expirationSeconds * 1000);
      memoryCache.set(key, { value, expiry });
    }
  },

  async get(key: string): Promise<any | null> {
    try {
      if (client && redisAvailable && client.isReady) {
        const cachedValue = await client.get(key);
        if (cachedValue) {
          console.log(`🎯 [CACHE] Redis hit: ${key}`);
          return JSON.parse(cachedValue);
        }
      } else {
        const cached = memoryCache.get(key);
        if (cached && Date.now() < cached.expiry) {
          console.log(`🎯 [CACHE] Memory hit: ${key}`);
          return cached.value;
        } else if (cached) {
          memoryCache.delete(key);
        }
      }

      return null;
    } catch (error) {
      console.warn('⚠️ [CACHE] Get error:', (error as Error).message);
      return null;
    }
  },

  async del(key: string): Promise<void> {
    try {
      if (client && redisAvailable && client.isReady) {
        await client.del(key);
      }
      memoryCache.delete(key);
    } catch (error) {
      console.warn('⚠️ [CACHE] Delete error:', (error as Error).message);
    }
  },

  async clear(): Promise<void> {
    try {
      if (client && redisAvailable && client.isReady) {
        await client.flushAll();
      }
      memoryCache.clear();
      console.log('🧹 [CACHE] Cleared');
    } catch (error) {
      console.warn('⚠️ [CACHE] Clear error:', (error as Error).message);
    }
  }
};

// Initialize Redis when module loads (non-blocking)
initializeRedis().catch(() => {
  console.log('📋 [CACHE] Continuing with memory-only cache');
});