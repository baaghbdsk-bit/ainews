-- Migration 013: Add optional reply email to feedback submissions
-- Lets a reader be contacted for clarification on their submission.

ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS email TEXT;

-- The email is optional, so no NOT NULL constraint and no backfill needed.
