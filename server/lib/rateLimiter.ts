import pLimit from 'p-limit';
import { logApiError } from '../errorController';
import { metrics } from './metrics';

// Create a limiter that allows 1 request per second
const apiLimiter = pLimit(1);

// Maximum retries for failed requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps an async function with retry logic and rate limiting
 * @param fn The async function to execute
 * @param context Optional context for error logging
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  context: { asin?: string; operation: string }
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      metrics.incrementApiHits();
      // Execute the function with rate limiting
      return await apiLimiter(fn);
    } catch (error) {
      metrics.incrementRateLimited();
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Log the retry attempt
      console.warn(`API request failed (attempt ${attempt}/${MAX_RETRIES}):`, {
        error: lastError.message,
        context
      });

      // Log to API errors if it's the last attempt
      if (attempt === MAX_RETRIES) {
        await logApiError(
          context.asin || 'BATCH',
          'RATE_LIMIT',
          `Failed after ${MAX_RETRIES} attempts: ${lastError.message}`
        );
      }

      // Wait before retrying
      await sleep(RETRY_DELAY * attempt);
    }
  }

  // If we get here, all retries failed
  metrics.incrementErrors();
  throw lastError || new Error('Rate limited operation failed');
}

/**
 * Executes multiple rate-limited operations in parallel, with throttling
 * @param operations Array of operations to execute
 * @param context Context for error logging
 */
export async function batchWithRateLimit<T>(
  operations: Array<() => Promise<T>>,
  context: { operation: string }
): Promise<T[]> {
  type SettledResult = PromiseSettledResult<Awaited<T> | null>;
  
  // Execute operations in parallel, but rate-limited
  const results = await Promise.allSettled(
    operations.map(op => 
      withRateLimit(op, context)
        .catch(error => {
          console.error('Batch operation failed:', error);
          metrics.incrementErrors();
          return null;
        })
    )
  );

  // Filter out failed operations and extract values
  return results
    .filter((result): result is PromiseFulfilledResult<Awaited<T>> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
} 