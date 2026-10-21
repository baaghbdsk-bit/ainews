-- Migration 015: Close the public PostgREST write path on the vote and feedback tables
--
-- Why: every legitimate write goes through an API route that authenticates
-- with the service role key and enforces a rate limit
-- (src/app/api/upvotes/route.ts, src/app/api/feedback/route.ts). The anon
-- policies below left the same tables writable straight from PostgREST, so
-- anyone holding the public key could:
--   * write story_upvotes rows, bypassing the 30/min limiter;
--   * upsert story_vote_counts, i.e. set any story's displayed upvote total to
--     an arbitrary number (verified: a forged 999999 was served by /api/upvotes);
--   * call the SECURITY DEFINER vote RPCs directly, bypassing the limiter;
--   * insert feedback rows, bypassing the 5/min limiter.
--
-- Reads are left in place: the server-side story actions query these tables
-- with the anon key (src/lib/actions/stories.ts, src/lib/supabase/public.ts),
-- and the public vote counters are meant to be readable.
--
-- The feedback `email` column is additionally revoked at column level, so the
-- reply address is not readable through PostgREST while the rest of the row
-- still is. Idempotent.

-- ── Votes: writes only ever came from the service-role API route ──
DROP POLICY IF EXISTS "Public insert story upvotes" ON public.story_upvotes;
DROP POLICY IF EXISTS "Public delete story upvotes" ON public.story_upvotes;

-- FOR ALL meant write as well as read; the SELECT-only policy above stays.
DROP POLICY IF EXISTS "Public upsert story vote counts" ON public.story_vote_counts;

-- ── Feedback: same, the API route writes with the service role ──
DROP POLICY IF EXISTS "Public insert feedback" ON public.feedback_submissions;
DROP POLICY IF EXISTS "Public read feedback" ON public.feedback_submissions;

-- Supabase grants table-level SELECT to anon/authenticated on every public
-- table, and a table-level grant cannot be narrowed per column: revoking
-- SELECT (email) on its own leaves the column readable. The table is therefore
-- off limits to anon/authenticated altogether. Nothing needs it -
-- src/app/api/feedback is the only reader and writer and it authenticates
-- with the service role - so the reply address is not exposed via PostgREST.
REVOKE ALL ON public.feedback_submissions FROM anon, authenticated;

-- ── Vote RPCs: service role only ──
-- The API route calls these with the service role key, which keeps EXECUTE
-- through the explicit grant below.
REVOKE EXECUTE ON FUNCTION public.set_story_upvote(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_story_upvote(TEXT, TEXT, BOOLEAN) TO service_role;

REVOKE EXECUTE ON FUNCTION public.toggle_story_upvote(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_story_upvote(TEXT, TEXT) TO service_role;
