
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';

interface CacheItem {
  value: any;
  expires: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheItem>();
  private defaultTTL = 300; // 5 minutes default

  set(key: string, value: any, ttlSeconds?: number): void {
    const ttl = ttlSeconds || this.defaultTTL;
    const expires = Date.now() + (ttl * 1000);

    this.cache.set(key, { value, expires });

    // Clean up expired items periodically
    this.cleanup();
  }

  get(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create fallback in-memory cache
const fallbackCache = new InMemoryCache();

let redisClient: RedisClientType | null = null;
let isRedisConnected = false;

// Try to connect if REDIS_URL exists
if (process.env.REDIS_URL) {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log("[CACHE] Redis connected successfully");
    });
    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.warn("[CACHE] Redis connection error:", err.message);
    });
    redisClient.connect();
  } catch (err) {
    console.warn("[CACHE] Redis failed to connect, using in-memory cache:", err instanceof Error ? err.message : 'Unknown error');
    redisClient = null;
    isRedisConnected = false;
  }
} else {
  console.warn("[CACHE] No REDIS_URL found, using in-memory cache");
}

// Export singleton instance with safe fallbacks
export const cache = {
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    if (redisClient && isRedisConnected) {
      try {
        await redisClient.setEx(key, ttl, JSON.stringify(value));
        return;
      } catch (error) {
        console.warn('[CACHE] Redis set failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Fallback to in-memory cache
    fallbackCache.set(key, value, ttl);
  },

  async get(key: string): Promise<any> {
    if (redisClient && isRedisConnected) {
      try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn('[CACHE] Redis get failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Fallback to in-memory cache
    return fallbackCache.get(key);
  },

  async getProduct(asin: string): Promise<any> {
    if (redisClient && isRedisConnected) {
      try {
        const key = `product:${asin}`;
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn('[CACHE] Redis getProduct failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Fallback to in-memory cache
    return fallbackCache.get(`product:${asin}`);
  },

  async setProduct(asin: string, productData: any, ttl: number = 3600): Promise<void> {
    if (redisClient && isRedisConnected) {
      try {
        const key = `product:${asin}`;
        await redisClient.setEx(key, ttl, JSON.stringify(productData));
        return;
      } catch (error) {
        console.warn('[CACHE] Redis setProduct failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Fallback to in-memory cache
    fallbackCache.set(`product:${asin}`, productData, ttl);
  },

  async del(key: string): Promise<void> {
    if (redisClient && isRedisConnected) {
      try {
        await redisClient.del(key);
        return;
      } catch (error) {
        console.warn('[CACHE] Redis delete failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Fallback to in-memory cache
    fallbackCache.delete(key);
  },

  async clear(): Promise<void> {
    if (redisClient && isRedisConnected) {
      try {
        await redisClient.flushAll();
        return;
      } catch (error) {
        console.warn('[CACHE] Redis clear failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Fallback to in-memory cache
    fallbackCache.clear();
  },

  // Additional methods that were referenced in the code
  hasPriceDrop(asin: string, currentPrice: number): boolean {
    // This would typically check price history - for now return false as safe fallback
    return false;
  },

  getPriceHistory(asin: string): Array<{price: number, timestamp: Date}> {
    // Return empty array as safe fallback
    return [];
  },

  // Get cache stats
  getStats() {
    if (redisClient && isRedisConnected) {
      return {
        type: 'redis',
        connected: true,
        fallback: fallbackCache.getStats()
      };
    }
    return {
      type: 'in-memory',
      connected: false,
      ...fallbackCache.getStats()
    };
  }
};

// Helper functions for common cache patterns
export const cacheGet = (key: string) => cache.get(key);
export const cacheSet = (key: string, value: any, ttl?: number) => cache.set(key, value, ttl);
export const cacheDel = (key: string) => cache.del(key);
