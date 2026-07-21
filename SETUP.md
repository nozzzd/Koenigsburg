# Königsburg Web Portal — Setup Guide

Follow these steps once, in order. At the end you'll have the portal running
locally and deployed on Vercel.

> **Golden rule:** real keys and tokens only ever go into `.env.local` (local)
> or the Vercel dashboard (production). They must never appear in a committed
> file. `.gitignore` already excludes `.env*` (except `.env.example`).

---

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com) (or use your existing one).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. Then run each
   numbered migration in `supabase/` (`002_…` through `011_…`) the same way —
   they're idempotent, so re-running is safe.
   - **Community map:** [`supabase/010_map_tiles.sql`](supabase/010_map_tiles.sql)
     creates the `map_tiles` table **and** a public-read Storage bucket named
     `map-tiles` that holds the crowd-sourced world-map tiles. If your Supabase
     project blocks `insert into storage.buckets`, create the bucket manually in
     **Storage → New bucket** (name `map-tiles`, **Public** on). The `/map` page
     stays on its empty "being surveyed" state until the first tile is uploaded.
     The in-browser renderer's block/biome color tables
     ([`lib/xaero/colors.json`](lib/xaero/colors.json)) are pre-generated —
     rerun `python scripts/generate-xaero-colors.py` after a Minecraft update
     adds new blocks or biomes.
   - **Inventory ledger:** [`supabase/011_inventory.sql`](supabase/011_inventory.sql)
     creates the QMSync sources, containers, item counts, and the race-safe
     database functions used by `/inventory` and `/api/inventory/sync`.
     Configure the three `QMSYNC_*` values from `.env.example`; the exact v1
     request contract is documented in [`QMSYNC.md`](QMSYNC.md).
3. Collect two values for later:
   - **Project URL** → `SUPABASE_URL` (Project Settings → Data API)
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys).
     This key bypasses row security — treat it like a root password.

## 2. Discord application (OAuth + bot)

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   and create an application (e.g. "Königsburg Portal").
2. **General Information tab:**
   - Copy the **Public Key** → `DISCORD_PUBLIC_KEY` (verifies `/verify` slash-command requests)
   - Set **Interactions Endpoint URL** to
     `https://YOUR-VERCEL-DOMAIN/api/discord/interactions`, then **Save**.
     Discord sends a signed test ping — it only saves if `DISCORD_PUBLIC_KEY`
     is already set in Vercel and deployed, so do this step last.
3. **OAuth2 tab:**
   - Copy the **Client ID** → `DISCORD_CLIENT_ID`
   - Reset/copy the **Client Secret** → `DISCORD_CLIENT_SECRET`
   - Under **Redirects**, add BOTH:
     - `http://localhost:3000/api/auth/discord/callback`
     - `https://YOUR-VERCEL-DOMAIN/api/auth/discord/callback`
3. **Bot tab:**
   - Copy the **Token** → `DISCORD_BOT_TOKEN`
   - Enable **Server Members Intent** (needed to look up guild members).
4. **Invite the bot to your server:** OAuth2 → URL Generator → scope `bot` →
   permission **Manage Roles** → open the generated URL and invite it.
5. **Role hierarchy (important):** in Server Settings → Roles, drag the bot's
   role **above** `@Citizen`, or it cannot assign that role to anyone.
6. Enable Developer Mode in your Discord client (Settings → Advanced), then:
   - Right-click the server icon → **Copy Server ID** → `DISCORD_GUILD_ID`
   - Server Settings → Roles → right-click `@Citizen` → **Copy Role ID** →
     `DISCORD_CITIZEN_ROLE_ID`

## 3. Local development

```bash
cp .env.example .env.local   # then fill in every value
npm install
npm run dev
```

Generate the `SESSION_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Open http://localhost:3000.

## 4. First admin (one-time bootstrap)

There is no signup path that creates an admin (by design). Register yourself
through the site once, then in Supabase → **Table Editor → players**, set your
row's `role` to `admin` and `status` to `active`. From then on you approve
everyone else with one click at `/portal/admin`.

## 5. GitHub → Vercel deployment

1. Create a GitHub repository and push this project.
   Before the first push, double-check nothing sensitive is staged:
   `git status` must NOT list `.env.local` or any `.env*` file besides `.env.example`.
2. On [vercel.com](https://vercel.com): **Add New → Project → Import** the repo.
   Vercel auto-detects Next.js; no build settings needed.
3. Before (or right after) the first deploy, add ALL variables from
   `.env.example` under **Project → Settings → Environment Variables**, with
   `NEXT_PUBLIC_SITE_URL` set to your production domain
   (e.g. `https://koenigsburg.vercel.app` — no trailing slash).
4. Confirm the production redirect URL from step 2.2 matches that domain, then
   redeploy so the env vars take effect.

## 6. Smoke test

- `/apply` → manual scroll → submit → `/pending` shows a `KBRG-…` code.
- Clear cookies → `/login` → re-enter with IGN + code → back on `/pending`.
- Approve the petition at `/portal/admin` (as your admin user) → the player now
  lands on `/portal`.
- Sign in with a Discord account that already holds `@Citizen` → IGN prompt →
  straight to `/portal`, no approval needed.
