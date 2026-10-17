# Phase 2 Setup Instructions

> **Historical note:** this is the original Phase 2 walkthrough. For the current,
> canonical setup steps see [`QUICK_START.md`](./QUICK_START.md). Migrations are now
> applied with `npm run db:migrate` instead of copy/pasting SQL by hand.

## What's Already Done ✅

- ✅ Supabase client libraries installed (`@supabase/supabase-js`, `@supabase/ssr`)
- ✅ TypeScript types defined for stories table
- ✅ Zod validation schemas created
- ✅ 8 server actions implemented (CRUD + publish/unpublish)
- ✅ Archive and detail pages refactored for database integration
- ✅ Production build verified passing
- ✅ Graceful fallback to seed data when Supabase unavailable

## What You Need to Do Manually

### 1. Create Supabase Account & Project (5 minutes)

1. Go to https://supabase.com
2. Sign up or log in
3. Create a new project:
   - **Project name**: ai-news (or your choice)
   - **Database password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing plan**: Free tier is perfect for now

4. Wait for project to finish setting up (~2 minutes)

### 2. Get Your Credentials (1 minute)

Once your project is ready:

1. Go to **Project Settings** → **API**
2. Copy these two values:
   - **Project URL** (e.g., `https://abcdefghijklmnop.supabase.co`)
   - **anon/public key** (starts with `eyJ...`, very long)

### 3. Configure Environment Variables (1 minute)

1. Copy `.env.local.example` to `.env.local`:
   ```powershell
   Copy-Item .env.local.example .env.local
   ```

2. Edit `.env.local` and paste your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-very-long-key
   ```

### 4. Apply Migrations (1 minute)

Add your `DATABASE_URL` (Project Settings → Database → Connection string) to
`.env.local`, then run:

```powershell
npm run db:migrate
```

This applies every file in `supabase/migrations/` in order — schema, RLS, seed,
editor-only writes, article body, search_path hardening — and records them in
`public.schema_migrations`, so re-running is a no-op. No SQL Editor copy/paste.

Verify: **Table Editor** → `stories` shows the 9 published seed rows;
**Authentication** → **Policies** lists the RLS policies.

### 5. Generate TypeScript Types (1 minute)

Run this command in your terminal:
```powershell
npx supabase gen types typescript --project-id your-project-ref > src/lib/supabase/types.ts
```

Replace `your-project-ref` with your actual project reference (found in Project Settings → General → Reference ID).

### 6. TypeScript Types (1 minute)

`src/lib/supabase/types.ts` is hand-written and already matches the schema.
`src/lib/supabase/database.types.ts` simply re-exports `Database` from it for
backwards compatibility, so most projects can skip this step. If you regenerated
`types.ts` above, just run `npm run typecheck` to confirm everything compiles.

### 7. Test Everything (2 minutes)

```powershell
npm run dev
```

Open http://localhost:3000

- ✅ Should see 9 stories from database (not seed data)
- ✅ Click a story → detail page loads from database
- ✅ Search and filtering still work
- ✅ No console errors

## Total Time: ~15-20 minutes

## Troubleshooting

### "Invalid API key" or connection errors
- Double-check your `.env.local` credentials match exactly
- Restart dev server after changing `.env.local`
- Verify project URL doesn't have trailing slash

### "Table 'stories' does not exist"
- Run `npm run db:migrate` (applies `001_create_stories_table.sql` first)

### "Row-level security policy violation"
- Run `npm run db:migrate` (applies `002_enable_rls.sql`)
- Verify policies exist in Authentication → Policies

### Build still fails with TypeScript errors
- Make sure you ran `npx supabase gen types`
- Check that `database.types.ts` was created
- Verify import path in `stories.ts` is correct

### Still seeing "Supabase unavailable" in logs
- Check `.env.local` file exists and has correct values
- Restart dev server
- Check browser console for detailed error messages

## Next Steps After Setup

Once everything is working:

1. **Create /editor route** - Admin UI for creating/editing stories
2. **Add authentication** - Supabase Auth for editor login
3. **Build publishing workflow** - Draft → Review → Publish flow
4. **Add RSS ingestion** - Automated story candidate queue (Phase 3)

All infrastructure is ready. The 9 seed stories are formatted for you in the migration file.
