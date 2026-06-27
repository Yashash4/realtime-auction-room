# CLAUDE.md — Mini Realtime Auction Room

Living doc for this project. Keep it current as the build progresses.

## What this is
A realtime cricket/IPL-style **auction room**. Admin runs a room, one player is shown at a time,
bidder **teams** bid live against a countdown, each player is **sold** to the top bidder or
**unsold**, ending on a results page. Flow: **LOBBY → AUCTION → COMPLETED**.

## Stack
- **Next.js 15 (App Router, TypeScript)** — deployed on **Vercel**
- **Supabase** — Postgres + Auth (email/password) + Realtime (Postgres Changes)
- **Tailwind CSS v4 + shadcn/ui** (neutral) + `lucide-react`
- **Zod** for input validation; `@supabase/ssr` for cookie auth sessions

## Core design: DB-as-authority (read this before touching auction logic)
Vercel is serverless — no always-on process to own the timer. So **Postgres is the single source
of truth**:
- Timer = `rooms.item_ends_at` (timestamptz). Clients render the countdown from it; server never ticks.
- **Every mutation is one atomic Postgres function** (`SECURITY DEFINER`, `SELECT ... FOR UPDATE`
  on the room row). Simultaneous bids are serialized by the DB → exactly one winner, budgets stay
  correct. The client can NEVER write auction tables directly (enforced by RLS) — only via these
  functions. This is the correctness guarantee; do not add app-layer write paths.
- **Resolution is idempotent + client-triggered (primary path):** when a client's countdown hits 0
  it calls `resolve_current_item`; the function no-ops if already resolved. First call wins.
- **Vercel Cron = best-effort backup only.** Free/Hobby plan runs cron at most **once/day**
  (`0 0 * * *`), so we do NOT rely on it for live timing — it only sweeps abandoned expired rooms.

### Key auction rules
- **Admin never bids and is not a team.** Admin link is only `rooms.admin_id`; admin is absent from
  `room_participants`. `place_bid` rejects the admin. Admin UI shows run-controls only.
- **Tiered, admin-set increments.** `rooms.increment_tiers` is jsonb: ordered
  `[{ min_price, step }]`. The step is the highest tier whose `min_price <= current price`. Both
  `place_bid` and the bid button use it (button shows `current + step`).
- **Currency is display-only.** `rooms.currency` is a label (`₹`, `$`); all amounts stored as raw ints.
- **Anti-snipe:** a bid with <10s left extends `item_ends_at` to now()+10s.
- **Demo rooms** (`rooms.is_demo = true`) are readable by any logged-in user → show on every dashboard.

## Database tables (see `supabase/migrations/`)
`profiles`, `rooms`, `room_participants`, `items` (players), `bids`.
Auction functions: `place_bid`, `start_auction`, `resolve_current_item`, `admin_next_item`,
`pause_auction`, `resume_auction`, `end_auction`. RLS: read-own-room; writes only via functions.

## Realtime
Each room page subscribes (by `room_id`) to Postgres Changes on `rooms`, `items`, `bids`,
`room_participants` → live bid history, current player, timer, budgets, results. No manual refresh.

## Project layout
```
app/                 routes: (auth)/login,register · dashboard · rooms/[code] · api/cron/resolve
components/          ui/ (shadcn) + feature components (PlayerCard, BidPanel, BidHistory, Timer, ...)
lib/supabase/        client.ts (browser) · server.ts (RSC/route) · middleware.ts (session refresh)
lib/                 auction.ts (rpc wrappers) · types.ts · utils.ts
supabase/            migrations/*.sql · seed.sql
middleware.ts        auth session + route protection
vercel.json          daily cron
```

## Environment variables
| Var | Where | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server (cron only) | service role for the cron sweep |
| `CRON_SECRET` | server | guards `/api/cron/resolve` |

Copy `.env.example` -> `.env.local` and fill in. Never commit real keys.

## How to run locally
```bash
npm install
# 1. create a Supabase project, run supabase/migrations/*.sql then supabase/seed.sql in the SQL editor
# 2. fill .env.local from .env.example
npm run dev        # http://localhost:3000
```
Demo accounts (after seeding) are listed in README.md -> Demo Credentials.

## Build status
Tracked in `todo.md`. Commit after each build-order step with a clear message.
