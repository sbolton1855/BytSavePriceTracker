import { AxiosError } from 'axios';
import { metrics } from './metrics';
import { logApiError } from '../errorController';
import type { ApiErrorType } from '../errorController';

interface AmazonApiError {
  type: ApiErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

export class AmazonErrorHandler {
  private static parseError(error: unknown): AmazonApiError {
    if (error instanceof Error) {
      // Handle Axios errors
      if ((error as AxiosError).isAxiosError) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        
        // Handle specific HTTP status codes
        switch (statusCode) {
          case 429:
            return {
              type: 'RATE_LIMIT',
              message: 'Rate limit exceeded',
              retryable: true,
              statusCode
            };
          case 403:
            return {
              type: 'API_FAILURE',
              message: 'Authentication failed or access denied',
              retryable: false,
              statusCode
            };
          case 404:
            return {
              type: 'NOT_FOUND',
              message: 'Product not found',
              retryable: false,
              statusCode
            };
          case 500:
          case 502:
          case 503:
          case 504:
            return {
              type: 'API_FAILURE',
              message: 'Amazon API service error',
              retryable: true,
              statusCode
            };
        }

        // Handle timeout
        if (axiosError.code === 'ECONNABORTED') {
          return {
            type: 'TIMEOUT',
            message: 'Request timed out',
            retryable: true
          };
        }
      }

      // Handle specific error messages
      if (error.message.includes('price')) {
        return {
          type: 'PRICE_MISMATCH',
          message: error.message,
          retryable: false
        };
      }

      if (error.message.includes('ASIN')) {
        return {
          type: 'INVALID_ASIN',
          message: error.message,
          retryable: false
        };
      }
    }

    // Default error
    return {
      type: 'API_FAILURE',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      retryable: true
    };
  }

  static async handleError(error: unknown, asin: string): Promise<never> {
    const parsedError = this.parseError(error);
    
    // Log the error
    await logApiError(asin, parsedError.type, parsedError.message);
    
    // Track in metrics
    metrics.recordError(parsedError.type, asin, parsedError.message);
    
    // Throw enhanced error
    throw new Error(`Amazon API Error (${parsedError.type}): ${parsedError.message}`);
  }

  static isRetryable(error: unknown): boolean {
    return this.parseError(error).retryable;
  }
} 