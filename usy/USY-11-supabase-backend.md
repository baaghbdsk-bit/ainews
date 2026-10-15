# USY-11 — Supabase backend (DB, RLS, auth, clients)

**Status:** done

## Goal
Persist editorial stories with row-level security and editor-only writes.

## What we have
- **Migrations** (`supabase/migrations/`):
  - `001_create_stories_table.sql` — `stories` table (topic CHECK, status
    draft/published, event_date DATE, audit columns).
  - `002_enable_rls.sql` — RLS on; public can read `published`; only
    authenticated **editors** can insert/update their own rows.
  - `003_seed_stories.sql` — initial seed load.
- **Clients**:
  - `src/lib/supabase/server.ts` — `createServerClient` via `@supabase/ssr`,
    cookie-aware, for server components/actions.
  - `src/lib/supabase/client.ts` — browser client (anon key).
  - `src/lib/supabase/public.ts` — public/anon client.
- **Auth/role** (`src/lib/auth/editor.ts`): `isEditor()` checks
  `user.app_metadata.role === 'editor'` — gates editorial mutations.
- **Env**: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (`.env.local`, with `.env.local.example`).

## Files
`supabase/migrations/*`, `src/lib/supabase/*`, `src/lib/auth/editor.ts`,
`.env.local.example`.
