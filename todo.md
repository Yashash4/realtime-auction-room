# Build TODO

Ticked off as we go. See `plan.md` for full detail and `CLAUDE.md` for design.

- [x] **1. Scaffold** — Next.js + Tailwind + shadcn + Supabase clients + middleware + docs
- [x] **2. Migrations** — tables + RLS + profile trigger; realtime replication (`supabase/migrations/0001,0002`)
- [x] **3. Auction SQL functions** — tier-step, admin-can't-bid, idempotent resolve (`0003`) + rollback-safe self-check (`supabase/tests`) + TS data layer (`lib/types,auction,format`). ✅ migrations pushed + self-check PASSED on live Supabase (`db query --linked`).
- [x] **4. Auth + dashboard** — login/register (Supabase Auth), landing, create room (currency + tier editor + players), join by code, my rooms + Demo Rooms. Build passes.
- [x] **5. Room page** — realtime subscriptions (`use-auction-room`), server-synced timer + idempotent auto-resolve, tiered bid panel, live history, budgets, admin controls, lobby/auction/completed views. Build passes.
- [ ] **6. Cron** — daily best-effort resolve endpoint + vercel.json
- [x] **7. Seed** — `scripts/seed.mjs`: 1 admin + 3 team accounts, DEMO01 (live lobby) + DEMO02 (completed), both is_demo. ✅ run + verified on live DB.
- [ ] **8. Docs** — README + .env.example + ai-transcripts/
- [ ] **9. Deploy** — Vercel + Supabase, verify live end-to-end

## Parallel (sub-agents, where independent)
- UI components (PlayerCard, BidPanel, Timer, BidHistory, TeamBudgets, AdminControls) — after schema/types fixed
- Seed data (IPL player list) — independent
- README draft — near the end
