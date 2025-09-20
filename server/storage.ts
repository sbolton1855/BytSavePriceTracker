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
  getProductsWithDeals(limit?: number): Promise<Product[]>;

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

    for (const item of trackedItems) {
      const product = await this.getProduct(item.productId);
      if (!product || item.notified) {
        continue;
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

  // Deal operations
  async getProductsWithDeals(limit: number = 10): Promise<Product[]> {
    const allProducts = await db.select().from(products);
    
    // Filter products that have deals (discount percentage > 0 or original price > current price)
    const productsWithDeals = allProducts.filter(product => 
      (product.discountPercentage && product.discountPercentage > 0) ||
      (product.originalPrice && product.currentPrice && product.originalPrice > product.currentPrice)
    );

    // Sort by discount percentage or price difference, then take the limit
    const sortedDeals = productsWithDeals.sort((a, b) => {
      const aDiscount = a.discountPercentage || 
        (a.originalPrice && a.currentPrice ? 
          Math.round(((a.originalPrice - a.currentPrice) / a.originalPrice) * 100) : 0);
      const bDiscount = b.discountPercentage || 
        (b.originalPrice && b.currentPrice ? 
          Math.round(((b.originalPrice - b.currentPrice) / b.currentPrice) * 100) : 0);
      return bDiscount - aDiscount;
    });

    return sortedDeals.slice(0, limit);
  }

  // Global config operations
  async getAllConfigEntries(): Promise<Config[]> {
    return await db.select().from(config);
  }

  async getGlobalConfig(key: string): Promise<string | null> {
    const result = await db.select().from(config).where(eq(config.key, key)).limit(1);
    return result.length > 0 ? result[0].value : null;
  }
}

export const storage = new DatabaseStorage();

// Helper function for getting global config (used by emailTrigger)
export async function getGlobalConfig(key: string): Promise<string | null> {
  return await storage.getGlobalConfig(key);
}