import { ApiErrorType } from '../errorController';

interface ErrorLog {
  type: ApiErrorType;
  asin: string;
  message: string;
  timestamp: Date;
}

interface MetricCounts {
  apiHits: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  priceDrops: number;
  rateLimited: number;
}

interface PriceDrop {
  asin: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number;
  timestamp: Date;
  couponApplied?: boolean;
}

class Metrics {
  private counts: MetricCounts = {
    apiHits: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    priceDrops: 0,
    rateLimited: 0
  };

  private priceDropHistory: PriceDrop[] = [];
  private errorLogs: ErrorLog[] = [];
  private readonly MAX_HISTORY = 1000;

  // Basic metric increments
  incrementApiHits() {
    this.counts.apiHits++;
  }

  incrementCacheHits() {
    this.counts.cacheHits++;
  }

  incrementCacheMisses() {
    this.counts.cacheMisses++;
  }

  incrementRateLimited() {
    this.counts.rateLimited++;
  }

  incrementErrors() {
    this.counts.errors++;
  }

  // Get basic metrics
  getMetrics(): MetricCounts {
    return { ...this.counts };
  }

  // Calculate cache efficiency
  getCacheEfficiency(): number {
    const total = this.counts.cacheHits + this.counts.cacheMisses;
    return total === 0 ? 0 : (this.counts.cacheHits / total) * 100;
  }

  // Record price drops
  recordPriceDrop(drop: PriceDrop) {
    this.counts.priceDrops++;
    this.priceDropHistory.unshift(drop);
    
    if (this.priceDropHistory.length > this.MAX_HISTORY) {
      this.priceDropHistory.pop();
    }
  }

  // Get price drops with optional filtering
  getPriceDrops(options?: { since?: number; limit?: number }) {
    let drops = [...this.priceDropHistory];
    
    if (options?.since) {
      const cutoff = new Date(Date.now() - options.since);
      drops = drops.filter(drop => drop.timestamp > cutoff);
    }

    if (options?.limit) {
      drops = drops.slice(0, options.limit);
    }

    return drops;
  }

  // Record API errors
  recordError(type: ApiErrorType, asin: string, message: string) {
    this.counts.errors++;
    this.errorLogs.unshift({
      type,
      asin,
      message,
      timestamp: new Date()
    });

    if (this.errorLogs.length > this.MAX_HISTORY) {
      this.errorLogs.pop();
    }
  }

  // Get recent errors with optional filtering
  getRecentErrors(limit?: number, since?: number): ErrorLog[] {
    let errors = [...this.errorLogs];
    
    if (since) {
      const cutoff = new Date(Date.now() - since);
      errors = errors.filter(error => error.timestamp > cutoff);
    }

    if (limit) {
      errors = errors.slice(0, limit);
    }

    return errors;
  }

  // Get error distribution
  getErrorDistribution(since?: number): Record<ApiErrorType, number> {
    const errors = since ? this.getRecentErrors(undefined, since) : this.errorLogs;
    
    return errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<ApiErrorType, number>);
  }

  // Reset metrics (useful for testing)
  reset() {
    this.counts = {
      apiHits: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      priceDrops: 0,
      rateLimited: 0
    };
    this.priceDropHistory = [];
    this.errorLogs = [];
  }
}

export const metrics = new Metrics();
export type { MetricCounts, PriceDrop, ErrorLog }; 