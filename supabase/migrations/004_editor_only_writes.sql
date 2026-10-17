-- Migration 004: Restrict all writes to editors
--
-- Why: migration 002 granted INSERT/UPDATE/DELETE to *any* authenticated user
-- (`TO authenticated`), which is broader than the intended model — the public
-- site is read-only and only editors should ever be able to change a story.
-- Migration 002's UPDATE policy also required `updated_by = auth.uid()` in the
-- WITH CHECK, so a legitimate update that forgot to set `updated_by` would
-- silently fail.
--
-- This migration makes the policies match the app: anyone may read published
-- stories, and only users whose `app_metadata.role` is `editor` may read
-- everything or write. Because no editor accounts exist yet, nobody can edit —
-- which is exactly the current intended behaviour. The background ingest job
-- uses the service-role key and bypasses RLS, so it is unaffected.
--
-- Safe to run after 001-003. Idempotent.

-- Helper: is the caller an editor? Reads the role claim from the JWT, matching
-- `isEditor()` in src/lib/auth/editor.ts (app_metadata.role === 'editor').
CREATE OR REPLACE FUNCTION is_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'editor', false);
$$;

-- Retire the over-broad policies from migration 002.
DROP POLICY IF EXISTS authenticated_read_own ON stories;
DROP POLICY IF EXISTS authenticated_create ON stories;
DROP POLICY IF EXISTS authenticated_update_own ON stories;
DROP POLICY IF EXISTS authenticated_delete_own_draft ON stories;

-- Editors can read every story, including drafts.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'editors_read_all') THEN
    CREATE POLICY editors_read_all ON stories FOR SELECT TO authenticated USING (is_editor());
  END IF;
END $$;

-- Editors can create stories.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'editors_insert') THEN
    CREATE POLICY editors_insert ON stories FOR INSERT TO authenticated WITH CHECK (is_editor());
  END IF;
END $$;

-- Editors can update any story. No `updated_by` requirement: the app sets it,
-- but the policy should not fail silently when it is absent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'editors_update') THEN
    CREATE POLICY editors_update ON stories FOR UPDATE TO authenticated USING (is_editor()) WITH CHECK (is_editor());
  END IF;
END $$;

-- Editors can delete any story.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'editors_delete') THEN
    CREATE POLICY editors_delete ON stories FOR DELETE TO authenticated USING (is_editor());
  END IF;
END $$;

-- Verify:
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'stories';
