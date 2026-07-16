# 🏰 Königsburg Web Portal

Citizenship portal for the Königsburg Minecraft civilization: player database,
Discord OAuth / manual signups, and one-click admin whitelisting.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**, backed by
**Supabase (PostgreSQL)**, deployed on **Vercel**. No auth library — sessions
are HMAC-signed HTTP-only cookies handled by Server Actions.

## The three paths in

| Path | Who | Flow |
|---|---|---|
| 1 · Auto | Discord user holding `@Citizen` | OAuth → one-time IGN prompt → instantly **active** |
| 2 · Web app | Discord user without the role | OAuth → pre-filled application → **pending** → admin approves (bot grants `@Citizen`) |
| 3 · Manual | OAuth blocked / no Discord login | IGN + Discord name form → `KBRG-…` code shown → prove ownership in `#immigration` → admin approves |

Everyone receives a permanent `KBRG-XXXXXXXX` verification code — it doubles as
the re-login key if cookies are ever cleared (`/login`). No email, no password.

## Getting started

See **[SETUP.md](SETUP.md)** for the full walkthrough (Supabase schema, Discord
application, env vars, Vercel deploy). Short version:

```bash
cp .env.example .env.local   # fill in real values — never commit them
npm install
npm run dev
```

## Map of the city

```
app/
├── page.tsx                    # Landing page
├── login/                     # Discord OAuth button + IGN/code re-login
├── apply/                     # Path 2 (OAuth-prefilled) & Path 3 (manual) forms
├── welcome/                   # Path 1 one-time IGN prompt
├── pending/                   # Limbo: shows the KBRG verification code
├── portal/                    # Guarded: session + active status required
│   └── admin/                 # role=admin only: whitelisting queue
└── api/auth/discord/          # OAuth start + callback
actions/                       # Server Actions (auth, admin approval)
lib/                           # Supabase client, sessions, Discord API, codes
supabase/schema.sql            # Run once in the Supabase SQL editor
```

## Secrets

Real credentials live only in `.env.local` (gitignored) and Vercel's
environment variables. The committed `.env.example` holds placeholders only.
