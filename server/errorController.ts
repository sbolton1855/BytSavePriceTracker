import { db } from "./db";
import { apiErrors } from "@shared/schema";
import { desc, eq, count, and, sql, gte } from "drizzle-orm";

/**
 * Log an Amazon API error
 * @param asin The Amazon ASIN that caused the error
 * @param errorType The type of error
 * @param errorMessage The full error message
 */
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

/**
 * Get error statistics for the API monitor dashboard
 */
export async function getApiErrorStats() {
  try {
    // Get total error count
    const totalErrorsResult = await db
      .select({ count: count() })
      .from(apiErrors);
    const totalErrors = totalErrorsResult[0]?.count || 0;

    // Get errors by type
    const errorsByType = await db
      .select({
        errorType: apiErrors.errorType,
        count: count()
      })
      .from(apiErrors)
      .groupBy(apiErrors.errorType)
      .orderBy(desc(count()));

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

    // Get recent errors (last 20)
    const recentErrors = await db
      .select()
      .from(apiErrors)
      .orderBy(desc(apiErrors.createdAt))
      .limit(20);

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
      byErrorType: [],
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
    await db
      .update(apiErrors)
      .set({ resolved: true })
      .where(eq(apiErrors.id, errorId));
    return true;
  } catch (error) {
    console.error("Failed to mark error as resolved:", error);
    return false;
  }
}