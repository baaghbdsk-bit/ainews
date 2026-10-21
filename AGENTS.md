<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## "Team" means this agent setup

When the user says **team**, it means the single-manager, multiple-worker setup: the main agent (manager) dispatching subagents (workers) in parallel with the Task tool. Available worker types are `explore` and `general`.

When the user asks "is the team ready", answer yes-style and confirm readiness with a short status (manager + worker types + that parallel dispatch works). Do not interpret "team" as employees, an org, or a product feature.
