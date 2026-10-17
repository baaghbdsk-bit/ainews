-- Migration 005: Store extracted article body per story
--
-- The RSS feeds only carry a short excerpt, so the timeline/article pages were
-- thin. The ingest job now fetches each story's `source_url`, extracts the real
-- article, and stores a condensed plain-text version here. The article page
-- renders it (with the original source linked), so readers get the substance
-- without leaving the site.
--
-- `body` is plain text with blank-line separated paragraphs (never raw HTML),
-- so it can be rendered safely. NULL means "not enriched yet" — the UI falls
-- back to the summary.
--
-- `enrich_attempts` bounds retries: a handful of sources (bot-blocked,
-- client-rendered, paywalled) never extract successfully, and without an
-- attempt counter they would be retried forever and starve newer rows.
--
-- Safe to run after 001-004. Idempotent.

ALTER TABLE stories ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS enrich_attempts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN stories.body IS
  'Extracted article text (plain text, blank-line separated paragraphs) enriched from source_url. NULL until enriched.';
COMMENT ON COLUMN stories.enrich_attempts IS
  'How many times the ingest job has tried to extract a body for this story.';

-- Speeds up the enrichment pass: newest published rows that still need a body
-- and have not exhausted their retry budget.
CREATE INDEX IF NOT EXISTS idx_stories_needs_enrichment
  ON stories (event_date DESC)
  WHERE status = 'published' AND body IS NULL;

-- Optional: see how many are still waiting.
-- SELECT count(*) FROM stories WHERE status = 'published' AND body IS NULL AND enrich_attempts < 3;
