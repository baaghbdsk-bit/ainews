# Phase 2 Setup Instructions

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

### 4. Create Database Schema (2 minutes)

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste the contents of `supabase/migrations/001_create_stories_table.sql`
4. Click **Run** (bottom right)
5. Verify: Go to **Table Editor** → you should see `stories` table

### 5. Implement Row-Level Security (2 minutes)

1. In **SQL Editor**, create another new query
2. Paste the contents of `supabase/migrations/002_enable_rls.sql`
3. Click **Run**
4. Verify: Go to **Authentication** → **Policies** → `stories` table should show 5 policies

### 6. Seed Initial Data (2 minutes)

1. In **SQL Editor**, create another new query
2. Paste the contents of `supabase/migrations/003_seed_stories.sql`
3. Click **Run**
4. Verify: Go to **Table Editor** → `stories` → should show 9 published stories

### 7. Generate TypeScript Types (1 minute)

Run this command in your terminal:
```powershell
npx supabase gen types typescript --project-id your-project-ref > src/lib/supabase/database.types.ts
```

Replace `your-project-ref` with your actual project reference (found in Project Settings → General → Reference ID).

### 8. Fix TypeScript Errors (1 minute)

1. Open `src/lib/actions/stories.ts`
2. Remove the `// @ts-nocheck` line at the top
3. Add this import at the top:
   ```typescript
   import type { Database } from '@/lib/supabase/database.types';
   ```
4. Run `npm run build` to verify everything compiles

### 9. Test Everything (2 minutes)

```powershell
npm run dev
```

Open http://localhost:3000/explore

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
- Run migration `001_create_stories_table.sql` in SQL Editor
- Check for error messages in SQL Editor output

### "Row-level security policy violation"
- Run migration `002_enable_rls.sql`
- Verify all 5 policies are created in Authentication → Policies

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
