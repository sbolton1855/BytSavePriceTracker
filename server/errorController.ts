import { storage } from './storage';
import type { ApiError } from '../shared/schema.js';

// Error types
export type ApiErrorType = 
  | 'API_FAILURE'    // General API failures
  | 'INVALID_ASIN'   // Invalid ASIN format
  | 'NOT_FOUND'      // Product not found
  | 'PRICE_MISMATCH' // Price from API doesn't match actual price
  | 'PRICE_DROP'     // Price has dropped
  | 'RATE_LIMIT'     // API rate limit exceeded
  | 'TIMEOUT';       // API request timeout

// Type guard for ApiErrorType
function isApiErrorType(type: string): type is ApiErrorType {
  return [
    'API_FAILURE',
    'INVALID_ASIN',
    'NOT_FOUND',
    'PRICE_MISMATCH',
    'PRICE_DROP',
    'RATE_LIMIT',
    'TIMEOUT'
  ].includes(type);
}

/**
 * Log an API error
 * @param asin The Amazon ASIN that caused the error
 * @param errorType The type of error
 * @param errorMessage The full error message
 */
export async function logApiError(
  asin: string,
  errorType: ApiErrorType,
  errorMessage: string
): Promise<ApiError> {
  console.error(`API Error (${errorType}) for ${asin}:`, errorMessage);
  
  return await storage.createApiError({
    asin,
    errorType,
    errorMessage,
    resolved: false
  });
}

/**
 * Get error statistics for the API monitor dashboard
 */
export async function getApiErrorStats() {
  try {
    // Get total error count
    const totalErrorsResult = await storage.getAllApiErrors();
    const totalErrors = totalErrorsResult.length;

    // Get errors by type
    const errorsByType = totalErrorsResult.reduce((acc, error) => {
      if (error.errorType && isApiErrorType(error.errorType)) {
        acc[error.errorType] = (acc[error.errorType] || 0) + 1;
      }
      return acc;
    }, {} as Partial<Record<ApiErrorType, number>>);

    // Get errors by ASIN (top 10)
    const errorsByAsin = totalErrorsResult
      .filter(error => error.createdAt)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);

    // Get recent errors (last 20)
    const recentErrors = totalErrorsResult
      .filter(error => error.createdAt)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 20);

    return {
      total: totalErrors,
      byErrorType: errorsByType,
      byAsin: errorsByAsin,
      recentErrors
    };
  } catch (error) {
    console.error("Failed to get API error statistics:", error);
    return {
      total: 0,
      byErrorType: {},
      byAsin: [],
      recentErrors: []
    };
  }
}

/**
 * Mark an error as resolved
 * @param errorId The ID of the error to mark as resolved
 */
export async function markErrorAsResolved(errorId: number) {
  try {
    await storage.updateApiError(errorId, { resolved: true });
    return true;
  } catch (error) {
    console.error("Failed to mark error as resolved:", error);
    return false;
  }
}

// Get unresolved errors
export async function getUnresolvedErrors(): Promise<ApiError[]> {
  return await storage.getUnresolvedApiErrors();
}

// Get error stats
export async function getErrorStats(): Promise<{
  total: number;
  unresolved: number;
  byType: Partial<Record<ApiErrorType, number>>;
}> {
  const errors = await storage.getAllApiErrors();
  const unresolved = errors.filter(e => !e.resolved);
  
  const byType = errors.reduce((acc, error) => {
    if (error.errorType && isApiErrorType(error.errorType)) {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1;
    }
    return acc;
  }, {} as Partial<Record<ApiErrorType, number>>);
  
  return {
    total: errors.length,
    unresolved: unresolved.length,
    byType
  };
}

// Mark error as resolved
export async function resolveError(id: number): Promise<void> {
  await storage.updateApiError(id, { resolved: true });
}