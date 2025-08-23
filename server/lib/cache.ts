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

// Export singleton instance
export const cache = {
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.warn('Cache set failed:', error);
    }
  },

  async get(key: string): Promise<any> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Cache get failed:', error);
      return null;
    }
  },

  async getProduct(asin: string): Promise<any> {
    try {
      const key = `product:${asin}`;
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Cache getProduct failed:', error);
      return null;
    }
  },

  async setProduct(asin: string, productData: any, ttl: number = 3600): Promise<void> {
    try {
      const key = `product:${asin}`;
      await redisClient.setEx(key, ttl, JSON.stringify(productData));
    } catch (error) {
      console.warn('Cache setProduct failed:', error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.warn('Cache delete failed:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      await redisClient.flushAll();
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }
};

// Helper functions for common cache patterns
export const cacheGet = (key: string) => cache.get(key);
export const cacheSet = (key: string, value: any, ttl?: number) => cache.set(key, value, ttl);
export const cacheDel = (key: string) => cache.delete(key);