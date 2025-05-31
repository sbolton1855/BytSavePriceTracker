import { withRateLimit, batchWithRateLimit } from '../rateLimiter';
import { metrics } from '../metrics';
import { logApiError } from '../../errorController';

// Mock dependencies
jest.mock('../metrics');
jest.mock('../../errorController');

describe('Rate Limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('withRateLimit', () => {
    it('should successfully execute a function', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withRateLimit(mockFn, { operation: 'test' });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(metrics.incrementApiHits).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce('success');

      const result = await withRateLimit(mockFn, { operation: 'test' });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(metrics.incrementRateLimited).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(withRateLimit(mockFn, { 
        operation: 'test',
        asin: 'TEST123'
      })).rejects.toThrow('API Error');

      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(metrics.incrementRateLimited).toHaveBeenCalledTimes(3);
      expect(metrics.incrementErrors).toHaveBeenCalledTimes(1);
      expect(logApiError).toHaveBeenCalledWith(
        'TEST123',
        'RATE_LIMIT',
        expect.stringContaining('Failed after 3 attempts')
      );
    });
  });

  describe('batchWithRateLimit', () => {
    it('should process multiple operations successfully', async () => {
      const operations = [
        jest.fn().mockResolvedValue('result1'),
        jest.fn().mockResolvedValue('result2'),
        jest.fn().mockResolvedValue('result3')
      ];

      const results = await batchWithRateLimit(operations, { operation: 'batch_test' });

      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(metrics.incrementApiHits).toHaveBeenCalledTimes(3);
    });

    it('should handle failed operations in batch', async () => {
      const operations = [
        jest.fn().mockResolvedValue('success1'),
        jest.fn().mockRejectedValue(new Error('Failed')),
        jest.fn().mockResolvedValue('success2')
      ];

      const results = await batchWithRateLimit(operations, { operation: 'batch_test' });

      expect(results).toEqual(['success1', 'success2']);
      expect(metrics.incrementErrors).toHaveBeenCalledTimes(1);
    });
  });
}); 