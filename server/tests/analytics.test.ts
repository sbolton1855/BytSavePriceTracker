import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import analyticsRouter from '../routes/analytics';
import { metrics } from '../lib/metrics';

describe('Analytics API', () => {
  const app = express();
  app.use(express.json());
  app.use(analyticsRouter);

  beforeEach(() => {
    metrics.reset();
  });

  describe('GET /analytics/summary', () => {
    beforeEach(() => {
      // Add some test data
      metrics.incrementApiHits();
      metrics.incrementApiHits();
      metrics.incrementCacheHits();
      metrics.incrementCacheMisses();

      // Add some price drops
      const drops = [
        {
          asin: 'B123',
          title: 'Product 1',
          oldPrice: 29.99,
          newPrice: 19.99,
          dropPercent: 33.3,
          timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000)
        },
        {
          asin: 'B456',
          title: 'Product 2',
          oldPrice: 49.99,
          newPrice: 39.99,
          dropPercent: 20,
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
        }
      ];

      drops.forEach(drop => metrics.recordPriceDrop(drop));
    });

    it('should return complete analytics summary', async () => {
      const response = await request(app)
        .get('/analytics/summary')
        .expect(200);

      expect(response.body.apiHits).toBe(2);
      expect(response.body.cacheHits).toBe(1);
      expect(response.body.cacheMisses).toBe(1);
      expect(response.body.priceDrops).toBe(2);
      expect(response.body.cacheEfficiency).toBe(50);
      expect(response.body.topDrops).toHaveLength(2);
      expect(response.body.lastUpdate).toBeDefined();
    });

    it('should filter by time range', async () => {
      const response = await request(app)
        .get('/analytics/summary?since=86400000') // Last 24 hours
        .expect(200);

      expect(response.body.topDrops).toHaveLength(1);
      expect(response.body.topDrops[0].asin).toBe('B456');
    });
  });

  describe('GET /analytics/trends', () => {
    beforeEach(() => {
      // Add price drops over multiple days
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        metrics.recordPriceDrop({
          asin: `B${i}`,
          title: `Product ${i}`,
          oldPrice: 100,
          newPrice: 80,
          dropPercent: 20,
          timestamp: new Date(now - i * 24 * 60 * 60 * 1000)
        });
      }
    });

    it('should return daily trend data', async () => {
      const response = await request(app)
        .get('/analytics/trends?days=7')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('date');
      expect(response.body[0]).toHaveProperty('count');
      expect(response.body[0]).toHaveProperty('averageDropPercent');
    });
  });

  describe('GET /analytics/cache-efficiency', () => {
    beforeEach(() => {
      // Set up some cache hits/misses
      metrics.incrementCacheHits();
      metrics.incrementCacheHits();
      metrics.incrementCacheMisses();
    });

    it('should return cache efficiency data', async () => {
      const response = await request(app)
        .get('/analytics/cache-efficiency')
        .expect(200);

      expect(response.body).toHaveProperty('current');
      expect(response.body.current).toBe(metrics.getCacheEfficiency());
      expect(response.body).toHaveProperty('trend');
    });
  });
}); 