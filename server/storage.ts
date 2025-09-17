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
  type Config,
  type NewConfig
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lt } from "drizzle-orm";

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
  getTrackedProductsNeedingAlerts(): Promise<(TrackedProduct & { product: Product; user: User })[]>;
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
  getGlobalConfig(key: string): Promise<string | null>;
  setGlobalConfig(key: string, value: string): Promise<void>;
  getAllGlobalConfig(): Promise<Config[]>;
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

  async getTrackedProductsNeedingAlerts(): Promise<(TrackedProduct & { product: Product; user: User })[]> {
    const result: (TrackedProduct & { product: Product; user: User })[] = [];
    const trackedItems = await db
      .select()
      .from(trackedProducts)
      .innerJoin(users, eq(trackedProducts.userId, users.id));

    for (const item of trackedItems) {
      const product = await this.getProduct(item.trackedProducts.productId);
      if (!product) {
        continue;
      }

      const now = new Date();
      const cooldownMs = (item.users.cooldownHours ?? 48) * 60 * 60 * 1000;

      if (
        item.trackedProducts.lastAlertSent &&
        now.getTime() - new Date(item.trackedProducts.lastAlertSent).getTime() < cooldownMs
      ) {
        continue; // still within cooldown period
      }

      // Check price condition based on alert type
      let shouldAlert = false;

      if (item.trackedProducts.percentageAlert && item.trackedProducts.percentageThreshold && product.originalPrice) {
        // Percentage-based alert: current price is at least X% lower than original
        const targetDiscountPrice = product.originalPrice * (1 - item.trackedProducts.percentageThreshold / 100);
        shouldAlert = product.currentPrice <= targetDiscountPrice;
      } else {
        // Fixed price alert: current price is at or below target price
        shouldAlert = product.currentPrice <= item.trackedProducts.targetPrice;
      }

      if (shouldAlert) {
        result.push({
          ...item.trackedProducts,
          product,
          user: item.users
        });
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
    try {
      const results = await db
        .select({
          id: trackedProducts.id,
          userId: trackedProducts.userId,
          email: trackedProducts.email,
          productId: trackedProducts.productId,
          targetPrice: trackedProducts.targetPrice,
          percentageAlert: trackedProducts.percentageAlert,
          percentageThreshold: trackedProducts.percentageThreshold,
          lastAlertSent: trackedProducts.lastAlertSent,
          cooldownHours: trackedProducts.cooldownHours,
          lastNotifiedPrice: trackedProducts.lastNotifiedPrice,
          createdAt: trackedProducts.createdAt,
          product: {
            id: products.id,
            asin: products.asin,
            title: products.title,
            url: products.url,
            imageUrl: products.imageUrl,
            currentPrice: products.currentPrice,
            originalPrice: products.originalPrice,
            lastChecked: products.lastChecked,
            lowestPrice: products.lowestPrice,
            highestPrice: products.highestPrice,
          },
        })
        .from(trackedProducts)
        .innerJoin(products, eq(trackedProducts.productId, products.id));

      return results.map((row) => ({
        ...row,
        userId: row.userId ?? 0,
        createdAt: new Date(row.createdAt),
        lastAlertSent: row.lastAlertSent ? new Date(row.lastAlertSent) : null,
        product: {
          ...row.product,
          lastChecked: new Date(row.product.lastChecked),
        },
      }));
    } catch (error) {
      console.error('Error getting tracked products with details:', error);
      throw error;
    }
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

  // Global config functions
  async getGlobalConfig(key: string): Promise<string | null> {
    const result = await db.select().from(config).where(eq(config.key, key)).limit(1);
    return result[0]?.value || null;
  },

  async setGlobalConfig(key: string, value: string): Promise<void> {
    await db.insert(config)
      .values({ key, value })
      .onConflictDoUpdate({
        target: config.key,
        set: { value, updatedAt: new Date() }
      });
  },

  async getAllGlobalConfig(): Promise<Config[]> {
    return await db.select().from(config);
  }
}

export const storage = new DatabaseStorage();