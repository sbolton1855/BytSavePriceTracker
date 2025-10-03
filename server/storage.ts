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
import { eq, and, or, gt, sql, isNotNull, ilike } from "drizzle-orm";

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
  getProductsWithDeals(limit?: number, offset?: number, category?: string): Promise<Product[]>;
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
  async getAllConfigEntries(): Promise<Config[][]> {
    return await db.select().from(config);
  }

  async getGlobalConfig(key: string): Promise<string | null> {
    const result = await db.select().from(config).where(eq(config.key, key)).limit(1);
    return result.length > 0 ? result[0].value : null;
  }

  // Deal operations
  async getProductsWithDeals(limit: number = 20, offset: number = 0, category?: string): Promise<Product[]> {
    let whereConditions = and(
      eq(products.isDiscovered, true),
      or(
        and(
          isNotNull(products.discountPercentage),
          gt(products.discountPercentage, 0)
        ),
        and(
          isNotNull(products.originalPrice),
          isNotNull(products.currentPrice),
          gt(products.originalPrice, products.currentPrice)
        )
      )
    );

    // Add category filtering using the category column
    if (category) {
      whereConditions = and(
        whereConditions,
        eq(products.category, category)
      );
    }

    const rawProducts = await db
      .select()
      .from(products)
      .where(whereConditions)
      .orderBy(sql`RANDOM()`)
      .limit(limit)
      .offset(offset);

    // Calculate discount and savings dynamically in JavaScript
    return rawProducts.map(product => {
      const currentPrice = product.currentPrice;
      const originalPrice = product.originalPrice;
      
      let discount = product.discountPercentage || 0;
      let savings = 0;

      // Recalculate if we have original price
      if (originalPrice && originalPrice > currentPrice) {
        discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
        savings = Math.round((originalPrice - currentPrice) * 100) / 100;
      }

      return {
        ...product,
        discountPercentage: discount,
        // Note: We're not adding a savings field to the Product type
        // If needed, compute it in the route handler
      };
    });
  }

  // Helper method to get keywords for category filtering
  private getCategoryKeywords(category: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'seasonal': [
        'winter', 'summer', 'spring', 'fall', 'autumn', 'holiday', 'christmas', 'halloween',
        'thanksgiving', 'easter', 'valentine', 'seasonal', 'beach', 'pool', 'garden',
        'outdoor', 'camping', 'bbq', 'grilling'
      ],
      'health': [
        'vitamin', 'supplement', 'protein', 'health', 'wellness', 'beauty', 'skincare',
        'makeup', 'cosmetic', 'hair', 'nail', 'biotin', 'collagen', 'omega', 'probiotics',
        'multivitamin', 'mineral', 'organic', 'natural', 'essential oil', 'facial', 'serum'
      ],
      'tech': [
        'bluetooth', 'wireless', 'headphones', 'earbuds', 'speaker', 'charger', 'cable',
        'phone', 'tablet', 'computer', 'laptop', 'keyboard', 'mouse', 'monitor', 'smart',
        'gadget', 'electronic', 'tech', 'digital', 'usb', 'portable', 'device', 'accessory',
        'kitchen gadget', 'home automation', 'smart home', 'appliance'
      ]
    };

    return keywordMap[category] || [];
  }
}

export const storage = new DatabaseStorage();

// Export standalone function for easier imports
export async function getGlobalConfig(key: string): Promise<string | null> {
  return storage.getGlobalConfig(key);
}