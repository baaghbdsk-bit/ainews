-- Migration 001: Create stories table with proper schema, indexes, and constraints
-- Run this in Supabase SQL Editor after creating your project

-- Create the stories table
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  significance TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN ('Models', 'Products', 'Research', 'Policy')),
  event_date DATE NOT NULL,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries (skip if already exist)
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_topic ON stories(topic);
CREATE INDEX IF NOT EXISTS idx_stories_published_at ON stories(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_stories_event_date ON stories(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories(slug);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at (if not already exists)
DROP TRIGGER IF EXISTS update_stories_updated_at ON stories;
CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE stories IS 'AI news stories with editorial workflow (draft/published)';
COMMENT ON COLUMN stories.id IS 'Primary key UUID';
COMMENT ON COLUMN stories.slug IS 'URL-friendly identifier derived from title';
COMMENT ON COLUMN stories.title IS 'Story headline';
COMMENT ON COLUMN stories.summary IS 'Brief description of the event';
COMMENT ON COLUMN stories.significance IS 'Why this matters / impact analysis';
COMMENT ON COLUMN stories.source IS 'Publication name (e.g., OpenAI Blog)';
COMMENT ON COLUMN stories.source_url IS 'Full URL to original article';
COMMENT ON COLUMN stories.topic IS 'Story category: Models, Products, Research, or Policy';
COMMENT ON COLUMN stories.event_date IS 'When the event occurred (not published date)';
COMMENT ON COLUMN stories.published_at IS 'When story was published (NULL for drafts)';
COMMENT ON COLUMN stories.status IS 'Editorial status: draft or published';
COMMENT ON COLUMN stories.created_by IS 'UUID of user who created the story';
COMMENT ON COLUMN stories.updated_by IS 'UUID of user who last updated the story';
