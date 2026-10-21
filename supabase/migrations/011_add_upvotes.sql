-- Migration 010: Create story_upvotes and story_vote_counts tables
-- Supports anonymous voting via unique client_id token with zero-cost Supabase Postgres

CREATE TABLE IF NOT EXISTS story_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_slug TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_story_vote UNIQUE (story_slug, client_id)
);

CREATE INDEX IF NOT EXISTS idx_story_upvotes_slug ON story_upvotes(story_slug);
CREATE INDEX IF NOT EXISTS idx_story_upvotes_client ON story_upvotes(client_id);

-- Aggregate vote counts for sub-millisecond timeline reads
CREATE TABLE IF NOT EXISTS story_vote_counts (
  story_slug TEXT PRIMARY KEY,
  upvote_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_story_vote_counts_count ON story_vote_counts(upvote_count DESC);

-- Enable Row Level Security
ALTER TABLE story_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_vote_counts ENABLE ROW LEVEL SECURITY;

-- Public can read vote counts and votes
CREATE POLICY "Public read story vote counts"
  ON story_vote_counts FOR SELECT
  USING (true);

CREATE POLICY "Public read story upvotes"
  ON story_upvotes FOR SELECT
  USING (true);

CREATE POLICY "Public insert story upvotes"
  ON story_upvotes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public delete story upvotes"
  ON story_upvotes FOR DELETE
  USING (true);

CREATE POLICY "Public upsert story vote counts"
  ON story_vote_counts FOR ALL
  USING (true);

-- Atomic vote toggle function
CREATE OR REPLACE FUNCTION toggle_story_upvote(p_story_slug TEXT, p_client_id TEXT)
RETURNS TABLE (has_voted BOOLEAN, total_votes INT) AS $$
DECLARE
  voted BOOLEAN;
  vote_count INT;
BEGIN
  IF EXISTS (SELECT 1 FROM story_upvotes WHERE story_slug = p_story_slug AND client_id = p_client_id) THEN
    DELETE FROM story_upvotes WHERE story_slug = p_story_slug AND client_id = p_client_id;
    voted := false;
  ELSE
    INSERT INTO story_upvotes (story_slug, client_id) VALUES (p_story_slug, p_client_id)
    ON CONFLICT (story_slug, client_id) DO NOTHING;
    voted := true;
  END IF;

  SELECT COUNT(*)::INT INTO vote_count FROM story_upvotes WHERE story_slug = p_story_slug;

  INSERT INTO story_vote_counts (story_slug, upvote_count, updated_at)
  VALUES (p_story_slug, vote_count, now())
  ON CONFLICT (story_slug) DO UPDATE
    SET upvote_count = vote_count, updated_at = now();

  RETURN QUERY SELECT voted, vote_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent set: retries and double clicks cannot undo a vote.
CREATE OR REPLACE FUNCTION set_story_upvote(p_story_slug TEXT, p_client_id TEXT, p_voted BOOLEAN)
RETURNS TABLE (has_voted BOOLEAN, total_votes INT) AS $$
DECLARE
  vote_count INT;
BEGIN
  IF p_voted THEN
    INSERT INTO story_upvotes (story_slug, client_id) VALUES (p_story_slug, p_client_id)
    ON CONFLICT (story_slug, client_id) DO NOTHING;
  ELSE
    DELETE FROM story_upvotes WHERE story_slug = p_story_slug AND client_id = p_client_id;
  END IF;

  SELECT COUNT(*)::INT INTO vote_count FROM story_upvotes WHERE story_slug = p_story_slug;

  INSERT INTO story_vote_counts (story_slug, upvote_count, updated_at)
  VALUES (p_story_slug, vote_count, now())
  ON CONFLICT (story_slug) DO UPDATE
    SET upvote_count = vote_count, updated_at = now();

  RETURN QUERY SELECT p_voted, vote_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

