-- Migration 011: Create feedback_submissions table
-- Supports anonymous user feedback, categorization, and review

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  comment TEXT NOT NULL,
  client_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback_submissions(category);

-- Enable Row Level Security
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous public submission
CREATE POLICY "Public insert feedback"
  ON feedback_submissions FOR INSERT
  WITH CHECK (true);

-- Service role and public read
CREATE POLICY "Public read feedback"
  ON feedback_submissions FOR SELECT
  USING (true);

