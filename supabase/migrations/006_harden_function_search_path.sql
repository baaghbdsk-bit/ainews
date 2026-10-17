-- Migration 006: Pin search_path on helper functions
--
-- Why: Supabase's linter flags functions whose `search_path` is mutable
-- (`function_search_path_mutable`). A function that resolves unqualified names
-- against a caller-controlled search_path can be hijacked (a caller creates a
-- same-named object earlier in the path). Pinning an empty search_path forces
-- every reference to be schema-qualified or resolved from pg_catalog.
--
-- Affects the three helpers created by 001/002/004. Bodies are unchanged; only
-- `SET search_path = ''` is added. Safe to run after 001-005. Idempotent.

CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'editor', false);
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.drop_policy_if_exists(tbl regclass, polname name)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', polname, tbl);
END;
$$;
