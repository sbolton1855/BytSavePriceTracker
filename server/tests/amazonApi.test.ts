import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { cache } from '../lib/cache';
import { withRateLimit, batchWithRateLimit } from '../lib/rateLimiter';
import { getProductInfo, searchProducts } from '../amazonApi';

// Mock the AWS request signing
jest.mock('../lib/awsSignedRequest', () => ({
  fetchSignedAmazonRequest: jest.fn()
}));

// Mock the error logging
jest.mock('../errorController', () => ({
  logApiError: jest.fn()
}));

describe('Amazon API Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should rate limit single requests', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const start = Date.now();
    
    // Execute three rate-limited calls
    await Promise.all([
      withRateLimit(() => mockFn(), { operation: 'test' }),
      withRateLimit(() => mockFn(), { operation: 'test' }),
      withRateLimit(() => mockFn(), { operation: 'test' })
    ]);
    
    const duration = Date.now() - start;
    
    // Should take at least 2 seconds (1 second per call after first)
    expect(duration).toBeGreaterThanOrEqual(2000);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should handle batch operations with failures', async () => {
    const operations = [
      () => Promise.resolve('success1'),
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve('success2')
    ];

    const results = await batchWithRateLimit(operations, { operation: 'test' });
    expect(results).toHaveLength(2);
    expect(results).toContain('success1');
    expect(results).toContain('success2');
  });
});

describe('Amazon API Caching', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('should cache product information', () => {
    const mockProduct = {
      asin: 'B123456789',
      title: 'Test Product',
      price: 9.99,
      url: 'https://amazon.com/dp/B123456789'
    };

    cache.setProduct(mockProduct.asin, mockProduct);
    const cachedProduct = cache.getProduct(mockProduct.asin);
    expect(cachedProduct).toEqual(mockProduct);
  });

  it('should detect price drops', () => {
    const asin = 'B123456789';
    const originalPrice = 19.99;
    const newPrice = 14.99;

    // Add initial price
    cache.addPriceHistoryEntry(asin, {
      price: originalPrice,
      timestamp: new Date(Date.now() - 1000) // 1 second ago
    });

    // Check price drop detection
    expect(cache.hasPriceDrop(asin, newPrice)).toBe(true);
    expect(cache.hasPriceDrop(asin, originalPrice)).toBe(false);
  });

  it('should maintain price history within 30 days', () => {
    const asin = 'B123456789';
    const now = new Date();
    
    // Add prices from different times
    cache.addPriceHistoryEntry(asin, {
      price: 10.99,
      timestamp: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000) // 31 days ago
    });
    
    cache.addPriceHistoryEntry(asin, {
      price: 9.99,
      timestamp: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000) // 29 days ago
    });
    
    cache.addPriceHistoryEntry(asin, {
      price: 8.99,
      timestamp: now
    });

    const history = cache.getPriceHistory(asin);
    expect(history).toHaveLength(2); // Should only include last 30 days
    expect(history[history.length - 1].price).toBe(8.99);
  });
});

describe('Amazon API Integration', () => {
  const mockProductResponse = {
    ItemsResult: {
      Items: [{
        ASIN: 'B123456789',
        ItemInfo: {
          Title: { DisplayValue: 'Test Product' }
        },
        Offers: {
          Listings: [{
            Price: { Amount: 9.99 },
            SavingBasis: { Amount: 12.99 },
            Promotions: [{ Type: 'Coupon' }]
          }]
        },
        DetailPageURL: 'https://amazon.com/dp/B123456789'
      }]
    }
  };

  beforeEach(() => {
    cache.clear();
    jest.clearAllMocks();
  });

  it('should handle YumEarth product special case', async () => {
    const mockFetchSigned = require('../lib/awsSignedRequest').fetchSignedAmazonRequest;
    mockFetchSigned.mockResolvedValueOnce(mockProductResponse);

    const product = await getProductInfo('B08PX626SG');
    expect(product.price).toBe(9.99);
    expect(product.originalPrice).toBe(12.99);
  });

  it('should handle pagination in search results', async () => {
    const mockFetchSigned = require('../lib/awsSignedRequest').fetchSignedAmazonRequest;
    mockFetchSigned.mockResolvedValueOnce({
      SearchResult: {
        Items: [mockProductResponse.ItemsResult.Items[0]],
        TotalResultCount: 100
      }
    });

    const { items, totalPages } = await searchProducts('test', 10, 1);
    expect(items).toHaveLength(1);
    expect(totalPages).toBe(10); // 100 total / 10 per page
    expect(items[0].couponDetected).toBe(true);
  });
}); 