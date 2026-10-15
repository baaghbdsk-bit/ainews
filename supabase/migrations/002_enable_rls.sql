-- Migration 002: Enable Row-Level Security and create policies
-- Run this in Supabase SQL Editor after creating the stories table

-- Enable Row-Level Security on the stories table (skip if already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'stories' AND rowsecurity = true
  ) THEN
    ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Helper function to drop policy if exists (PostgreSQL 15+)
CREATE OR REPLACE FUNCTION drop_policy_if_exists(tbl regclass, polname name)
RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', polname, tbl);
END;
$$ LANGUAGE plpgsql;

-- Policy 1: Allow public to read published stories
-- Anyone can view stories with status='published'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'public_read_published') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO public USING (status = %L)', 'public_read_published', 'stories', 'published');
  END IF;
END $$;

-- Policy 2: Allow authenticated users to read their own stories (any status)
-- Editors can see their own drafts and published stories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'authenticated_read_own') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (auth.uid() = %I)', 'authenticated_read_own', 'stories', 'created_by');
  END IF;
END $$;

-- Policy 3: Allow authenticated users to create stories
-- Any authenticated user can create new stories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'authenticated_create') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth.uid() = %I)', 'authenticated_create', 'stories', 'created_by');
  END IF;
END $$;

-- Policy 4: Allow authenticated users to update their own stories
-- Editors can only update stories they created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'authenticated_update_own') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth.uid() = %I) WITH CHECK (auth.uid() = %I)', 'authenticated_update_own', 'stories', 'created_by', 'updated_by');
  END IF;
END $$;

-- Policy 5: Allow authenticated users to delete their own draft stories
-- Editors can only delete their own drafts (not published stories)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'authenticated_delete_own_draft') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth.uid() = %I AND status = %L)', 'authenticated_delete_own_draft', 'stories', 'created_by', 'draft');
  END IF;
END $$;

-- Verify policies are enabled
-- Run this to check:
-- SELECT * FROM pg_policies WHERE tablename = 'stories';
