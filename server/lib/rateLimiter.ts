import pLimit from 'p-limit';
import { logApiError } from '../errorController';
import { metrics } from './metrics';
import { AmazonErrorHandler } from './amazonErrorHandler';

// Create a limiter that allows 2 requests per second (increased from 1)
const apiLimiter = pLimit(2);

// Maximum retries and delays
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;  // 1 second (reduced from 2)
const MAX_DELAY = 10000;  // 10 seconds (reduced from 30)

// Circuit breaker configuration
const FAILURE_THRESHOLD = 10;  // Increased from 5
const RESET_TIMEOUT = 30000;  // 30 seconds (reduced from 60)

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
  if (!circuitOpen) return false;

  const now = Date.now();
  if (now - lastFailureTime >= RESET_TIMEOUT) {
    console.log('Resetting circuit breaker');
    circuitOpen = false;
    failures = 0;
    return true;
  }
  return false;
}

// Record a failure and potentially open the circuit
function recordFailure() {
  failures++;
  lastFailureTime = Date.now();

  if (failures >= FAILURE_THRESHOLD) {
    console.log(`Circuit breaker opened after ${failures} failures`);
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
  //Temporarily disable the circuit breaker
  // Check circuit breaker
  // if (circuitOpen && !shouldResetCircuit()) {
  //   throw new Error('Circuit breaker is open - too many recent failures');
  // }

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
 * Executes multiple operations with rate limiting, returning successful results
 * @param operations Array of async operations to execute
 * @param context Optional context for error logging
 */
export async function batchWithRateLimit<T>(
  operations: Array<() => Promise<T>>,
  context: { operation: string }
): Promise<T[]> {
  const results: T[] = [];

  for (const operation of operations) {
    try {
      const result = await withRateLimit(operation, context);
      if (result !== null) {
        results.push(result);
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
      // Continue with next operation
    }
  }

  return results;
}