# signal. — User Stories (USY) tracker

Each file is one "USY" (a unit of work / requirement), named
`USY-<nn>-<slug>.md`. This is the working record of **how we built the
application** — what each part does and what we did, in which USY — so anyone
reading the folder understands the whole app's development.

Convention inside each file:
- **Status** — `proposed` → `in-progress` → `done`
- **Goal** — the user's ask in their words
- **What we have / Findings / Done** — how the codebase actually implements it
- **Files** — paths touched

## How the app is put together (map)

```
src/app/
  page.tsx                 timeline (server): merges feeds + DB + seeds  [USY-14]
  explore-client.tsx       timeline (client): filters, expand, infinite list
  stories.ts               seed anchors 2022–2025 (curated)  [USY-17]
  layout.tsx               root layout, fonts, metadata  [USY-08]
  globals.css              dark "signal." theme + components  [USY-09]
  story/[storyId]/page.tsx story detail  [USY-15]
src/lib/
  schemas/story.ts         Zod story schema + topic enum  [USY-10]
  supabase/*               server/browser/public clients + DB types  [USY-11]
  auth/editor.ts           editor-role check  [USY-11]
  actions/stories.ts       CRUD + cache revalidation  [USY-12]
  feeds/fetch-ai-news.ts   RSS ingestion + enrichment  [USY-13, USY-18]
supabase/migrations/       table, RLS, seed  [USY-11]
```

## Part A — Foundation & architecture (how the app is built)

| ID | Title | Status |
|----|-------|--------|
| [USY-08](USY-08-project-scaffold.md) | Project scaffold, tooling & config | done |
| [USY-09](USY-09-design-system.md) | Design system & dark "signal." theme | done |
| [USY-10](USY-10-data-model.md) | Data model & schema | done |
| [USY-11](USY-11-supabase-backend.md) | Supabase backend (DB, RLS, auth, clients) | done |
| [USY-12](USY-12-story-actions.md) | Story server actions (CRUD + revalidation) | done |
| [USY-13](USY-13-feed-ingestion.md) | RSS/Atom feed ingestion | done |
| [USY-14](USY-14-timeline-page.md) | Timeline page (merge + render) | done |
| [USY-15](USY-15-story-detail-page.md) | Story detail page | done |

## Part B — Recent session (UI reshaping + the current asks)

| ID | Title | Status |
|----|-------|--------|
| [USY-01](USY-01-remove-landing-timeline-only.md) | Remove landing page; timeline is the whole site | done |
| [USY-02](USY-02-topic-tabs-header.md) | Move topics into header tabs next to logo | done |
| [USY-16](USY-16-header-layout.md) | Header & topbar layout (logo + tabs) | done |
| [USY-03](USY-03-timeline-filter-polish.md) | Timeline filter = period + search; fix date cutoff | done |
| [USY-04](USY-04-wordmark-emphasis.md) | Bigger, bolder, highlighted logo | done |
| [USY-05](USY-05-data-coverage-2025.md) | Data coverage: fill the 2025 gap | done |
| [USY-06](USY-06-rich-previews-and-articles.md) | Rich preview (done) + full articles (deferred) | in-progress |

## Part C — Planned (do after remaining issues)

| ID | Title | Status |
|----|-------|--------|
| [USY-07](USY-07-auto-update-pipeline.md) | Automated ingestion / auto-update pipeline | in-progress |
| [USY-17](USY-17-routing-and-nav-consolidation.md) | Routing & navigation consolidation | done |
| [USY-18](USY-18-content-enrichment.md) | Content enrichment (non-generic text) | done |
| [USY-19](USY-19-full-article-pages.md) | Full article pages with official link at end | proposed |
| [USY-20](USY-20-scheduled-ingest-job.md) | Scheduled ingest job (cron) | decided |

> **Deep-dive:** [ANALYSIS-hourly-updates.md](ANALYSIS-hourly-updates.md) — full
> analysis of how to keep the timeline updated every hour (scheduler options,
> data-flow, cost, safety, phased plan).


