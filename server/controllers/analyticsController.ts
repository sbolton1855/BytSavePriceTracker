import { metrics } from '../lib/metrics';
import { getErrorStats } from '../errorController';

export interface AnalyticsSummary {
  apiHits: number;
  cacheHits: number;
  cacheMisses: number;
  priceDrops: number;
  topDrops: Array<{
    asin: string;
    title: string;
    oldPrice: number;
    newPrice: number;
    dropPercent: number;
    timestamp: Date;
    couponApplied?: boolean;
  }>;
  errorCounts: {
    API_FAILURE?: number;
    INVALID_ASIN?: number;
    NOT_FOUND?: number;
    PRICE_MISMATCH?: number;
    PRICE_DROP?: number;
    RATE_LIMIT?: number;
    TIMEOUT?: number;
  };
  cacheEfficiency: number;
  lastUpdate: Date;
}

export async function getAnalyticsSummary(timeRange?: {
  since?: number; // milliseconds
}): Promise<AnalyticsSummary> {
  // Get basic metrics
  const counts = metrics.getMetrics();
  
  // Get price drops with optional time filter
  const drops = metrics.getPriceDrops({
    since: timeRange?.since,
    limit: 10 // Top 10 drops
  });

  // Get error statistics
  const errorStats = await getErrorStats();

  return {
    apiHits: counts.apiHits,
    cacheHits: counts.cacheHits,
    cacheMisses: counts.cacheMisses,
    priceDrops: counts.priceDrops,
    topDrops: drops.sort((a, b) => b.dropPercent - a.dropPercent), // Sort by highest drop %
    errorCounts: errorStats.byType,
    cacheEfficiency: metrics.getCacheEfficiency(),
    lastUpdate: new Date()
  };
}

// Get trend data for charts
export function getTrendData(days: number = 7) {
  const now = Date.now();
  const drops = metrics.getPriceDrops({
    since: days * 24 * 60 * 60 * 1000 // Convert days to ms
  });

  // Group drops by day
  const dailyDrops = drops.reduce((acc, drop) => {
    const date = new Date(drop.timestamp);
    const day = date.toISOString().split('T')[0];
    
    if (!acc[day]) {
      acc[day] = {
        count: 0,
        totalDropPercent: 0,
        drops: []
      };
    }
    
    acc[day].count++;
    acc[day].totalDropPercent += drop.dropPercent;
    acc[day].drops.push(drop);
    
    return acc;
  }, {} as Record<string, { 
    count: number; 
    totalDropPercent: number;
    drops: typeof drops;
  }>);

  // Convert to array and calculate averages
  return Object.entries(dailyDrops).map(([date, data]) => ({
    date,
    count: data.count,
    averageDropPercent: data.totalDropPercent / data.count,
    drops: data.drops
  }));
}

// Get cache efficiency over time (last 24 hours in hourly intervals)
export function getCacheEfficiencyTrend() {
  // Note: This is a placeholder that would need actual historical data
  // In a real implementation, we'd store these metrics in a time-series database
  return {
    current: metrics.getCacheEfficiency(),
    trend: [] // Would contain historical efficiency data points
  };
} 