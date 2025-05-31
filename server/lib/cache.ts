import { LRUCache } from 'lru-cache';
import type { AmazonProduct } from '../amazonApi';

// Cache configuration
const CACHE_OPTIONS = {
  max: 500, // Maximum number of items to store
  ttl: 1000 * 60 * 60 * 6, // 6 hours
  updateAgeOnGet: true, // Reset TTL when item is accessed
};

// Create separate caches for different types of data
const productCache = new LRUCache<string, AmazonProduct>(CACHE_OPTIONS);
const priceHistoryCache = new LRUCache<string, PriceHistoryEntry[]>(CACHE_OPTIONS);

// Interface for price history entries
interface PriceHistoryEntry {
  price: number;
  originalPrice?: number;
  timestamp: Date;
}

/**
 * Cache wrapper for product data
 */
export const cache = {
  /**
   * Get a product from cache
   */
  getProduct(asin: string): AmazonProduct | undefined {
    return productCache.get(asin);
  },

  /**
   * Store a product in cache and track price history
   */
  setProduct(asin: string, product: AmazonProduct): void {
    const existingProduct = productCache.get(asin);
    
    // Store the new product
    productCache.set(asin, product);

    // Update price history if price changed
    if (existingProduct && existingProduct.price !== product.price) {
      this.addPriceHistoryEntry(asin, {
        price: product.price,
        originalPrice: product.originalPrice,
        timestamp: new Date()
      });
    }
  },

  /**
   * Get price history for a product
   */
  getPriceHistory(asin: string): PriceHistoryEntry[] {
    return priceHistoryCache.get(asin) || [];
  },

  /**
   * Add a price history entry
   */
  addPriceHistoryEntry(asin: string, entry: PriceHistoryEntry): void {
    const history = this.getPriceHistory(asin);
    history.push(entry);
    
    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filteredHistory = history.filter(e => e.timestamp >= thirtyDaysAgo);
    priceHistoryCache.set(asin, filteredHistory);
  },

  /**
   * Check if a price drop occurred
   */
  hasPriceDrop(asin: string, currentPrice: number): boolean {
    const history = this.getPriceHistory(asin);
    if (history.length === 0) return false;

    // Get the previous price
    const previousEntry = history[history.length - 1];
    return currentPrice < previousEntry.price;
  },

  /**
   * Clear all caches
   */
  clear(): void {
    productCache.clear();
    priceHistoryCache.clear();
  }
}; 