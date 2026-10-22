-- Migration 016: Saved stories for signed-in readers
--
-- Why: a reader who creates an account expects their saved stories to follow
-- them to another device. Guests keep theirs in the browser, so this table
-- only ever holds an account's own copies.
--
-- The row level security policies are the only thing standing between one
-- reader's saved stories and another's, so they are written explicitly:
-- a row is visible and writable only by the account that owns it.

CREATE TABLE IF NOT EXISTS story_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_slug TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_story_bookmark UNIQUE (story_slug, user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_bookmarks_user ON story_bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_story_bookmarks_slug ON story_bookmarks (story_slug);

ALTER TABLE story_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Readers read own bookmarks" ON story_bookmarks;
DROP POLICY IF EXISTS "Readers add own bookmarks" ON story_bookmarks;
DROP POLICY IF EXISTS "Readers remove own bookmarks" ON story_bookmarks;

CREATE POLICY "Readers read own bookmarks"
  ON story_bookmarks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Readers add own bookmarks"
  ON story_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Readers remove own bookmarks"
  ON story_bookmarks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
