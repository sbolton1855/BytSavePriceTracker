import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { batchWithRateLimit } from '../lib/rateLimiter';
import { metrics } from '../lib/metrics';

describe('Batch Operations', () => {
  beforeEach(() => {
    metrics.reset();
    jest.clearAllMocks();
  });

  it('should handle mixed success and failure operations', async () => {
    const operations = [
      () => Promise.resolve('success1'),
      () => Promise.reject(new Error('intentional failure')),
      () => Promise.resolve('success2'),
      () => Promise.reject(new Error('another failure')),
      () => Promise.resolve('success3')
    ];

    const results = await batchWithRateLimit(operations, { operation: 'test' });

    // Should only get successful results
    expect(results).toHaveLength(3);
    expect(results).toContain('success1');
    expect(results).toContain('success2');
    expect(results).toContain('success3');

    // Should track errors in metrics
    const counts = metrics.getMetrics();
    expect(counts.errors).toBe(2);
  });

  it('should handle all successful operations', async () => {
    const operations = [
      () => Promise.resolve('success1'),
      () => Promise.resolve('success2'),
      () => Promise.resolve('success3')
    ];

    const results = await batchWithRateLimit(operations, { operation: 'test' });

    expect(results).toHaveLength(3);
    expect(results).toEqual(['success1', 'success2', 'success3']);

    // Should not increment error count
    const counts = metrics.getMetrics();
    expect(counts.errors).toBe(0);
  });

  it('should handle all failed operations', async () => {
    const operations = [
      () => Promise.reject(new Error('fail1')),
      () => Promise.reject(new Error('fail2')),
      () => Promise.reject(new Error('fail3'))
    ];

    const results = await batchWithRateLimit(operations, { operation: 'test' });

    expect(results).toHaveLength(0);

    // Should track all errors
    const counts = metrics.getMetrics();
    expect(counts.errors).toBe(3);
  });

  it('should handle empty operation list', async () => {
    const results = await batchWithRateLimit([], { operation: 'test' });
    expect(results).toHaveLength(0);
  });

  it('should respect rate limiting', async () => {
    const start = Date.now();
    
    const operations = [
      () => Promise.resolve('1'),
      () => Promise.resolve('2'),
      () => Promise.resolve('3')
    ];

    await batchWithRateLimit(operations, { operation: 'test' });
    
    const duration = Date.now() - start;
    
    // Should take at least 2 seconds (1 req/sec after first)
    expect(duration).toBeGreaterThanOrEqual(2000);
  });

  it('should track API hits in metrics', async () => {
    const operations = [
      () => Promise.resolve('1'),
      () => Promise.resolve('2')
    ];

    await batchWithRateLimit(operations, { operation: 'test' });

    const counts = metrics.getMetrics();
    expect(counts.apiHits).toBe(2);
  });
}); 