# AI Usage Summary

## Tools used
I built this with Claude Code as the AI coding agent. I directed it, reviewed what it wrote, and corrected it when it went the wrong way.

## How I worked
I did not just say "build an auction app" and accept whatever came out. I planned the architecture and the scope first, then fed it goals one at a time, read its output, and pushed back when a choice was wrong. Most of the code is AI-written, but the architecture calls and the bug catches are mine.

## What the AI helped with
- Scaffolding the Next.js + Supabase project
- The database schema and the plpgsql auction functions (place_bid, resolve, the round logic)
- The realtime layer (Supabase postgres_changes)
- The UI components and the dark theme
- The live voice auctioneer
- A concurrency stress test
- Deploying to Vercel + Supabase

## The main decisions and corrections I made
This is the part I actually directed, not the AI.

**1. I rejected its stack recommendation.**
It wanted a Node + Express + Socket.IO server holding the auction state in memory. I said no, for two reasons. One, a long-lived socket server is not free or reliable to host. The free tiers sleep, and a sleeping realtime demo fails the hosting requirement. Two, keeping auction state in server memory means it is gone on a restart or redeploy. So I made the database the source of truth instead: Supabase, with every bid going through one atomic Postgres function using SELECT ... FOR UPDATE, and realtime over postgres_changes. Same correctness, free hosting that never sleeps, and bid events that survive a reconnect.

**2. I caught a production-only bug.**
Creating a room worked locally but failed on the live site with "new row violates row-level security policy for rooms". I traced it to the server action not carrying the user's auth through to the database, so auth.uid() came back null against the RLS check. Once the auth context was passed correctly it worked.

**3. I caught a realtime bug.**
The bid feed was not updating across windows. The subscription was listening for the event "INSERT" and silently delivering nothing. I had it switch to "*" with a refetch as a safety net, and after that the two-window live bidding was clean.

**4. I wanted to be sure the duplicate-bid protection actually held.**
For double-click and retry protection it used a content-derived idempotency key (item plus amount, scoped per bidder, with a unique constraint). Before trusting it I worked through the case where two teams bid the exact same amount at the same instant. It is safe, because the room row is locked so bids are processed one at a time and every valid bid must be strictly higher than the last, so two valid bids can never share the same item-and-amount key.

**5. I made it prove the bidding is correct under pressure.**
The whole thing lives or dies on what happens when people bid at the same instant, so I had it write a stress test that fires many bids from different accounts at the exact same moment on one player. It confirmed exactly one winner, every other bid cleanly rejected, and no team going over budget, across 121 simultaneous bids. That is the proof that the row-locking actually works, not just that it should.

There were smaller ones too. I chose a templated auctioneer that uses the browser's own speech engine instead of an LLM API, because a network call in the live bidding path would lag the auction. And I caught a bug where the sold confetti re-fired on every timer tick instead of once.

## What I deliberately did not build
No Socket.IO or Kafka or microservices, no machine-learning fraud detection, no proxy bidding. A single Postgres database with row locking is the right call at this scale, and I can explain the scale-out path if asked. I would rather ship something correct and polished than something broad and broken.

## Known limitations
- Item resolution is driven by an active client's countdown. If a room is left completely empty in the middle of an item, a once-a-day cron sweep (the Vercel free tier limit) closes it, so an abandoned item can resolve late. The live path always resolves instantly.
- Supabase's free tier has realtime connection and message limits. Fine for a demo.
- No real money. Budgets are in-app units and the currency is just a display label.
- Desktop only, which the brief allows.

## Evidence
The full build session transcripts are in this folder (`claude-build-session-*.md`).
