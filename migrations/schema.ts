import { pgTable, serial, integer, doublePrecision, timestamp, text, boolean, unique, index, varchar, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const priceHistory = pgTable("price_history", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id").notNull(),
	price: doublePrecision().notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
});

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	asin: text().notNull(),
	title: text().notNull(),
	url: text().notNull(),
	imageUrl: text("image_url"),
	currentPrice: doublePrecision("current_price").notNull(),
	originalPrice: doublePrecision("original_price"),
	lastChecked: timestamp("last_checked", { mode: 'string' }).notNull(),
	lowestPrice: doublePrecision("lowest_price"),
	highestPrice: doublePrecision("highest_price"),
});

export const trackedProducts = pgTable("tracked_products", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	email: text().notNull(),
	productId: integer("product_id").notNull(),
	targetPrice: doublePrecision("target_price").notNull(),
	notified: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text(),
	password: text(),
	email: text().notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	profileImageUrl: text("profile_image_url"),
	provider: text(),
	providerId: text("provider_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);
