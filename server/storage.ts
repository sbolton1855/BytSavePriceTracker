import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  trackedProducts, type TrackedProduct, type InsertTrackedProduct,
  priceHistory as priceHistoryTable, type PriceHistory, type InsertPriceHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Storage interface for BytSave application
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByAsin(asin: string): Promise<Product | undefined>;
  updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;

  // Tracked product operations
  createTrackedProduct(trackedProduct: InsertTrackedProduct): Promise<TrackedProduct>;
  getTrackedProduct(id: number): Promise<TrackedProduct | undefined>;
  getTrackedProductsByUserId(userId: number): Promise<TrackedProduct[]>;
  getTrackedProductsByEmail(email: string): Promise<TrackedProduct[]>;
  getTrackedProductByUserAndProduct(userId: number | null, email: string, productId: number): Promise<TrackedProduct | undefined>;
  getTrackedProductsNeedingAlerts(): Promise<(TrackedProduct & { product: Product })[]>;
  updateTrackedProduct(id: number, updates: Partial<TrackedProduct>): Promise<TrackedProduct | undefined>;
  deleteTrackedProduct(id: number): Promise<boolean>;
  getAllTrackedProductsWithDetails(): Promise<(TrackedProduct & { product: Product })[]>;
  getTrackedProductsWithDetailsByEmail(email: string): Promise<(TrackedProduct & { product: Product })[]>;

  // Price history operations
  createPriceHistory(priceHistory: InsertPriceHistory): Promise<PriceHistory>;
  getPriceHistoryByProductId(productId: number): Promise<PriceHistory[]>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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
    const [updatedProduct] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products);
  }

  // Tracked product operations
  async createTrackedProduct(insertTrackedProduct: InsertTrackedProduct): Promise<TrackedProduct> {
    const [trackedProduct] = await db
      .insert(trackedProducts)
      .values({ ...insertTrackedProduct, notified: false })
      .returning();
    return trackedProduct;
  }

  async getTrackedProduct(id: number): Promise<TrackedProduct | undefined> {
    const [trackedProduct] = await db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.id, id));
    return trackedProduct;
  }

  async getTrackedProductsByUserId(userId: number): Promise<TrackedProduct[]> {
    return db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.userId, userId));
  }

  async getTrackedProductsByEmail(email: string): Promise<TrackedProduct[]> {
    return db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.email, email));
  }

  async getTrackedProductByUserAndProduct(userId: number | null, email: string, productId: number): Promise<TrackedProduct | undefined> {
    let query;
    if (userId !== null) {
      query = and(
        eq(trackedProducts.userId, userId),
        eq(trackedProducts.productId, productId)
      );
    } else {
      query = and(
        eq(trackedProducts.email, email),
        eq(trackedProducts.productId, productId)
      );
    }

    const [trackedProduct] = await db
      .select()
      .from(trackedProducts)
      .where(query);
    
    return trackedProduct;
  }

  async getTrackedProductsNeedingAlerts(): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    
    // First, get all non-notified tracked products
    const nonNotifiedProducts = await db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.notified, false));
    
    // For each non-notified tracked product, check if price is below target
    for (const tp of nonNotifiedProducts) {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, tp.productId));
      
      if (product && product.currentPrice <= tp.targetPrice) {
        result.push({ ...tp, product });
      }
    }
    
    return result;
  }

  async updateTrackedProduct(id: number, updates: Partial<TrackedProduct>): Promise<TrackedProduct | undefined> {
    const [updatedTrackedProduct] = await db
      .update(trackedProducts)
      .set(updates)
      .where(eq(trackedProducts.id, id))
      .returning();
    
    return updatedTrackedProduct;
  }

  async deleteTrackedProduct(id: number): Promise<boolean> {
    const [deletedTrackedProduct] = await db
      .delete(trackedProducts)
      .where(eq(trackedProducts.id, id))
      .returning();
    
    return !!deletedTrackedProduct;
  }

  async getAllTrackedProductsWithDetails(): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    
    const allTrackedProducts = await db.select().from(trackedProducts);
    
    for (const tp of allTrackedProducts) {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, tp.productId));
      
      if (product) {
        result.push({ ...tp, product });
      }
    }
    
    return result;
  }

  async getTrackedProductsWithDetailsByEmail(email: string): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    
    const trackedProductsByEmail = await db
      .select()
      .from(trackedProducts)
      .where(eq(trackedProducts.email, email));
    
    for (const tp of trackedProductsByEmail) {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, tp.productId));
      
      if (product) {
        result.push({ ...tp, product });
      }
    }
    
    return result;
  }

  // Price history operations
  async createPriceHistory(insertPriceHistory: InsertPriceHistory): Promise<PriceHistory> {
    const [priceHistoryRecord] = await db
      .insert(priceHistoryTable)
      .values(insertPriceHistory)
      .returning();
    
    return priceHistoryRecord;
  }

  async getPriceHistoryByProductId(productId: number): Promise<PriceHistory[]> {
    return db
      .select()
      .from(priceHistoryTable)
      .where(eq(priceHistoryTable.productId, productId))
      .orderBy(desc(priceHistoryTable.timestamp));
  }
}

// Export an instance of DatabaseStorage
export const storage = new DatabaseStorage();
