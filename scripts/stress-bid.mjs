/**
 * Concurrency stress test for the auction bidding engine.
 *
 * Proves the answer to "what if two people bid at the same instant": a pool of
 * DISTINCT authenticated bidders (rate-limit is per-participant, so distinct
 * accounts let us fire truly-concurrent bids) all hit place_bid via Promise.all.
 * The DB serializes them with the room-row FOR UPDATE lock; this script asserts
 * the outcome is always correct.
 *
 * Run (Node 24+):  node --env-file=.env.local scripts/stress-bid.mjs [N]
 *   N = number of concurrent bidders (default 200).
 *
 * Bidder accounts (stressbot-*@stress.test) are created once and reused across
 * runs; the temporary rooms are deleted at the end.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const N = Math.max(2, parseInt(process.argv[2] || "200", 10));
const PASSWORD = "auction123";
const STEP = 100000; // tier step at price >= 1,000,000
const TIERS = [{ min_price: 0, step: 50000 }, { min_price: 1000000, step: 100000 }];
const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Clean validation messages place_bid is allowed to raise (anything else = anomaly).
const CLEAN = /at least|already the highest|budget|too fast|not active|closed|Only joined teams|not active/i;

const inr = (n) => "₹" + n.toLocaleString("en-IN");
let anomalies = 0;
const fail = (msg) => { anomalies++; console.log("   ✗ " + msg); };
const ok = (msg) => console.log("   ✓ " + msg);

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Token cache (gitignored): lets us reuse JWTs across runs and attach them as
// Bearer headers, so the stress run never calls GoTrue (whose sign-in endpoint
// is rate-limited). Re-running accumulates a bigger pool.
const CACHE_FILE = "scripts/.stress-sessions.json";
const loadCache = () => {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
};
const saveCache = (c) => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(c));
  } catch {
    /* ignore */
  }
};
const jwtExp = (t) => {
  try {
    return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).exp ?? 0;
  } catch {
    return 0;
  }
};
const tokenClient = (token) =>
  createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

async function listAllStressbots() {
  const map = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }
  return map;
}

async function ensureUser(email, map) {
  const ex = map.get(email.toLowerCase());
  if (ex) return ex;
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  map.set(email.toLowerCase(), data.user.id);
  return data.user.id;
}

/** Build a pool of authenticated bidders: reuse cached JWTs, sign in the rest
 *  (up to a per-run budget, stopping cleanly if the auth rate limit is hit). */
async function buildPool(targetN) {
  const map = await listAllStressbots();
  const adminId = await ensureUser("stress-admin@stress.test", map);
  const emails = Array.from({ length: targetN }, (_, i) => `stressbot-${String(i).padStart(4, "0")}@stress.test`);
  const bidders = await mapLimit(emails, 12, async (email) => ({ email, id: await ensureUser(email, map) }));

  const cache = loadCache();
  const now = Math.floor(Date.now() / 1000);
  const pool = [];
  const need = [];
  for (const b of bidders) {
    const c = cache[b.email];
    if (c && c.exp > now + 120) pool.push({ ...b, client: tokenClient(c.access_token) });
    else need.push(b);
  }
  console.log(`  reusing ${pool.length} cached sessions, signing in up to ${need.length} more…`);

  let got = 0;
  const SIGNIN_BUDGET = targetN; // sign in until the auth rate limit, then stop cleanly
  for (const b of need) {
    if (got >= SIGNIN_BUDGET) break;
    try {
      const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await c.auth.signInWithPassword({ email: b.email, password: PASSWORD });
      if (error) throw error;
      const tok = data.session.access_token;
      cache[b.email] = { access_token: tok, exp: jwtExp(tok) };
      pool.push({ ...b, client: tokenClient(tok) });
      got++;
      await sleep(120);
    } catch (e) {
      if (/rate limit/i.test(e.message)) {
        console.log(`  auth rate limit reached after ${got} new sign-ins (re-run to add more)`);
        break;
      }
      throw e;
    }
  }
  saveCache(cache);
  return { pool, adminId };
}

async function setupRoom(adminId, pool, { base, budget }) {
  const code = "STRESS" + Math.floor(Math.random() * 1e6);
  const { data: room, error: re } = await svc
    .from("rooms")
    .insert({ code, name: "Stress Test", admin_id: adminId, status: "active", team_budget: budget, currency: "₹", timer_seconds: 30, anti_snipe_seconds: 20, increment_tiers: TIERS })
    .select("id").single();
  if (re) throw re;
  const { data: item, error: ie } = await svc
    .from("items")
    .insert({ room_id: room.id, name: "Stress Player", base_price: base, order_index: 0, status: "active" })
    .select("id").single();
  if (ie) throw ie;
  await svc.from("rooms").update({ current_item_id: item.id, item_ends_at: new Date(Date.now() + 5 * 60000).toISOString() }).eq("id", room.id);
  const rows = pool.map((b, i) => ({ room_id: room.id, user_id: b.id, team_name: `Bot ${i}`, budget_remaining: budget }));
  const { error: pe } = await svc.from("room_participants").insert(rows);
  if (pe) throw pe;
  const { data: parts } = await svc.from("room_participants").select("id,user_id").eq("room_id", room.id);
  const partToUser = new Map(parts.map((p) => [p.id, p.user_id]));
  return { roomId: room.id, itemId: item.id, code, partToUser };
}

const classify = (results) => {
  const accepted = [], cleanRej = [], infra = [];
  for (const r of results) {
    if (!r.error) accepted.push(r);
    else if (CLEAN.test(r.error.message)) cleanRej.push(r);
    else infra.push(r);
  }
  return { accepted, cleanRej, infra };
};

async function main() {
  console.log(`\nConcurrency stress test — target ${N} distinct bidders\n${"=".repeat(48)}`);
  console.log("Building authenticated bidder pool…");
  const { pool, adminId } = await buildPool(N);
  const M = pool.length;
  console.log(`  pool ready: ${M} concurrent distinct bidders\n`);
  if (M < 2) {
    console.error("Not enough sessions to run the test.");
    process.exit(1);
  }

  const roomsToDelete = [];

  // ---------------------------------------------------------------------------
  // Phase 1: everyone bids the SAME valid amount at once -> exactly one winner.
  // ---------------------------------------------------------------------------
  const base = 1000000;
  const A = await setupRoom(adminId, pool, { base, budget: 100000000 });
  roomsToDelete.push(A.roomId);
  console.log(`Phase 1 — ${M} bidders, all bidding ${inr(base)} simultaneously:`);
  const r1 = await Promise.all(pool.map((p) => p.client.rpc("place_bid", { p_room: A.roomId, p_item: A.itemId, p_amount: base })));
  const c1 = classify(r1);
  const { data: bids1 } = await svc.from("bids").select("amount,participant_id").eq("item_id", A.itemId);
  console.log(`   accepted: ${c1.accepted.length}   cleanly rejected: ${c1.cleanRej.length}   infra errors: ${c1.infra.length}   bid rows: ${bids1.length}`);
  c1.accepted.length === 1 ? ok("exactly ONE winner") : fail(`expected 1 winner, got ${c1.accepted.length}`);
  bids1.length === 1 ? ok("exactly one bid row inserted (no double-accept)") : fail(`expected 1 bid row, got ${bids1.length}`);
  c1.infra.length === 0 ? ok("no crashes / infra errors — every loser cleanly rejected") : fail(`${c1.infra.length} infra errors: ${c1.infra[0]?.error?.message}`);
  (bids1[0]?.amount === base) ? ok(`winning bid is at the top amount ${inr(base)}`) : fail("winning amount mismatch");

  // ---------------------------------------------------------------------------
  // Phase 2: a spread of amounts (incl. over-budget probes) fired at once.
  // ---------------------------------------------------------------------------
  const budget = 5000000;
  const B = await setupRoom(adminId, pool, { base, budget });
  roomsToDelete.push(B.roomId);
  const amounts = pool.map((_, i) => {
    const r = i % 8;
    if (r < 4) return base;                       // same-amount cohort
    if (r < 6) return base + (i % 30) * STEP;     // climbing, within budget
    if (r === 6) return budget - STEP;            // near-budget high
    return budget + STEP * (1 + (i % 5));         // OVER budget -> must be rejected
  });
  console.log(`\nPhase 2 — ${M} concurrent bids across a spread (base..${inr(budget - STEP)}) + over-budget probes:`);
  const r2 = await Promise.all(pool.map((p, i) => p.client.rpc("place_bid", { p_room: B.roomId, p_item: B.itemId, p_amount: amounts[i] })));
  const c2 = classify(r2);
  const { data: bids2 } = await svc.from("bids").select("amount,participant_id,created_at").eq("item_id", B.itemId).order("created_at", { ascending: true });
  const seq = bids2.map((b) => b.amount);
  const strictlyIncreasing = seq.every((a, i) => i === 0 || a > seq[i - 1]);
  const maxAccepted = Math.max(...seq, 0);
  const overBudgetOk = amounts.every((a, i) => a <= budget || (r2[i].error && /budget/i.test(r2[i].error.message)));
  const anyOverBudgetAccepted = bids2.some((b) => b.amount > budget);
  console.log(`   accepted (climbing): ${bids2.length}   top: ${inr(maxAccepted)}   cleanly rejected: ${c2.cleanRej.length}   infra errors: ${c2.infra.length}`);
  strictlyIncreasing ? ok("accepted bids strictly increasing by time — NO bid below the running max was ever accepted") : fail("found a non-increasing accepted bid (a stale bid was accepted!)");
  !anyOverBudgetAccepted ? ok("no accepted bid exceeded budget") : fail("an over-budget bid was accepted");
  overBudgetOk ? ok("every over-budget bid was cleanly rejected") : fail("an over-budget bid was not rejected for budget");
  c2.infra.length === 0 ? ok("no crashes / infra errors") : fail(`${c2.infra.length} infra errors: ${c2.infra[0]?.error?.message}`);

  // ---------------------------------------------------------------------------
  // Phase 3: many concurrent resolve calls -> item sold exactly once.
  // ---------------------------------------------------------------------------
  await svc.from("rooms").update({ item_ends_at: new Date(Date.now() - 1000).toISOString() }).eq("id", B.roomId);
  const resolvers = pool.slice(0, Math.min(20, M));
  console.log(`\nPhase 3 — ${resolvers.length} concurrent resolve_current_item calls (idempotent under load):`);
  await Promise.all(resolvers.map((p) => p.client.rpc("resolve_current_item", { p_room: B.roomId })));
  const { data: itemB } = await svc.from("items").select("status,sold_to,sold_price").eq("id", B.itemId).single();
  const { data: soldEvents } = await svc.from("auction_events").select("id").eq("room_id", B.roomId).eq("type", "sold");
  const { data: winner } = itemB.sold_to
    ? await svc.from("room_participants").select("budget_remaining").eq("id", itemB.sold_to).single()
    : { data: null };
  const { data: parts } = await svc.from("room_participants").select("budget_remaining").eq("room_id", B.roomId);
  const minBudget = Math.min(...parts.map((p) => p.budget_remaining));
  console.log(`   item status: ${itemB.status}   sold_price: ${inr(itemB.sold_price ?? 0)}   sold events: ${soldEvents.length}`);
  itemB.status === "sold" && itemB.sold_price === maxAccepted ? ok(`sold once at the top bid ${inr(maxAccepted)}`) : fail("item not sold at the expected top bid");
  soldEvents.length === 1 ? ok("exactly one 'sold' event (resolve is idempotent under concurrency)") : fail(`${soldEvents.length} sold events — double resolution!`);
  winner && winner.budget_remaining === budget - maxAccepted ? ok(`winner budget = ${inr(winner.budget_remaining)} (= budget − price, charged once)`) : fail("winner budget not charged correctly");
  minBudget >= 0 ? ok("no team went negative / over budget") : fail(`a team went negative: ${inr(minBudget)}`);

  // Cleanup temp rooms (bidder accounts are kept for reuse).
  for (const id of roomsToDelete) await svc.from("rooms").delete().eq("id", id);

  console.log("\n" + "=".repeat(48));
  if (anomalies === 0) {
    console.log(`RESULT: PASS — ${M} concurrent same-amount bids -> exactly 1 winner, budgets consistent, 0 anomalies.`);
  } else {
    console.log(`RESULT: FAIL — ${anomalies} anomaly(ies) detected.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nStress test crashed:", err);
  process.exit(1);
});
