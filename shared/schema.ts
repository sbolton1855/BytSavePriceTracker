import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => {
    return {
      expireIdx: index("IDX_session_expire").on(table.expire),
    };
  }
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type UpsertUser = typeof users.$inferInsert;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  asin: text("asin").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  imageUrl: text("image_url"),
  currentPrice: doublePrecision("current_price").notNull(),
  originalPrice: doublePrecision("original_price"),
  lastChecked: timestamp("last_checked").notNull(),
  lowestPrice: doublePrecision("lowest_price"),
  highestPrice: doublePrecision("highest_price"),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export const trackedProducts = pgTable("tracked_products", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  email: text("email").notNull(),
  productId: integer("product_id").notNull(),
  targetPrice: doublePrecision("target_price").notNull(),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").notNull(),
});

export const insertTrackedProductSchema = createInsertSchema(trackedProducts).omit({
  id: true,
  notified: true,
});

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  price: doublePrecision("price").notNull(),
  timestamp: timestamp("timestamp").notNull(),
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
});

// Add validation for tracking form
export const trackingFormSchema = z.object({
  productUrl: z.string().min(1, "Product URL or ASIN is required"),
  targetPrice: z.number().min(0.01, "Target price must be at least 0.01"),
  email: z.string().email("Please enter a valid email address"),
});

// Registration form schema with validation
export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  passwordConfirm: z.string().min(1, "Please confirm your password"),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwords do not match",
  path: ["passwordConfirm"],
});

// Login form schema
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type User = typeof users.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertTrackedProduct = z.infer<typeof insertTrackedProductSchema>;
export type TrackedProduct = typeof trackedProducts.$inferSelect;

export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;

export type TrackingFormData = z.infer<typeof trackingFormSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;

// Extended Schema with additional data
export type TrackedProductWithDetails = TrackedProduct & {
  product: Product;
};

// Define relations after all tables have been defined
export const usersRelations = relations(users, ({ many }) => ({
  trackedProducts: many(trackedProducts),
}));

export const productsRelations = relations(products, ({ many }) => ({
  trackedProducts: many(trackedProducts),
  priceHistory: many(priceHistory),
}));

export const trackedProductsRelations = relations(trackedProducts, ({ one }) => ({
  user: one(users, {
    fields: [trackedProducts.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [trackedProducts.productId],
    references: [products.id],
  }),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  product: one(products, {
    fields: [priceHistory.productId],
    references: [products.id],
  }),
}));
