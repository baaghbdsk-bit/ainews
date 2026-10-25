-- Migration 018: Persistent, admin-only review queue for news candidates

CREATE TABLE IF NOT EXISTS news_review_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  publisher TEXT,
  original_url TEXT,
  canonical_url TEXT,
  google_news_url TEXT,
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hold_reason TEXT,
  reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
  validation_status TEXT NOT NULL DEFAULT 'held',
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_reason TEXT,
  duplicate_of_slug TEXT REFERENCES public.stories(slug) ON DELETE SET NULL,
  related_story_slug TEXT REFERENCES public.stories(slug) ON DELETE SET NULL,
  approved_for_publishing BOOLEAN NOT NULL DEFAULT false,
  published_story_slug TEXT REFERENCES public.stories(slug) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_email TEXT,
  reviewed_at TIMESTAMPTZ,
  source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT news_review_candidates_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'deferred', 'duplicate')),
  CONSTRAINT news_review_candidates_validation_status_check
    CHECK (validation_status IN ('validated', 'held', 'failed', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_news_review_status_discovered
  ON news_review_candidates (review_status, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_review_discovered
  ON news_review_candidates (discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_review_publisher
  ON news_review_candidates (publisher);
CREATE INDEX IF NOT EXISTS idx_news_review_headline
  ON news_review_candidates (headline);

ALTER TABLE news_review_candidates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.news_review_candidates FROM anon, authenticated;
