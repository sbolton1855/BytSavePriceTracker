import {
  users,
  type User,
  type UpsertUser,
  products,
  type Product,
  type InsertProduct,
  trackedProducts,
  type TrackedProduct,
  type InsertTrackedProduct,
  priceHistory,
  type PriceHistory,
  type InsertPriceHistory,
  apiErrors,
  type ApiError,
  type InsertApiError,
  config,
  type Config
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByAsin(asin: string): Promise<Product | undefined>;
  updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;

  // Tracked product operations
  createTrackedProduct(trackedProduct: InsertTrackedProduct): Promise<TrackedProduct>;
  getTrackedProduct(id: number): Promise<TrackedProduct | undefined>;
  getTrackedProductsByUserId(userId: string): Promise<TrackedProduct[]>;
  getTrackedProductsByEmail(email: string): Promise<TrackedProduct[]>;
  getTrackedProductByUserAndProduct(userId: string | null, email: string, productId: number): Promise<TrackedProduct | undefined>;
  getTrackedProductsNeedingAlerts(): Promise<(TrackedProduct & { product: Product })[]>;
  updateTrackedProduct(id: number, updates: Partial<TrackedProduct>): Promise<TrackedProduct | undefined>;
  deleteTrackedProduct(id: number): Promise<boolean>;
  getAllTrackedProductsWithDetails(): Promise<(TrackedProduct & { product: Product })[]>;
  getTrackedProductsWithDetailsByEmail(email: string): Promise<(TrackedProduct & { product: Product })[]>;

  // Price history operations
  createPriceHistory(priceHistory: InsertPriceHistory): Promise<PriceHistory>;
  getPriceHistoryByProductId(productId: number): Promise<PriceHistory[]>;

  // Product cleanup operations
  removePriceHistory(productId: number): Promise<void>;
  removeTrackedProductsByProductId(productId: number): Promise<void>;
  removeProduct(productId: number): Promise<void>;

  // API error operations
  createApiError(error: InsertApiError): Promise<ApiError>;
  updateApiError(id: number, update: Partial<ApiError>): Promise<void>;
  getAllApiErrors(): Promise<ApiError[]>;
  getUnresolvedApiErrors(): Promise<ApiError[]>;

  // Global config operations
  getAllConfigEntries(): Promise<Config[]>;
  getGlobalConfig(key: string): Promise<string | null>;

  // Deal operations
  getProductsWithDeals(limit?: number): Promise<Product[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(id, 10)));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Product operations
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByAsin(asin: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.asin, asin));
    return product;
  }

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  // Tracked product operations
  async createTrackedProduct(insertTrackedProduct: InsertTrackedProduct): Promise<TrackedProduct> {
    try {
      console.log('Creating tracked product with data:', insertTrackedProduct);
      const [trackedProduct] = await db.insert(trackedProducts).values({
        ...insertTrackedProduct,
        email: insertTrackedProduct.email.toUpperCase(),
        notified: false
      }).returning();
      console.log('Successfully created tracked product:', trackedProduct);
      return trackedProduct;
    } catch (error) {
      console.error('Failed to create tracked product:', error);
      throw error;
    }
  }

  async getTrackedProduct(id: number): Promise<TrackedProduct | undefined> {
    const [trackedProduct] = await db.select().from(trackedProducts).where(eq(trackedProducts.id, id));
    return trackedProduct;
  }

  async getTrackedProductsByUserId(userId: string): Promise<TrackedProduct[]> {
    return await db.select().from(trackedProducts).where(eq(trackedProducts.userId, userId));
  }

  async getTrackedProductsByEmail(email: string): Promise<TrackedProduct[]> {
    return await db.select().from(trackedProducts).where(eq(trackedProducts.email, email));
  }

  async getTrackedProductByUserAndProduct(userId: string | null, email: string, productId: number): Promise<TrackedProduct | undefined> {
    const query = userId
      ? and(eq(trackedProducts.productId, productId), eq(trackedProducts.userId, userId))
      : and(eq(trackedProducts.productId, productId), eq(trackedProducts.email, email));

    const [trackedProduct] = await db.select().from(trackedProducts).where(query);
    return trackedProduct;
  }

  async getTrackedProductsNeedingAlerts(): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    const trackedItems = await db.select().from(trackedProducts);

    // Get global cooldown setting
    const cooldownHours = parseInt(await this.getGlobalConfig("cooldown_hours") || "72");
    const now = new Date();

    for (const item of trackedItems) {
      const product = await this.getProduct(item.productId);
      if (!product) {
        continue;
      }

      // Check cooldown period - skip if still in cooldown
      if (item.lastAlertSent) {
        const lastAlertTime = new Date(item.lastAlertSent);
        const cooldownEndTime = new Date(lastAlertTime.getTime() + (cooldownHours * 60 * 60 * 1000));

        if (now < cooldownEndTime) {
          const remainingHours = Math.round((cooldownEndTime.getTime() - now.getTime()) / (1000 * 60 * 60));
          console.log(`⏰ Skipping alert for product ${product.asin} - cooldown active for ${remainingHours} more hours`);
          continue;
        }
      }

      // Check price condition based on alert type
      let shouldAlert = false;

      if (item.percentageAlert && item.percentageThreshold && product.originalPrice) {
        // Percentage-based alert: current price is at least X% lower than original
        const targetDiscountPrice = product.originalPrice * (1 - item.percentageThreshold / 100);
        shouldAlert = product.currentPrice <= targetDiscountPrice;
      } else {
        // Fixed price alert: current price is at or below target price
        shouldAlert = product.currentPrice <= item.targetPrice;
      }

      if (shouldAlert) {
        console.log(`🔔 Alert needed for product ${product.asin} - price ${product.currentPrice} meets target ${item.targetPrice}`);
        result.push({ ...item, product });
      }
    }

    return result;
  }

  async updateTrackedProduct(id: number, updates: Partial<TrackedProduct>): Promise<TrackedProduct | undefined> {
    const [trackedProduct] = await db
      .update(trackedProducts)
      .set(updates)
      .where(eq(trackedProducts.id, id))
      .returning();
    return trackedProduct;
  }

  async deleteTrackedProduct(id: number): Promise<boolean> {
    try {
      console.log(`Attempting to delete tracked product with ID: ${id}`);
      const result = await db.delete(trackedProducts).where(eq(trackedProducts.id, id)).returning();
      console.log(`Delete result:`, result);
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting tracked product ${id}:`, error);
      throw error;
    }
  }

  async getAllTrackedProductsWithDetails(): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    const trackedItems = await db.select().from(trackedProducts);

    for (const item of trackedItems) {
      const product = await this.getProduct(item.productId);
      if (product) {
        result.push({ ...item, product });
      }
    }

    return result;
  }

  async getTrackedProductsWithDetailsByEmail(email: string): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    const trackedItems = await db.select().from(trackedProducts).where(eq(trackedProducts.email, email));

    for (const item of trackedItems) {
      const product = await this.getProduct(item.productId);
      if (product) {
        result.push({ ...item, product });
      }
    }

    return result;
  }

  // Price history operations
  async createPriceHistory(insertPriceHistory: InsertPriceHistory): Promise<PriceHistory> {
    const [priceHistoryItem] = await db.insert(priceHistory).values(insertPriceHistory).returning();
    return priceHistoryItem;
  }

  async getPriceHistoryByProductId(productId: number): Promise<PriceHistory[]> {
    return await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productId, productId))
      .orderBy(priceHistory.timestamp);
  }

  // Product cleanup operations
  async removePriceHistory(productId: number): Promise<void> {
    await db.delete(priceHistory).where(eq(priceHistory.productId, productId));
  }

  async removeTrackedProductsByProductId(productId: number): Promise<void> {
    await db.delete(trackedProducts).where(eq(trackedProducts.productId, productId));
  }

  async removeProduct(productId: number): Promise<void> {
    await db.delete(products).where(eq(products.id, productId));
  }

  // API error operations
  async createApiError(error: InsertApiError): Promise<ApiError> {
    const [apiError] = await db.insert(apiErrors).values(error).returning();
    return apiError;
  }

  async updateApiError(id: number, update: Partial<ApiError>): Promise<void> {
    await db.update(apiErrors).set(update).where(eq(apiErrors.id, id));
  }

  async getAllApiErrors(): Promise<ApiError[]> {
    return await db.select().from(apiErrors);
  }

  async getUnresolvedApiErrors(): Promise<ApiError[]> {
    return await db.select().from(apiErrors).where(eq(apiErrors.resolved, false));
  }

  // Global config operations
  async getAllConfigEntries(): Promise<Config[]> {
    return await db.select().from(config);
  }

  async getGlobalConfig(key: string): Promise<string | null> {
    const result = await db.select().from(config).where(eq(config.key, key)).limit(1);
    return result.length > 0 ? result[0].value : null;
  }

  // Deal operations
  async getProductsWithDeals(limit: number = 10): Promise<Product[]> {
    const allProducts = await db.select().from(products);

    console.log(`[getProductsWithDeals] Total products in database: ${allProducts.length}`);

    // Filter products that have deals with more relaxed criteria
    const productsWithDeals = allProducts.filter(product => {
      // Basic validation
      if (!product.title || !product.asin || product.currentPrice <= 0) {
        return false;
      }

      // Check if it was recently checked (within 7 days instead of 48 hours)
      if (product.lastChecked) {
        const lastChecked = new Date(product.lastChecked);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (lastChecked < sevenDaysAgo) {
          return false;
        }
      }

      // Has discount percentage or price difference
      const hasDiscountPercentage = product.discountPercentage && product.discountPercentage > 5;
      const hasPriceDrop = product.originalPrice && product.originalPrice > product.currentPrice;

      return hasDiscountPercentage || hasPriceDrop;
    });

    console.log(`[getProductsWithDeals] Products with deals after filtering: ${productsWithDeals.length}`);

    // Sort by discount percentage or price difference, then take the limit
    const sortedDeals = productsWithDeals.sort((a, b) => {
      const aDiscount = a.discountPercentage || 
        (a.originalPrice && a.currentPrice ? 
          Math.round(((a.originalPrice - a.currentPrice) / a.originalPrice) * 100) : 0);
      const bDiscount = b.discountPercentage || 
        (b.originalPrice && b.currentPrice ? 
          Math.round(((b.originalPrice - b.currentPrice) / b.originalPrice) * 100) : 0);
      return bDiscount - aDiscount;
    });

    const result = sortedDeals.slice(0, limit);
    console.log(`[getProductsWithDeals] Returning ${result.length} deals`);

    return result;
  }
}

export const storage = new DatabaseStorage();

// Export standalone function for easier imports
export async function getGlobalConfig(key: string): Promise<string | null> {
  return storage.getGlobalConfig(key);
}