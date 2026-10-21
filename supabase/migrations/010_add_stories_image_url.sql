-- Migration 010: Add image_url column to stories table
-- Stores the lead image URL for each story (optional, nullable)
ALTER TABLE stories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment describing the column
COMMENT ON COLUMN stories.image_url IS 'URL of the story lead image (optional)';