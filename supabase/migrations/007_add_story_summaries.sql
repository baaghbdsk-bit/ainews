-- Migration 007: Reader-facing summaries and a professional brief
--
-- The timeline card and article page now show a generated "deck" (a short,
-- self-contained summary a reader can get the whole point from without leaving
-- the page), a few key points, and a "why it matters" line, plus an optional
-- professional brief.
--
-- These are produced by the ingest job's summarize pass:
--   * when LLM_API_KEY is set, a grounded LLM (any OpenAI-compatible API)
--     writes them from the stored body, and `llm_model` records which model did;
--   * otherwise a zero-cost extractive fallback fills `deck` and leaves
--     `llm_model` NULL, so the same pass can upgrade the row later for free.
--
-- Safe to run after 001-006. Idempotent.

ALTER TABLE stories ADD COLUMN IF NOT EXISTS deck TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS key_points TEXT[];
ALTER TABLE stories ADD COLUMN IF NOT EXISTS why_it_matters TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS brief TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS llm_model TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS llm_generated_at TIMESTAMPTZ;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS summary_attempts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN stories.deck IS
  'Short reader-facing summary (2-4 sentences). LLM when available, else extractive. Shown when a timeline row is expanded.';
COMMENT ON COLUMN stories.key_points IS
  '3-5 short bullet takeaways for this story (LLM only; empty for the extractive fallback).';
COMMENT ON COLUMN stories.why_it_matters IS
  'LLM-authored significance, distinct from the feed-derived `significance` column.';
COMMENT ON COLUMN stories.brief IS
  'Optional professional brief (grounded prose, attributed) rendered on the story page.';
COMMENT ON COLUMN stories.llm_model IS
  'Model id that generated deck/key_points/why_it_matters/brief. NULL means the extractive fallback produced them.';
COMMENT ON COLUMN stories.llm_generated_at IS
  'When the reader-facing summary was generated.';
COMMENT ON COLUMN stories.summary_attempts IS
  'How many times the summarize pass has tried this row (bounds retries for permanently unavailable sources).';

-- Speeds up the summarize pass: newest published rows that still need a deck.
CREATE INDEX IF NOT EXISTS idx_stories_needs_summary
  ON stories (event_date DESC)
  WHERE status = 'published' AND deck IS NULL;
