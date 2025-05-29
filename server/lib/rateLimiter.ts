import pLimit from 'p-limit';
import { logApiError } from '../errorController';
import { metrics } from './metrics';
import { AmazonErrorHandler } from './amazonErrorHandler';

// Create a limiter that allows 1 request per second
const apiLimiter = pLimit(1);

// Maximum retries and delays
const MAX_RETRIES = 5;  // Increased from 3
const BASE_DELAY = 2000;  // 2 seconds
const MAX_DELAY = 30000;  // 30 seconds

// Circuit breaker configuration
const FAILURE_THRESHOLD = 5;  // Number of failures before opening circuit
const RESET_TIMEOUT = 60000;  // 1 minute timeout before attempting to close circuit

// Circuit breaker state
let failures = 0;
let lastFailureTime = 0;
let circuitOpen = false;

// Sleep utility with jitter
const sleep = (ms: number) => {
  const jitter = Math.random() * 0.3 * ms;  // Add up to 30% jitter
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
};

// Check if circuit breaker should be reset
function shouldResetCircuit(): boolean {
  if (circuitOpen && Date.now() - lastFailureTime >= RESET_TIMEOUT) {
    failures = 0;
    circuitOpen = false;
    return true;
  }
  return false;
}

// Update circuit breaker state on failure
function recordFailure() {
  failures++;
  lastFailureTime = Date.now();
  if (failures >= FAILURE_THRESHOLD) {
    circuitOpen = true;
  }
}

/**
 * Wraps an async function with retry logic and rate limiting
 * @param fn The async function to execute
 * @param context Optional context for error logging
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  context: { asin?: string; operation: string }
): Promise<T> {
  // Check circuit breaker
  if (circuitOpen && !shouldResetCircuit()) {
    throw new Error('Circuit breaker is open - too many recent failures');
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      metrics.incrementApiHits();
      // Execute the function with rate limiting
      return await apiLimiter(fn);
    } catch (error) {
      metrics.incrementRateLimited();
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Check if error is retryable
      if (!AmazonErrorHandler.isRetryable(error)) {
        throw lastError;
      }
      
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
        recordFailure();
      }

      // Calculate exponential backoff with max delay
      const delay = Math.min(
        BASE_DELAY * Math.pow(2, attempt - 1),
        MAX_DELAY
      );

      // Wait before retrying
      await sleep(delay);
    }
  }

  // If we get here, all retries failed
  metrics.incrementErrors();
  recordFailure();
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