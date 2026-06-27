# Plan — Mini Realtime Auction Room (IPL-style)

## What we're building
A realtime cricket/IPL-style **auction room**: users sign up, create or join a room by code,
an admin starts the auction, one player is shown at a time, teams bid live against a countdown,
and each player is **sold** to the highest bidder or marked **unsold** — ending in a results page.
Flow: **LOBBY → AUCTION → COMPLETED**.

## Stack (decided)
- **Next.js 15 (App Router, TypeScript)** on **Vercel**
- **Supabase**: Postgres + Auth (email/password) + Realtime
- **Tailwind CSS + shadcn/ui** + `lucide-react`
- **Zod** for input validation, `@supabase/ssr` for cookie auth sessions

## The key design decision (read this)
Vercel is **serverless** — there is no always-on process to run the countdown or resolve items.
So **Postgres is the single source of truth**:
- The timer is a column `item_ends_at` (a timestamp). Clients render the countdown from it;
  the server never "ticks".
- **Every bid and every resolution is one atomic Postgres function** that locks the room row
  (`SELECT ... FOR UPDATE`). Two people bidding at the same instant are serialized by the DB →
  exactly one valid winner, budgets stay correct. This is the core correctness guarantee.
- **Resolution is idempotent + client-triggered (PRIMARY mechanism)**: when a client's countdown
  hits 0 it calls `resolve_current_item`; the function no-ops if already resolved. Many clients
  calling at once → first wins, rest do nothing. This is what makes resolution feel instant.
- **Vercel Cron is a best-effort backup only.** On the Vercel **free/Hobby** plan cron runs at
  most **once per day** (per-minute is Pro-only), so we do NOT rely on it for live timing — it's a
  once-daily sweep that cleans up any item left expired in an abandoned room. Live rooms always
  resolve via the client trigger above.
- **Supabase Realtime** pushes changes to all clients — no custom websocket server needed.

## Database tables
- `profiles` — id (→ auth.users), display_name (auto-created on signup)
- `rooms` — id, code, name, admin_id, status (lobby|active|paused|completed),
  current_item_id, item_ends_at, team_budget, **currency** (text label, display-only, e.g. `$`,
  `₹`), **increment_tiers** (jsonb, see below), is_demo (bool), created_at
- `room_participants` — room_id, user_id, team_name, budget_remaining, joined_at.
  **Bidder teams only.** The admin runs the auction and is NOT a participant/team — `admin_id` on
  the room is the only admin link; the admin never appears in `room_participants` and cannot bid.
- `items` (players) — id, room_id, name, role, country, base_price, image_url, order_index,
  status (pending|active|sold|unsold), sold_to, sold_price
- `bids` — id, room_id, item_id, participant_id, amount, created_at

### Bid increments — tiered & admin-set (not flat)
The step is **derived from the current price**, not a flat number. Tiers live on the room as
`increment_tiers` jsonb — an ordered list of `{ min_price, step }`, e.g.:
```json
[{ "min_price": 0, "step": 50000 }, { "min_price": 1000000, "step": 100000 }]
```
So 100k–999k → +50k, 1m+ → +100k. The admin edits these tiers when creating/configuring the room.
`place_bid` and the UI both pick the step by finding the highest tier whose `min_price ≤ current
price`. The bid button shows **current price + that step**. Validation: amount must equal (or be ≥)
current price + the matching step.

### Currency
`rooms.currency` is a **display-only label**. All amounts (budgets, bids, prices) are stored as raw
integers; the label is only prepended when rendering. No conversion, ever.

**RLS:** participants can read their room's rows; all writes go only through the SQL functions
below (the client can never bypass auction rules). Realtime enabled on rooms/items/bids/participants.
Demo rooms (`is_demo = true`) are readable by **any logged-in user** so they surface on every
dashboard without joining.

## Auction engine — Postgres functions (the only write path)
- `place_bid(room, item, amount)` — checks: caller is a **bidder participant** (NOT the admin),
  room active, item active, not expired, amount ≥ current price + **tier step** (step derived from
  `increment_tiers` and current price), bidder has budget, bidder isn't already top. Inserts bid.
  **Anti-snipe:** if <10s left, extend timer to 10s.
- `start_auction(room)` — **admin only** (admin never bids); lobby→active, first player active, set timer.
- `resolve_current_item(room)` — idempotent; if expired: mark sold (to top bidder, decrement
  budget) or unsold, advance to next player or complete the room.
- `admin_next_item`, `pause_auction`, `resume_auction`, `end_auction` — admin controls.

## Realtime
Each room page subscribes (by room_id) to changes on rooms, items, bids, participants → live
bid history, current player, timer, budgets, and results update with **no manual refresh**.
Timer is derived client-side from `item_ends_at` vs a server-time offset fetched on mount.

## Pages (desktop-only, polished)
- **/login, /register** — Supabase Auth, friendly errors
- **/dashboard** — create room (name, currency, budget, timer, **edit increment tiers**, pick
  players from seed list), join by code, "my rooms" with status badges, AND a **Demo Rooms**
  section showing the seeded demo rooms to every logged-in user (no join needed to see them)
- **/rooms/[code]** — admin sees **run controls only** (start/next/pause/end), no bid UI; bidder
  teams see the bid panel
  - **Lobby:** room code + share, team list, admin "Start Auction"
  - **Auction:** big player card, countdown ring, current highest bid + bidder, **tiered quick-bid
    button (shows current + the matching step)**, live bid history, team-budget sidebar, admin
    controls (pause/resume/next/end). Amounts rendered with the room's currency label.
  - **Completed:** results table (player → team → price), per-team squads, totals
- Loading skeletons, empty states (no rooms / no bids / no players), error toasts, connection indicator

## Seed / demo
`seed.sql` seeds enough to **test two-window concurrent bidding immediately** and to keep every
page non-empty. All credentials go in the README.
- **Accounts:** 1 admin (`admin@demo.test`) + 3 bidder teams (`team1@demo.test`,
  `team2@demo.test`, `team3@demo.test`) — shared simple password. This is also our test harness:
  log into two of the team accounts in two browser windows to race bids.
- **Room A — `DEMO01` (live/lobby, `is_demo`):** admin set, the 3 teams already joined as
  participants, ~10 IPL players queued, currency `₹`, tiered increments preconfigured. Ready to
  start and bid right away.
- **Room B — `DEMO02` (completed, `is_demo`):** a finished auction with sold/unsold results
  populated, so the **results page isn't empty** on first look.
- Both demo rooms have `is_demo = true` so they appear on **every logged-in user's dashboard**.
- Bundled IPL player list reused when creating new rooms.

## Deployment
- Supabase project: run migrations + seed.
- Vercel from GitHub. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (cron only), `CRON_SECRET`. Documented in `.env.example` + README.
- `vercel.json` cron is **best-effort only** (Hobby = once/day): `0 0 * * *` →
  `/api/cron/resolve` (guarded by `CRON_SECRET`). Live timing is the client trigger, not cron.

## Required submission artifacts
README (Live Demo, Demo Credentials, Tech Stack, Features, Architecture, Realtime Design,
Database Schema, AI Usage, Running Locally, Env Vars, Known Limitations, Future Improvements),
`.env.example`, and `ai-transcripts/` with `ai-usage-summary.md` + session export.

## Build order
1. Scaffold Next.js + Tailwind + shadcn + Supabase clients + middleware
2. Migrations: tables + RLS + profile trigger; enable realtime
3. Auction SQL functions (tier-step logic, admin-can't-bid) + SQL self-check (concurrent bids → one
   winner; double-resolve → one sale; tier steps; admin bid rejected)
4. Auth pages + dashboard (create with currency + tier editor, join, add players, Demo Rooms section)
5. Room page: subscriptions, timer, tiered bid panel, history, budgets, admin run-controls, all 3 views
6. Cron resolve endpoint (daily best-effort) + vercel.json
7. seed.sql: 1 admin + 3 team accounts, DEMO01 (live) + DEMO02 (completed), both `is_demo`
8. README + .env.example + ai-transcripts/
9. Deploy to Vercel + Supabase, verify live end-to-end

## Known limitations (documented honestly)
- Resolution is driven by an active client's countdown. If a room is fully abandoned mid-item, it
  stays unresolved until someone reopens it OR the once-daily Vercel Hobby cron sweeps it (per-minute
  cron is Pro-only). Acceptable for a demo; the live path always resolves instantly.
- Supabase Realtime free-tier connection/message limits (fine for demo scale).
- No real money; budgets are in-app units. Currency is a display label only.

## How we'll verify
- **Concurrency:** SQL self-check races two `place_bid`s on one item → asserts one winner, budgets
  consistent; double `resolve_current_item` → one sale.
- **Tiered increments:** self-check asserts the step picked at 500k is +50k and at 1.2m is +100k,
  and that a bid below current + step is rejected.
- **Admin-can't-bid:** assert `place_bid` called as the admin is rejected.
- **Multi-session realtime (the real test, using seeded accounts):** log into `team1` and `team2`
  in two windows, admin starts `DEMO01` → bids, current player, timer, results all update live;
  fire simultaneous bids → exactly one winner.
- **Full flow:** create → set currency/tiers → add players → start → bid → anti-snipe → sold/unsold
  → next → completed. Confirm `DEMO02` results page renders populated.
- **Deploy:** live Vercel URL, log in with demo creds, run the flow end to end.