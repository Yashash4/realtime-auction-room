# Realtime Auction Room

A realtime IPL-style auction room. An admin runs a room, players are shown one at a time, bidder teams bid live against a countdown, and each player is sold to the top bidder or marked unsold — ending on a results page. Flow: **LOBBY → AUCTION → COMPLETED**.

## Live Demo

> Live URL: _to be filled after deployment_

## Demo Credentials

All accounts use the password `auction123`.

| Email | Role | Team |
|-------|------|------|
| `admin@demo.test` | Auction Admin (runs the auction, does not bid) | — |
| `team1@demo.test` | Bidder | Mumbai Mavericks |
| `team2@demo.test` | Bidder | Chennai Chargers |
| `team3@demo.test` | Bidder | Bangalore Blasters |

Two demo rooms are seeded with `is_demo = true`, so they appear on **every** logged-in user's dashboard without joining:

- **DEMO01** — live lobby with 10 players and the 3 teams already joined. Start it and bid.
- **DEMO02** — a completed auction; opens straight to a populated results page.

**To see realtime in action:** open the app in two browser windows and log in as `team1` and `team2`. In a third window (or the same browser), log in as `admin`, open **DEMO01**, and click **Start Auction**. As the two teams bid, the current player, countdown, highest bid, bid history, and budgets update live in every window with no manual refresh. Fire two bids at the same instant to confirm exactly one wins.

## Tech Stack

- **Next.js 16** (App Router, TypeScript), deployed on **Vercel**
- **Supabase** — Postgres + Auth (email/password) + Realtime (Postgres Changes)
- **Tailwind CSS v4** + **shadcn/ui** (Base UI) + **lucide-react**
- **Zod** for input validation
- **@supabase/ssr** for cookie-based auth sessions

## Features

Mapped to the assignment:

- Create a room (name, currency, budget, timer, players)
- Join a room by code
- Admin and participant (team) roles
- Player list per room
- Start the auction
- Current player display, one lot at a time
- Countdown timer with anti-snipe (a bid under 10s left extends the clock to 10s)
- Realtime bidding
- Live bid history
- Sold / unsold resolution
- Final results page (player → team → price, per-team squads, totals)
- Room state persistence (state lives in Postgres; reopening a room resumes exactly where it was)

Beyond the brief:

- **Tiered, admin-set bid increments** — the step is derived from the current price, not a flat number
- **Per-room currency label** — a display-only label (`₹`, `$`); all amounts stored as raw integers
- **Team budgets** — enforced server-side; a bid can't exceed remaining budget
- **Public demo rooms** — visible to every logged-in user
- **Live Now + watch view** — the dashboard lists every in-progress auction (host, current player, live "X watching" count) to all logged-in users; anyone can open a room's read-only watch / cast view at `/rooms/[code]/projector` (huge player card, bid, timer, purses, bid history + commentary) — the same view doubles as the big-screen/projector cast. Active rooms are watchable by non-members; joining as a team still only works in the lobby.

## Architecture

The app is a Next.js App Router project with Supabase Postgres as the system of record:

- **Next.js** renders server components and route handlers, and uses server actions for auth and form flows.
- **Supabase Postgres** holds all auction state and is the single source of truth.
- **All auction mutations go through `SECURITY DEFINER` Postgres functions** — this is the only write path. RLS blocks direct client writes to the auction tables, so a client cannot bypass the rules; it can only call the functions.
- **The client mirrors state via Supabase Realtime** (Postgres Changes) and never owns authoritative state itself.

Clean separation of concerns:

- `app/` — routes: `(auth)/login`, `(auth)/register`, `dashboard`, `rooms/[code]`, `api/cron/resolve`
- `components/` — `ui/` (shadcn) plus feature components (player card, bid panel, bid history, timer, etc.)
- `lib/` — Supabase clients (browser / server / middleware), auction RPC wrappers, shared types, hooks
- `supabase/` — migrations, SQL tests, and the seed script

## Realtime Design

This is the core of the project. Vercel is serverless — there is no always-on process to own a countdown or resolve items — so the design is **DB-as-authority**:

- **The timer is a timestamp, not a process.** Each room has `rooms.item_ends_at` (timestamptz). The server never ticks. Clients render the countdown by comparing `item_ends_at` against an offset derived from `server_now()` fetched on mount, so client clock skew doesn't matter.
- **Every bid and every resolution is one atomic Postgres function** that locks the room row (`SELECT ... FOR UPDATE`). Two clients bidding at the same instant are serialized by the database, so there is exactly one winner and budgets stay consistent. There is no app-layer write path to corrupt.
- **Item resolution is idempotent and client-triggered** (the primary mechanism). When a client's countdown hits 0 it calls `resolve_current_item`, which finalizes the item (sold/unsold), advances to the next player or completes the room, and **no-ops if the item is already resolved**. Many clients calling at once → the first wins, the rest do nothing. This is what makes resolution feel instant.
- **A daily Vercel Cron is a best-effort backstop only.** On the Vercel Hobby plan, cron runs at most once per day (`0 0 * * *`); per-minute cron is Pro-only. So cron is **not** the primary timing mechanism — it only sweeps items left expired in fully abandoned rooms.
- **Supabase Realtime** (Postgres Changes on `rooms`, `items`, `bids`, `room_participants`) fans every change out to all subscribed clients, driving live bid history, current player, timer, budgets, and results.
- **A focus + 4s poll refetch** is a safety net: if a realtime event is ever dropped, the next focus or poll re-reads state, so a client can never permanently desync.

## Database Schema

Five tables (see `supabase/migrations/0001_schema.sql`):

- **`profiles`** — one row per auth user (`id` → `auth.users`), `display_name`. Auto-created on signup via a trigger.
- **`rooms`** — `code`, `name`, `admin_id`, `status` (`lobby` | `active` | `paused` | `completed`), `current_item_id`, `item_ends_at` (authoritative deadline), `paused_remaining_ms`, `team_budget`, `currency` (display label), `increment_tiers` (jsonb), `timer_seconds`, `is_demo`.
- **`room_participants`** — bidder **teams only** (the admin is never a participant). `room_id`, `user_id`, `team_name`, `budget_remaining`, unique per `(room_id, user_id)`.
- **`items`** (players) — `room_id`, `name`, `role`, `country`, `base_price`, `image_url`, `order_index`, `status` (`pending` | `active` | `sold` | `unsold`), `sold_to`, `sold_price`.
- **`bids`** — `room_id`, `item_id`, `participant_id`, `amount`, `created_at`.

Auction functions, the only write path (see `supabase/migrations/0003_functions.sql`):

- `join_room` — validate and insert a participant by room code (admin can't join their own room as a team)
- `place_bid` — validate caller is a bidder team (rejects the admin), room/item active and not expired, amount ≥ current + tier step, within budget; insert bid; apply anti-snipe
- `start_auction` — admin only; `lobby → active`, activate the first player, set the timer
- `resolve_current_item` — idempotent primary resolver; finalize the expired item and advance or complete
- `admin_next_item`, `pause_auction`, `resume_auction`, `end_auction` — admin run controls
- `tier_step` — helper that picks the highest tier whose `min_price ≤ current price`
- `server_now` — authoritative server time for the client countdown offset

**RLS:** reads are scoped to viewable rooms via a `can_view_room()` helper (your own rooms plus any `is_demo` room); all writes go through the functions above — direct table writes are blocked.

## AI Usage

This project was built with AI assistance. See [`ai-transcripts/ai-usage-summary.md`](ai-transcripts/ai-usage-summary.md) for a summary of what AI helped with, the manual decisions made, and known limitations.

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Supabase project.
3. Run the SQL migrations in order — `supabase/migrations/0001` through `0004` — in the Supabase SQL editor, or with `supabase db push`.
4. Copy the env template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
5. Seed the demo data (accounts + DEMO01/DEMO02):
   ```bash
   node --env-file=.env.local scripts/seed.mjs
   ```
6. Start the dev server:
   ```bash
   npm run dev        # http://localhost:3000
   ```

> In the demo, set Supabase Auth **"Confirm email" to OFF** so signups are instant. (Seeded users are created pre-confirmed regardless.)

## Environment Variables

Documented in `.env.example`.

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Service role for the cron sweep and the seed script |
| `CRON_SECRET` | server | Guards the `/api/cron/resolve` endpoint |

## Known Limitations

- **Precise resolution needs at least one active client in the room.** Resolution is driven by a live client's countdown. If a room is fully abandoned mid-item, the daily Vercel Hobby cron is the only backstop, so an abandoned item may resolve up to ~a day late. Live rooms always resolve instantly.
- **Supabase Realtime free-tier limits** on connections and messages (fine for demo scale).
- **Budgets are in-app units only** — no real money. `currency` is a display label, never converted.
- **Desktop-only.** Per the assignment, responsiveness is not a requirement.

## Future Improvements

- Per-minute cron, or a small always-on resolver service, on the Vercel Pro plan
- Presence indicators (who's in the room)
- Chat and reactions
- Spectator mode
- Player images
- Squad / role caps per team

## Test Instructions

**SQL self-check (automated):** run `supabase/tests/auction_selfcheck.sql` in the Supabase SQL editor. It is rollback-safe (no permanent changes) and asserts:

- tiered increments pick the correct step at different price points
- the admin cannot bid
- a sale decrements the winner's budget correctly
- re-resolving an item is idempotent (one sale only)
- a bid over budget is rejected (budget cap)
- an item with no bids is marked unsold and the room completes

**Manual two-window realtime test:** follow the steps under [Demo Credentials](#demo-credentials) — log in as `team1` and `team2` in two windows, have `admin` start **DEMO01**, and bid. Confirm the current player, timer, bid history, budgets, and results all update live, and that two simultaneous bids produce exactly one winner.

**Concurrency stress test (automated):** `node --env-file=.env.local scripts/stress-bid.mjs [N]` provisions a pool of distinct authenticated bidders and fires `place_bid` at the same instant via `Promise.all`. It asserts the engine stays correct under simultaneous load:

- many distinct bidders all bidding the **same** amount at once → **exactly one winner**, every other cleanly rejected, no double-accept, no crash
- a burst across a spread of amounts → accepted bids are strictly increasing (no bid below the running max is ever accepted), over-budget bids rejected, no team over budget
- many concurrent `resolve_current_item` calls → the item is **sold exactly once** (idempotent), the winner is charged once, no negative budgets

Latest run:

```
RESULT: PASS — 121 concurrent same-amount bids -> exactly 1 winner, budgets consistent, 0 anomalies.
```

(The bidder count is bounded by Supabase's auth sign-in rate limit; sessions are cached so re-running accumulates a larger pool.)
