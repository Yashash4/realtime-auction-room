# AI Usage Summary

Tools used:
- Claude Code (Claude Opus)

What AI helped with:
- Initial architecture and stack selection (Next.js on Vercel + Supabase Postgres/Auth/Realtime).
- The DB-as-authority design for realtime on a serverless host (timestamp-based timer, client-rendered countdown, client-triggered resolution).
- The Postgres schema, RLS policies, and the SECURITY DEFINER auction functions (place_bid, resolve_current_item, start/pause/resume/end, tier_step, etc.).
- The realtime React hook (Supabase Postgres Changes subscriptions) and the UI components (player card, bid panel, bid history, timer, results).
- The seed script that creates the demo accounts and the DEMO01 / DEMO02 rooms.
- Debugging a realtime delivery bug where bid events were not arriving on clients.

Important manual decisions:
- Chose Supabase Postgres + Realtime over a custom WebSocket server because Vercel is serverless — there is no always-on process to own the timer or push updates, so the database is the source of truth and Supabase fans out changes.
- Put all auction logic in atomic, row-locked SQL functions (`SELECT ... FOR UPDATE` on the room row) rather than in application code, so concurrent bids are serialized by Postgres and cannot corrupt state — exactly one winner, budgets always consistent.
- Made item resolution idempotent and client-triggered, with the daily cron only as a best-effort backstop, because the Vercel Hobby plan cannot run cron per-minute. The first client whose countdown hits 0 resolves the item; the rest no-op.
- Stored bid increments as tiered, admin-set values in a jsonb column (ordered `{ min_price, step }` list) so the step is derived from the current price instead of a flat number.
- Switched the bids realtime binding from `event: "INSERT"` to `event: "*"` after discovering INSERT-only events were not being delivered, and added a focus + poll refetch safety net so a dropped event can never permanently desync a client.

Known limitations:
- Precise resolution needs at least one active client in the room; the daily Hobby cron is the only backstop, so an abandoned item may resolve up to ~a day late.
- Supabase Realtime free-tier connection/message limits apply (fine for demo scale).
- Budgets are in-app units only; currency is a display label, never converted.
- Desktop-only; responsiveness was not required by the assignment.

Full session transcript: export via Claude Code `/export` into this folder as `claude-session-1.txt`.
