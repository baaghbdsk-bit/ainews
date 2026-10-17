# Quick Start: Connect to Supabase (~10 minutes)

## Step 1: Create a Supabase project (5 min)
1. Go to https://supabase.com, sign up / log in.
2. **New Project** → name it `ai-news`, set a **database password** (save it), pick the closest region.
3. Wait ~2 minutes for provisioning.

## Step 2: Collect credentials (2 min)
From **Project Settings → API**:
- **Project URL** (e.g. `https://xyz.supabase.co`)
- **anon public** key (starts with `eyJ…`)
- **service_role** key (reveal it — keep this one secret)

From **Connect** (top bar) → **Connection string** → **URI** (use **Session pooler** or **Direct connection**):
- the Postgres URI, with your database password filled in

## Step 3: Configure environment (1 min)
```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```
Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
CRON_SECRET=<any long random string>
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

## Step 4: Apply migrations (1 min)
```powershell
npm run db:migrate
```
This creates the `stories` table, enables RLS (public read, editor-only writes),
seeds the initial stories, and adds the `body` column used for extracted
articles. It records what it applied, so it's safe to re-run.

> No SQL Editor copy/paste. On GitHub, add `DATABASE_URL` as a repository secret
> and `.github/workflows/migrate.yml` applies new migrations automatically on push.

## Step 5: Run it (1 min)
```powershell
npm run dev
# Open http://localhost:3000
```
You should see the timeline (DB stories + live feeds + seed anchors).

---

## Success checklist

- [ ] Dev server runs without errors
- [ ] `/` shows the timeline
- [ ] Clicking a story opens its detail page
- [ ] `npm run db:migrate` reports the database is up to date on a second run
- [ ] `npm run typecheck` and `npm run build` pass

---

## Troubleshooting

**"Invalid API key"**
→ Recheck `.env.local` against the dashboard, then restart: Ctrl+C, `npm run dev`.

**"Table does not exist" / "Permission denied"**
→ Run `npm run db:migrate` (it applies 001–006). If it fails, the error names the file.

**`DATABASE_URL is not set`**
→ Add the connection string (Step 3). Prefer the Session pooler URI.

**TypeScript errors**
→ Run `npm run typecheck` to see specifics.

---

## What's next

1. Set `INGEST_URL` + `DATABASE_URL` as GitHub secrets to enable the scheduled
   ingest and automatic migrations.
2. Optional editor UI at `/editor` (editor-role auth is already enforced by RLS).
