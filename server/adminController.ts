import { db } from "./db";
import { storage } from "./storage";
import { apiErrors, systemMetrics, products as productsTable, trackedProducts, priceHistory } from "@shared/schema";
import { desc, eq, count, and, sql, gte, gt, lt } from "drizzle-orm";

// Helper function to log Amazon API errors
export async function logApiError(asin: string, errorType: string, errorMessage: string) {
  try {
    await db.insert(apiErrors).values({
      asin,
      errorType,
      errorMessage,
      resolved: false
    });
    console.log(`Logged API error for ${asin}: ${errorType}`);
  } catch (error) {
    console.error("Failed to log API error:", error);
  }
}

// Helper function to log system metrics
export async function logSystemMetric(metricType: string, metricValue: number, additionalData: any = null) {
  try {
    await db.insert(systemMetrics).values({
      metricType,
      metricValue,
      additionalData
    });
  } catch (error) {
    console.error("Failed to log system metric:", error);
  }
}

// Get error statistics for the admin dashboard
export async function getErrorStats() {
  try {
    // Get total error count
    const totalErrorsResult = await db
      .select({ count: count() })
      .from(apiErrors);
    const totalErrors = totalErrorsResult[0]?.count || 0;

    // Get errors by date (last 10 days)
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const errorsByDate = await db
      .select({
        date: sql<string>`to_char(${apiErrors.createdAt}, 'YYYY-MM-DD')`,
        count: count()
      })
      .from(apiErrors)
      .where(gte(apiErrors.createdAt, tenDaysAgo))
      .groupBy(sql`to_char(${apiErrors.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${apiErrors.createdAt}, 'YYYY-MM-DD')`);

    // Get errors by ASIN (top 10)
    const errorsByAsin = await db
      .select({
        asin: apiErrors.asin,
        count: count()
      })
      .from(apiErrors)
      .groupBy(apiErrors.asin)
      .orderBy(desc(count()))
      .limit(10);

    // Get errors by type
    const errorsByType = await db
      .select({
        type: apiErrors.errorType,
        count: count()
      })
      .from(apiErrors)
      .groupBy(apiErrors.errorType)
      .orderBy(desc(count()));

    return {
      total: totalErrors,
      byDate: errorsByDate,
      byAsin: errorsByAsin,
      byErrorType: errorsByType
    };
  } catch (error) {
    console.error("Failed to get error statistics:", error);
    return {
      total: 0,
      byDate: [],
      byAsin: [],
      byErrorType: []
    };
  }
}

// Get product statistics for the admin dashboard
export async function getProductStats() {
  try {
    // Get total product count
    const totalProductsResult = await db
      .select({ count: count() })
      .from(productsTable);
    const totalProducts = totalProductsResult[0]?.count || 0;

    // Get tracked product count
    const trackedProductsResult = await db
      .select({ count: count() })
      .from(trackedProducts);
    const trackedProductsCount = trackedProductsResult[0]?.count || 0;

    // Get products with price history
    const productsWithHistoryResult = await db
      .select({ count: count(productsTable.id) })
      .from(productsTable)
      .leftJoin(priceHistory, eq(productsTable.id, priceHistory.productId))
      .where(gt(count(priceHistory.id), 0));
    const productsWithHistory = productsWithHistoryResult[0]?.count || 0;

    // Get products with active alerts
    const productsWithAlertsResult = await db
      .select({ count: count() })
      .from(trackedProducts)
      .where(eq(trackedProducts.notified, false));
    const productsWithAlerts = productsWithAlertsResult[0]?.count || 0;

    // Get recently added products (last 10 days)
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const recentlyAddedProducts = await db
      .select({
        date: sql<string>`to_char(${productsTable.createdAt}, 'YYYY-MM-DD')`,
        count: count()
      })
      .from(productsTable)
      .where(gte(productsTable.createdAt, tenDaysAgo))
      .groupBy(sql`to_char(${productsTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${productsTable.createdAt}, 'YYYY-MM-DD')`);

    return {
      total: totalProducts,
      tracked: trackedProductsCount,
      withPriceHistory: productsWithHistory,
      withAlerts: productsWithAlerts,
      recentlyAdded: recentlyAddedProducts
    };
  } catch (error) {
    console.error("Failed to get product statistics:", error);
    return {
      total: 0,
      tracked: 0,
      withPriceHistory: 0,
      withAlerts: 0,
      recentlyAdded: []
    };
  }
}

// Get system statistics for the admin dashboard
export async function getSystemStats() {
  try {
    // Get API success rate metrics from the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const successRateMetric = await db
      .select({ metricValue: systemMetrics.metricValue })
      .from(systemMetrics)
      .where(
        and(
          eq(systemMetrics.metricType, 'api_success_rate'),
          gte(systemMetrics.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(systemMetrics.createdAt))
      .limit(1);

    // Get average response time from the last 24 hours
    const responseTimeMetric = await db
      .select({ metricValue: systemMetrics.metricValue })
      .from(systemMetrics)
      .where(
        and(
          eq(systemMetrics.metricType, 'api_response_time'),
          gte(systemMetrics.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(systemMetrics.createdAt))
      .limit(1);

    // Get most recent price check timestamp
    const lastPriceCheckMetric = await db
      .select({ 
        createdAt: systemMetrics.createdAt,
        additionalData: systemMetrics.additionalData
      })
      .from(systemMetrics)
      .where(eq(systemMetrics.metricType, 'price_check'))
      .orderBy(desc(systemMetrics.createdAt))
      .limit(1);

    // Get total price checks performed
    const totalPriceChecksResult = await db
      .select({ count: count() })
      .from(systemMetrics)
      .where(eq(systemMetrics.metricType, 'price_check'));

    // Get price check history with success/failure counts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const checkHistoryData = await db
      .select({
        date: sql<string>`to_char(${systemMetrics.createdAt}, 'YYYY-MM-DD')`,
        additionalData: systemMetrics.additionalData
      })
      .from(systemMetrics)
      .where(
        and(
          eq(systemMetrics.metricType, 'price_check_summary'),
          gte(systemMetrics.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(sql`to_char(${systemMetrics.createdAt}, 'YYYY-MM-DD')`);

    // Process check history data to get success/failure counts
    const checkHistory = checkHistoryData.map(item => {
      const data = item.additionalData;
      return {
        date: item.date,
        success: data?.success || 0,
        failed: data?.failed || 0
      };
    });

    return {
      apiSuccessRate: successRateMetric[0]?.metricValue || 100,
      averageResponseTime: responseTimeMetric[0]?.metricValue || 0,
      lastPriceCheck: lastPriceCheckMetric[0]?.createdAt?.toISOString() || new Date().toISOString(),
      totalPriceChecks: totalPriceChecksResult[0]?.count || 0,
      checkHistory
    };
  } catch (error) {
    console.error("Failed to get system statistics:", error);
    return {
      apiSuccessRate: 100,
      averageResponseTime: 0,
      lastPriceCheck: new Date().toISOString(),
      totalPriceChecks: 0,
      checkHistory: []
    };
  }
}

// Get all admin dashboard data
export async function getAdminDashboardData() {
  const errorStats = await getErrorStats();
  const productStats = await getProductStats();
  const systemStats = await getSystemStats();

  return {
    errorStats,
    productStats,
    systemStats
  };
}