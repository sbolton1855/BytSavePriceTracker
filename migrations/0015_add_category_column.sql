
-- Add category column to products table
ALTER TABLE products ADD COLUMN category TEXT;

-- Add index for better query performance
CREATE INDEX idx_products_category ON products(category);

-- Update existing discovered products with default categories based on keywords
UPDATE products 
SET category = 'health' 
WHERE isDiscovered = true 
  AND (
    title ILIKE '%vitamin%' OR 
    title ILIKE '%supplement%' OR 
    title ILIKE '%beauty%' OR 
    title ILIKE '%skincare%' OR 
    title ILIKE '%hair%' OR 
    title ILIKE '%nail%' OR 
    title ILIKE '%makeup%'
  );

UPDATE products 
SET category = 'tech' 
WHERE isDiscovered = true 
  AND category IS NULL
  AND (
    title ILIKE '%bluetooth%' OR 
    title ILIKE '%wireless%' OR 
    title ILIKE '%headphones%' OR 
    title ILIKE '%charger%' OR 
    title ILIKE '%gadget%' OR 
    title ILIKE '%electronic%' OR 
    title ILIKE '%smart%'
  );

UPDATE products 
SET category = 'seasonal' 
WHERE isDiscovered = true 
  AND category IS NULL
  AND (
    title ILIKE '%winter%' OR 
    title ILIKE '%summer%' OR 
    title ILIKE '%holiday%' OR 
    title ILIKE '%christmas%' OR 
    title ILIKE '%outdoor%' OR 
    title ILIKE '%garden%'
  );

-- Set remaining NULL categories to 'seasonal' as default
UPDATE products 
SET category = 'seasonal' 
WHERE isDiscovered = true 
  AND category IS NULL;
