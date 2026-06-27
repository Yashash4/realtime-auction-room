# Build TODO

Ticked off as we go. See `plan.md` for full detail and `CLAUDE.md` for design.

- [x] **1. Scaffold** — Next.js + Tailwind + shadcn + Supabase clients + middleware + docs
- [ ] **2. Migrations** — tables + RLS + profile trigger; enable realtime replication
- [ ] **3. Auction SQL functions** — tier-step logic, admin-can't-bid, idempotent resolve + SQL self-check
- [ ] **4. Auth + dashboard** — login/register, create room (currency + tier editor), join, add players, Demo Rooms section
- [ ] **5. Room page** — realtime subscriptions, timer, tiered bid panel, history, budgets, admin run-controls, all 3 views
- [ ] **6. Cron** — daily best-effort resolve endpoint + vercel.json
- [ ] **7. Seed** — 1 admin + 3 team accounts, DEMO01 (live) + DEMO02 (completed), both is_demo
- [ ] **8. Docs** — README + .env.example + ai-transcripts/
- [ ] **9. Deploy** — Vercel + Supabase, verify live end-to-end

## Parallel (sub-agents, where independent)
- UI components (PlayerCard, BidPanel, Timer, BidHistory, TeamBudgets, AdminControls) — after schema/types fixed
- Seed data (IPL player list) — independent
- README draft — near the end
