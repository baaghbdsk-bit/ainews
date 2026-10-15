# Phase 2 Setup Guide

## Prerequisites

1. **Supabase Account**
   - Create a free project at https://supabase.com
   - Note your project URL and anon key

2. **Environment Variables**
   - Copy `.env.local.example` to `.env.local`
   - Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Schema

Create a `stories` table in Supabase SQL Editor with:

```sql
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  significance TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN ('Models', 'Products', 'Research', 'Policy')),
  event_date DATE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_topic ON stories(topic);
CREATE INDEX idx_stories_published_at ON stories(published_at DESC);
CREATE INDEX idx_stories_event_date ON stories(event_date DESC);
CREATE INDEX idx_stories_slug ON stories(slug);

-- Enable RLS
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public reads only published stories
CREATE POLICY "public_read_published" ON stories
  FOR SELECT
  USING (status = 'published');

-- RLS Policy: Authenticated users can read all their own stories
CREATE POLICY "authenticated_read_own" ON stories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = updated_by);

-- RLS Policy: Authenticated users can create stories
CREATE POLICY "authenticated_create" ON stories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Authenticated users can update their own stories
CREATE POLICY "authenticated_update_own" ON stories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = updated_by OR auth.uid() = created_by)
  WITH CHECK (auth.uid() = updated_by);

-- RLS Policy: Authenticated users can delete their own drafts
CREATE POLICY "authenticated_delete_own_draft" ON stories
  FOR DELETE
  TO authenticated
  USING ((auth.uid() = created_by OR auth.uid() = updated_by) AND status = 'draft');
```

## Seed Initial Data

Copy the 9 existing stories into Postgres using the Supabase SQL Editor:

```sql
INSERT INTO stories (slug, title, summary, significance, source, source_url, topic, event_date, published_at, status, created_by, updated_by) VALUES
('chatgpt-launch', 'ChatGPT Released', 'OpenAI launches ChatGPT to public access.', 'Sparked the mainstream AI revolution.', 'OpenAI Blog', 'https://openai.com', 'Products', '2022-11-30', NOW(), 'published', auth.uid(), auth.uid()),
... (add remaining 8 stories)
```

## Next Steps

1. Update `/explore` page to call `getPublishedStories()`
2. Update `/explore/[storyId]` to call `getStoryBySlug()`
3. Create `/editor` route for story management
4. Add auth middleware
5. Deploy to production
