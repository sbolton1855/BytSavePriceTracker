import { describe, it, expect, beforeEach } from '@jest/globals';
import { metrics } from '../lib/metrics';

describe('Metrics System', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('Counter Operations', () => {
    it('should increment counters correctly', () => {
      metrics.incrementApiHits();
      metrics.incrementApiHits();
      metrics.incrementCacheHits();
      metrics.incrementErrors();

      const counts = metrics.getMetrics();
      expect(counts.apiHits).toBe(2);
      expect(counts.cacheHits).toBe(1);
      expect(counts.errors).toBe(1);
    });

    it('should calculate cache efficiency correctly', () => {
      // 2 hits, 2 misses = 50% efficiency
      metrics.incrementCacheHits();
      metrics.incrementCacheHits();
      metrics.incrementCacheMisses();
      metrics.incrementCacheMisses();

      expect(metrics.getCacheEfficiency()).toBe(50);
    });

    it('should handle zero cache operations gracefully', () => {
      expect(metrics.getCacheEfficiency()).toBe(0);
    });
  });

  describe('Price Drop Tracking', () => {
    const mockDrop = {
      asin: 'B123456789',
      title: 'Test Product',
      oldPrice: 19.99,
      newPrice: 14.99,
      dropPercent: 25,
      timestamp: new Date(),
      couponApplied: false
    };

    it('should record price drops', () => {
      metrics.recordPriceDrop(mockDrop);
      const drops = metrics.getPriceDrops();
      
      expect(drops).toHaveLength(1);
      expect(drops[0]).toEqual(mockDrop);
    });

    it('should respect the maximum price drops limit', () => {
      // Add more than MAX_PRICE_DROPS entries
      for (let i = 0; i < 1100; i++) {
        metrics.recordPriceDrop({
          ...mockDrop,
          timestamp: new Date(Date.now() - i * 1000)
        });
      }

      const drops = metrics.getPriceDrops();
      expect(drops).toHaveLength(1000); // MAX_PRICE_DROPS constant
      
      // Should keep most recent drops
      expect(drops[0].timestamp.getTime()).toBeGreaterThan(
        drops[drops.length - 1].timestamp.getTime()
      );
    });

    it('should filter drops by time range', () => {
      const now = Date.now();
      
      // Add drops at different times
      metrics.recordPriceDrop({
        ...mockDrop,
        timestamp: new Date(now - 25 * 60 * 60 * 1000) // 25 hours ago
      });
      
      metrics.recordPriceDrop({
        ...mockDrop,
        timestamp: new Date(now - 23 * 60 * 60 * 1000) // 23 hours ago
      });

      // Get drops in last 24 hours
      const recentDrops = metrics.getPriceDrops({ 
        since: 24 * 60 * 60 * 1000 
      });
      
      expect(recentDrops).toHaveLength(1);
    });

    it('should limit number of returned drops', () => {
      // Add multiple drops
      for (let i = 0; i < 5; i++) {
        metrics.recordPriceDrop({
          ...mockDrop,
          timestamp: new Date(Date.now() - i * 1000)
        });
      }

      const limitedDrops = metrics.getPriceDrops({ limit: 3 });
      expect(limitedDrops).toHaveLength(3);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all counters and drops', () => {
      // Add some data
      metrics.incrementApiHits();
      metrics.recordPriceDrop({
        asin: 'test',
        title: 'Test',
        oldPrice: 10,
        newPrice: 8,
        dropPercent: 20,
        timestamp: new Date()
      });

      // Reset
      metrics.reset();

      // Verify reset
      const counts = metrics.getMetrics();
      expect(counts.apiHits).toBe(0);
      expect(metrics.getPriceDrops()).toHaveLength(0);
    });
  });
}); 