# 🚀 Quick Start: Connect to Supabase (15 minutes)

## You're Here → Database Connected in 9 Steps

### Step 1: Create Supabase Project (5 min)
```
1. Go to: https://supabase.com
2. Sign up / Log in
3. Click "New Project"
4. Fill in:
   - Name: ai-news
   - Password: (generate & save it)
   - Region: (closest to you)
5. Wait ~2 minutes for provisioning
```

### Step 2: Get Credentials (1 min)
```
1. In dashboard: Settings → API
2. Copy these 2 values:
   - Project URL (e.g., https://xyz.supabase.co)
   - anon public key (very long, starts with eyJ...)
```

### Step 3: Configure Environment (1 min)
```powershell
# In your terminal:
cd D:\AiNews
Copy-Item .env.local.example .env.local
notepad .env.local

# Paste your credentials, save, close
```

### Step 4: Create Database (2 min)
```
1. Supabase dashboard → SQL Editor
2. New Query
3. Copy/paste: supabase/migrations/001_create_stories_table.sql
4. Click "Run"
```

### Step 5: Enable Security (2 min)
```
1. SQL Editor → New Query
2. Copy/paste: supabase/migrations/002_enable_rls.sql
3. Click "Run"
```

### Step 6: Add Stories (2 min)
```
1. SQL Editor → New Query
2. Copy/paste: supabase/migrations/003_seed_stories.sql
3. Click "Run"
4. Verify: Table Editor → stories (should see 9 rows)
```

### Step 7: Generate Types (1 min)
```powershell
# Find your project reference ID:
# Dashboard → Settings → General → Reference ID (e.g., "abcdefghijklmnop")

npx supabase gen types typescript --project-id YOUR-REF-ID > src/lib/supabase/database.types.ts
```

### Step 8: Fix TypeScript (1 min)
```typescript
// Open: src/lib/actions/stories.ts
// Line 1: Remove this line:
// @ts-nocheck

// Line 2: Add this import:
import type { Database } from '@/lib/supabase/database.types';

// Save file
```

### Step 9: Test It! (1 min)
```powershell
npm run dev
# Open: http://localhost:3000/explore
# Should see 9 stories loading from database
# Check console: No "Supabase unavailable" warnings
```

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] Dev server runs without errors
- [ ] `/explore` shows 9 stories
- [ ] Click a story → detail page loads
- [ ] Console shows no "Supabase unavailable" warnings
- [ ] `npm run build` passes without TypeScript errors

---

## 🐛 Quick Troubleshooting

**"Invalid API key"**
→ Double-check `.env.local` matches dashboard exactly
→ Restart dev server: Ctrl+C, then `npm run dev`

**"Table does not exist"**
→ Run migration 001 again in SQL Editor
→ Check for error messages in SQL output

**"Permission denied"**
→ Run migration 002 (RLS policies)
→ Verify 5 policies exist: Authentication → Policies → stories

**TypeScript errors**
→ Make sure `database.types.ts` file exists
→ Check import path is correct
→ Run `npm run build` to see specific errors

---

## 📁 Files Created for You

All ready to use:

```
D:\AiNews\
├── SETUP_INSTRUCTIONS.md      ← Detailed walkthrough
├── QUICK_START.md              ← This file
├── .env.local.example          ← Template with instructions
└── supabase/migrations/
    ├── 001_create_stories_table.sql  ← Database schema
    ├── 002_enable_rls.sql            ← Security policies
    └── 003_seed_stories.sql          ← 9 initial stories
```

---

## 🎯 What's Next?

Once database is connected:

1. **Editor UI** - Build admin interface at `/editor`
2. **Authentication** - Add Supabase Auth for login
3. **Publishing Flow** - Draft → Review → Publish workflow
4. **RSS Automation** - Ingest news candidates (Phase 3)

Everything else is already built and working! 🎉
