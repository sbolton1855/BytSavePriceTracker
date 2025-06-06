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
  id: serial("id").primaryKey().notNull(),
  email: text("email").unique(),
  username: text("username").unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  provider: text("provider"),
  providerId: text("provider_id"),
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
  asin: varchar("asin", { length: 10 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  imageUrl: text("image_url"),
  currentPrice: doublePrecision("current_price").notNull(),
  originalPrice: doublePrecision("original_price"),
  lastChecked: timestamp("last_checked").notNull(),
  lowestPrice: doublePrecision("lowest_price"),
  highestPrice: doublePrecision("highest_price"),
  priceDropped: boolean("price_dropped").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
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
  percentageAlert: boolean("percentage_alert").default(false),
  percentageThreshold: integer("percentage_threshold"),
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
  metadata: jsonb("metadata"),
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
});

// Add validation for tracking form
export const trackingFormSchema = z.object({
  productUrl: z.string().min(1, "Product URL or ASIN is required"),
  productId: z.number().optional(),
  targetPrice: z.number().min(0.01, "Target price must be at least 0.01"),
  percentageAlert: z.boolean().optional().default(false),
  percentageThreshold: z.number().min(1, "Percentage must be at least 1%").max(99, "Percentage must be less than 100%").optional(),
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
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwords do not match",
  path: ["passwordConfirm"],
});

// API registration data (without passwordConfirm)
export const apiRegisterSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
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
export type ApiRegisterFormData = z.infer<typeof apiRegisterSchema>; 
export type LoginFormData = z.infer<typeof loginSchema>;

// Extended Schema with additional data
export type TrackedProductWithDetails = TrackedProduct & {
  product: Product;
};

// Define relations after all tables have been defined
// API Error logging table
export const apiErrors = pgTable("api_errors", {
  id: serial("id").primaryKey(),
  asin: varchar("asin", { length: 20 }),
  errorType: varchar("error_type", { length: 255 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  resolved: boolean("resolved").default(false)
});

export const insertApiErrorSchema = createInsertSchema(apiErrors).omit({
  id: true,
  createdAt: true
});

export type InsertApiError = z.infer<typeof insertApiErrorSchema>;
export type ApiError = typeof apiErrors.$inferSelect;

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

export const apiErrorsRelations = relations(apiErrors, ({ one }) => ({
  product: one(products, {
    fields: [apiErrors.asin],
    references: [products.asin],
  })
}));
