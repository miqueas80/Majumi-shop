-- Adds optional, public HTTPS product image URL without touching orders or stock.
ALTER TABLE products ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
