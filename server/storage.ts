import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  trackedProducts, type TrackedProduct, type InsertTrackedProduct,
  priceHistory, type PriceHistory, type InsertPriceHistory
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private trackedProducts: Map<number, TrackedProduct>;
  private priceHistory: Map<number, PriceHistory>;

  private userId: number;
  private productId: number;
  private trackedProductId: number;
  private priceHistoryId: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.trackedProducts = new Map();
    this.priceHistory = new Map();

    this.userId = 1;
    this.productId = 1;
    this.trackedProductId = 1;
    this.priceHistoryId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Product operations
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.productId++;
    const product: Product = { ...insertProduct, id };
    this.products.set(id, product);
    return product;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductByAsin(asin: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(
      (product) => product.asin === asin,
    );
  }

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updatedProduct = { ...product, ...updates };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  // Tracked product operations
  async createTrackedProduct(insertTrackedProduct: InsertTrackedProduct): Promise<TrackedProduct> {
    const id = this.trackedProductId++;
    const trackedProduct: TrackedProduct = { ...insertTrackedProduct, id, notified: false };
    this.trackedProducts.set(id, trackedProduct);
    return trackedProduct;
  }

  async getTrackedProduct(id: number): Promise<TrackedProduct | undefined> {
    return this.trackedProducts.get(id);
  }

  async getTrackedProductsByUserId(userId: number): Promise<TrackedProduct[]> {
    return Array.from(this.trackedProducts.values()).filter(
      (tp) => tp.userId === userId,
    );
  }

  async getTrackedProductsByEmail(email: string): Promise<TrackedProduct[]> {
    return Array.from(this.trackedProducts.values()).filter(
      (tp) => tp.email === email,
    );
  }

  async getTrackedProductByUserAndProduct(userId: number | null, email: string, productId: number): Promise<TrackedProduct | undefined> {
    return Array.from(this.trackedProducts.values()).find(
      (tp) => {
        if (userId !== null) {
          return tp.userId === userId && tp.productId === productId;
        } else {
          return tp.email === email && tp.productId === productId;
        }
      }
    );
  }

  async getTrackedProductsNeedingAlerts(): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    
    for (const tp of this.trackedProducts.values()) {
      const product = this.products.get(tp.productId);
      if (!product) continue;
      
      if (!tp.notified && product.currentPrice <= tp.targetPrice) {
        result.push({ ...tp, product });
      }
    }
    
    return result;
  }

  async updateTrackedProduct(id: number, updates: Partial<TrackedProduct>): Promise<TrackedProduct | undefined> {
    const trackedProduct = this.trackedProducts.get(id);
    if (!trackedProduct) return undefined;

    const updatedTrackedProduct = { ...trackedProduct, ...updates };
    this.trackedProducts.set(id, updatedTrackedProduct);
    return updatedTrackedProduct;
  }

  async deleteTrackedProduct(id: number): Promise<boolean> {
    return this.trackedProducts.delete(id);
  }

  async getAllTrackedProductsWithDetails(): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    
    for (const tp of this.trackedProducts.values()) {
      const product = this.products.get(tp.productId);
      if (product) {
        result.push({ ...tp, product });
      }
    }
    
    return result;
  }

  async getTrackedProductsWithDetailsByEmail(email: string): Promise<(TrackedProduct & { product: Product })[]> {
    const result: (TrackedProduct & { product: Product })[] = [];
    
    for (const tp of this.trackedProducts.values()) {
      if (tp.email === email) {
        const product = this.products.get(tp.productId);
        if (product) {
          result.push({ ...tp, product });
        }
      }
    }
    
    return result;
  }

  // Price history operations
  async createPriceHistory(insertPriceHistory: InsertPriceHistory): Promise<PriceHistory> {
    const id = this.priceHistoryId++;
    const priceHistory: PriceHistory = { ...insertPriceHistory, id };
    this.priceHistory.set(id, priceHistory);
    return priceHistory;
  }

  async getPriceHistoryByProductId(productId: number): Promise<PriceHistory[]> {
    return Array.from(this.priceHistory.values())
      .filter((ph) => ph.productId === productId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

export const storage = new MemStorage();
