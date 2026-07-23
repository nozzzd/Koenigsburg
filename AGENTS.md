# Koenigsburg Web Portal agent guide

<!-- BEGIN:nextjs-agent-rules -->
## Next.js guidance

This project uses a newer Next.js version with breaking changes from older releases. Before changing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and follow deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project scope and architecture

- This repository is the Koenigsburg citizenship portal, not the Miku Cafe Discord moderation bot or Neru AI.
- It is a Next.js App Router application using TypeScript, Tailwind CSS, Supabase (PostgreSQL), Discord OAuth and bot APIs, and HMAC-signed HTTP-only sessions.
- `app/` contains routes, layouts, pages, and API handlers; `actions/` contains Server Actions; `components/` contains UI; and `lib/` contains Supabase, session, Discord, and domain helpers.
- `supabase/schema.sql` and the numbered files in `supabase/` define database setup and migrations. `vercel.json` configures the scheduled reminder endpoint.
- The three citizenship paths are Discord-role auto activation, an OAuth-backed application approved by an admin, and a manual application verified through an in-game-code flow. Keep their status and authorization boundaries intact.

## Development and validation

- Install locked dependencies with `npm ci`.
- Use `npm run build` for a production build and `npm run lint` for linting. Report only checks that actually ran.
- `npm run dev` starts the local Next.js development server; `npm start` serves a completed production build.
- TypeScript is strict. Follow the existing code style and keep server-only logic, authorization checks, and external-service calls in their established boundaries.

## Security, privacy, and operations

- Never read, print, copy, summarize, modify, stage, or commit real `.env` contents, tokens, credentials, private keys, cookies, database data, or other secret material. `.env.example` may contain placeholders only.
- Treat citizenship applications, player data, Discord data, and session data as private. Do not expose them in logs, fixtures, reports, or examples.
- Do not deploy, push to `main`, change Discord permissions or bot configuration, alter Vercel settings, or run Supabase schema changes without explicit human approval.
- Preserve local runtime files at their expected paths and keep them ignored.

## Git workflow

- Work directly on `main`. Do NOT create task branches or open pull requests unless the user explicitly asks for one.
- The owner commits and syncs from their own Git client, so leave finished work as uncommitted changes in the `main` working tree. Do not commit or push unless the user explicitly requests it.
- `main` auto-deploys to production via Vercel, so only hand back changes that build cleanly.
- Keep changes focused, inspect the complete diff, and run safe available checks (build/lint/tsc) before handing work back. Report the exact files changed and verification results.
- Only one AI should edit this working tree at a time.

## Source precedence

- Current source, configuration, and recent Git history take precedence over stale notes or imported AI memory.
