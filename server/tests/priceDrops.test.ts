import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import priceDropsRouter from '../routes/priceDrops';
import { metrics } from '../lib/metrics';

describe('Price Drops API', () => {
  const app = express();
  app.use(express.json());
  app.use(priceDropsRouter);

  beforeEach(() => {
    metrics.reset();
  });

  describe('GET /products/price-drops', () => {
    beforeEach(() => {
      // Add some test price drops
      const drops = [
        {
          asin: 'B123',
          title: 'Product 1',
          oldPrice: 29.99,
          newPrice: 19.99,
          dropPercent: 33.3,
          timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          couponApplied: false
        },
        {
          asin: 'B456',
          title: 'Product 2',
          oldPrice: 49.99,
          newPrice: 39.99,
          dropPercent: 20,
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          couponApplied: true
        }
      ];

      drops.forEach(drop => metrics.recordPriceDrop(drop));
    });

    it('should return all price drops when no filters are applied', async () => {
      const response = await request(app)
        .get('/products/price-drops')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].asin).toBe('B456');
      expect(response.body[1].asin).toBe('B123');
    });

    it('should filter drops by time range', async () => {
      const response = await request(app)
        .get('/products/price-drops?since=24h')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].asin).toBe('B456');
    });

    it('should limit number of returned drops', async () => {
      const response = await request(app)
        .get('/products/price-drops?limit=1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].asin).toBe('B456'); // Most recent
    });

    it('should handle invalid duration format', async () => {
      const response = await request(app)
        .get('/products/price-drops?since=invalid')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid limit parameter', async () => {
      const response = await request(app)
        .get('/products/price-drops?limit=invalid')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should combine since and limit parameters', async () => {
      const response = await request(app)
        .get('/products/price-drops?since=24h&limit=1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].asin).toBe('B456');
    });
  });

  describe('GET /metrics', () => {
    beforeEach(() => {
      // Add some test metrics
      metrics.incrementApiHits();
      metrics.incrementApiHits();
      metrics.incrementCacheHits();
      metrics.incrementCacheMisses();
      metrics.incrementErrors();
    });

    it('should return current metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body.counts.apiHits).toBe(2);
      expect(response.body.counts.cacheHits).toBe(1);
      expect(response.body.counts.errors).toBe(1);
      expect(response.body.cacheEfficiency).toBe(50);
    });
  });
}); 