# Phase 3: Editorial RSS Intake

## Delivered

- Supabase-backed RSS/Atom candidate queue with structured XML parsing.
- Authenticated editor sign-in and sign-out at `/editor`.
- Candidate review actions: approve or reject.
- Atomic conversion from an approved candidate into a private story draft.
- Draft editing for headline, summary, significance, source, topic, and event date.
- Canonical URL deduplication and a database unique index to stop repeated imports.
- Feed fetch protections: editor-role check, HTTPS-only public hosts, redirect validation, timeouts, and a 2 MB response limit.
- Supabase RLS policies that require `app_metadata.role = 'editor'` for editorial access.

## Supabase setup required

1. Run migrations `004_create_feed_candidates_table.sql` and `005_finish_feed_editorial_workflow.sql` in order in the Supabase SQL editor.
2. In Supabase Auth, assign the `editor` app-metadata role to each trusted editor account. Do not set this in user-editable metadata.
3. Open `/editor`, sign in, import a public RSS/Atom feed, and review the imported entries.

The importer processes at most 12 new article URLs per submission. Re-importing a feed skips URLs that are already queued. Imported entries remain private; approval creates an editable draft, not a public archive story.

## Phase 4 (publishing workflow)

Delivered in code:

- Atomic `publish_story_draft` and `unpublish_story` SQL functions in migration `005_finish_feed_editorial_workflow.sql` (listed under the `-- Migration 006` comment). Both verify editor role and ownership, flip `stories.status`, set/clear `published_at`, and keep `feed_candidates.status` in sync (`drafted` ↔ `published`).
- `publishEditorDraft` / `unpublishEditorStory` server actions in `src/lib/actions/editor-drafts.ts`, with editor-role checks and revalidation of `/editor`, the draft page, and `/explore`.
- Draft page (`/editor/drafts/[storyId]`) now renders for both draft and published stories, with **Publish to archive** and **Unpublish to draft** actions, status notices, and a link to the public story.
- Editor overview (`/editor`) gained a **Story drafts** section listing the editor's drafts and published stories.
- RLS consolidated to a single `editor_update_own_stories` UPDATE policy so publish/unpublish can set `updated_by` on the caller's own story.

**Run the migration again in the Supabase SQL editor** — migration 005 now also creates the publish/unpublish functions and replaces the UPDATE policies. If you already applied an earlier copy of 005, re-running it is safe (all statements use `CREATE OR REPLACE` / `DROP ... IF EXISTS`).

## Phase 5

Phase 5 can focus on scheduled ingestion and source-health monitoring: pick credible AI news feeds, run imports on a schedule, and surface feed failures. Feeds selected during editorial work can seed that list.
