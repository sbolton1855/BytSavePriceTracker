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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
    const [trackedProduct] = await db.insert(trackedProducts).values(insertTrackedProduct).returning();
    return trackedProduct;
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
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(trackedProducts.id, id))
      .returning();
    return trackedProduct;
  }

  async deleteTrackedProduct(id: number): Promise<boolean> {
    const result = await db.delete(trackedProducts).where(eq(trackedProducts.id, id));
    return result.count > 0;
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
}

export const storage = new DatabaseStorage();