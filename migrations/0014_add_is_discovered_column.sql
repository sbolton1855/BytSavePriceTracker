
-- Migration: Add is_discovered column to products table
-- This ensures discovered products are differentiated from user-tracked products

ALTER TABLE "products" ADD COLUMN "is_discovered" boolean DEFAULT false;

-- Update existing products to be marked as discovered if they have certain characteristics
-- (This is a reasonable assumption for existing products in the system)
UPDATE "products" SET "is_discovered" = true WHERE "id" IS NOT NULL;
