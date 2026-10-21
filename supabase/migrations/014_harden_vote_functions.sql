-- Migration 014: Harden the vote RPCs and lock down schema_migrations
--
-- Why: Supabase's linter flags
--   * function_search_path_mutable (WARN)  — the two vote functions from 011
--     resolve unqualified table names against a caller-controlled search_path.
--   * rls_disabled_in_public (ERROR)       — public.schema_migrations is
--     exposed to PostgREST with no RLS.
--
-- This mirrors the pattern established by 006_harden_function_search_path.sql:
-- `SET search_path = ''` plus schema-qualified table names. Function bodies are
-- otherwise byte-for-byte the same as the versions 011 created, so behaviour is
-- unchanged. Idempotent.

-- Vote toggle: idempotent, keeps story_vote_counts in step.
CREATE OR REPLACE FUNCTION public.toggle_story_upvote(p_story_slug TEXT, p_client_id TEXT)
RETURNS TABLE (has_voted BOOLEAN, total_votes INT) AS $$
DECLARE
  voted BOOLEAN;
  vote_count INT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.story_upvotes WHERE story_slug = p_story_slug AND client_id = p_client_id) THEN
    DELETE FROM public.story_upvotes WHERE story_slug = p_story_slug AND client_id = p_client_id;
    voted := false;
  ELSE
    INSERT INTO public.story_upvotes (story_slug, client_id) VALUES (p_story_slug, p_client_id)
    ON CONFLICT (story_slug, client_id) DO NOTHING;
    voted := true;
  END IF;

  SELECT COUNT(*)::INT INTO vote_count FROM public.story_upvotes WHERE story_slug = p_story_slug;

  INSERT INTO public.story_vote_counts (story_slug, upvote_count, updated_at)
  VALUES (p_story_slug, vote_count, now())
  ON CONFLICT (story_slug) DO UPDATE
    SET upvote_count = vote_count, updated_at = now();

  RETURN QUERY SELECT voted, vote_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Idempotent setter: forces the vote to a known state instead of toggling.
CREATE OR REPLACE FUNCTION public.set_story_upvote(p_story_slug TEXT, p_client_id TEXT, p_voted BOOLEAN)
RETURNS TABLE (has_voted BOOLEAN, total_votes INT) AS $$
DECLARE
  vote_count INT;
BEGIN
  IF p_voted THEN
    INSERT INTO public.story_upvotes (story_slug, client_id) VALUES (p_story_slug, p_client_id)
    ON CONFLICT (story_slug, client_id) DO NOTHING;
  ELSE
    DELETE FROM public.story_upvotes WHERE story_slug = p_story_slug AND client_id = p_client_id;
  END IF;

  SELECT COUNT(*)::INT INTO vote_count FROM public.story_upvotes WHERE story_slug = p_story_slug;

  INSERT INTO public.story_vote_counts (story_slug, upvote_count, updated_at)
  VALUES (p_story_slug, vote_count, now())
  ON CONFLICT (story_slug) DO UPDATE
    SET upvote_count = vote_count, updated_at = now();

  RETURN QUERY SELECT p_voted, vote_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Lock the migration ledger down. The table owner (the role behind
-- DATABASE_URL, used by scripts/migrate.mjs) bypasses RLS, so the migration
-- tool keeps working; anon/authenticated lose PostgREST access to it.
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
