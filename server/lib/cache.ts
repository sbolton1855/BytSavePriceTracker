
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
export const cache = new InMemoryCache();

// Helper functions for common cache patterns
export const cacheGet = (key: string) => cache.get(key);
export const cacheSet = (key: string, value: any, ttl?: number) => cache.set(key, value, ttl);
export const cacheDel = (key: string) => cache.delete(key);
