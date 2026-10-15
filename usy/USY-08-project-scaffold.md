# USY-08 — Project scaffold, tooling & config

**Status:** done

## Goal
Stand up the base app before any feature work.

## What we have
- **Next.js 16 (App Router, Turbopack)** + **React 19**, **TypeScript** (strict).
- **Tailwind CSS v4** wired via `@tailwindcss/turbopack` in `next.config.ts`
  (a custom `*.css` loader rule), plus a large hand-authored `globals.css`.
- `next.config.ts`: `cacheComponents: true` + `partialPrefetching: true`
  (React `use cache` / Suspense streaming model).
- Fonts: `Geist` via `next/font/google` in `layout.tsx`.
- Scripts: `dev`, `build`, `start`, `lint` (ESLint, `eslint-config-next`).
- Path alias `@/*` → `src/*` in `tsconfig.json`.

## Files
`next.config.ts`, `tsconfig.json`, `package.json`, `eslint.config.mjs`,
`src/app/layout.tsx`.
