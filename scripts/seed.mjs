/**
 * Seed script for the Supabase-backed realtime auction app.
 *
 * Run (Node 24+, env loaded by Node's --env-file flag):
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Idempotent: reuses existing auth users and wipes/recreates the demo rooms,
 * so it is safe to run repeatedly.
 *
 * Demo credentials (all password: auction123):
 *   admin@demo.test  — Auction Admin       (room admin, not a bidder)
 *   team1@demo.test  — Mumbai Mavericks
 *   team2@demo.test  — Chennai Chargers
 *   team3@demo.test  — Bangalore Blasters
 *
 * Seeds two rooms:
 *   DEMO01 — live lobby with 10 pending players and 3 teams
 *   DEMO02 — completed room with sold/unsold results and bid history
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "auction123";
const TEAM_BUDGET = 100000000;
const INCREMENT_TIERS = [
  { min_price: 0, step: 50000 },
  { min_price: 1000000, step: 100000 },
];

/** Inlined subset of lib/players.ts SAMPLE_PLAYERS. */
const PLAYERS = [
  { name: "Virat Kohli", role: "Batter", country: "India", base_price: 2000000 },
  { name: "Rohit Sharma", role: "Batter", country: "India", base_price: 2000000 },
  { name: "Jasprit Bumrah", role: "Bowler", country: "India", base_price: 2000000 },
  { name: "Ravindra Jadeja", role: "All-rounder", country: "India", base_price: 1600000 },
  { name: "KL Rahul", role: "Wicket-keeper", country: "India", base_price: 1700000 },
  { name: "Hardik Pandya", role: "All-rounder", country: "India", base_price: 1500000 },
  { name: "Pat Cummins", role: "Bowler", country: "Australia", base_price: 2000000 },
  { name: "Travis Head", role: "Batter", country: "Australia", base_price: 1400000 },
  { name: "Rashid Khan", role: "Bowler", country: "Afghanistan", base_price: 1800000 },
  { name: "Jos Buttler", role: "Wicket-keeper", country: "England", base_price: 1600000 },
  { name: "Glenn Maxwell", role: "All-rounder", country: "Australia", base_price: 1100000 },
  { name: "Shubman Gill", role: "Batter", country: "India", base_price: 1700000 },
];

const TEAM_USERS = [
  { email: "team1@demo.test", displayName: "Mumbai Mavericks" },
  { email: "team2@demo.test", displayName: "Chennai Chargers" },
  { email: "team3@demo.test", displayName: "Bangalore Blasters" },
];

/**
 * Ensure an auth user exists; create it (email pre-confirmed) or reuse the
 * existing one if the email is already taken. Returns the user id.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {Promise<string>}
 */
async function ensureUser(email, password, displayName) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (!error && data?.user) {
    return data.user.id;
  }

  // Email likely already exists — find the existing user and reuse its id.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!existing) {
    throw error ?? new Error(`Could not create or find user ${email}`);
  }
  return existing.id;
}

/**
 * Ensure a user exists and their profile display_name is set.
 * @param {string} email
 * @param {string} displayName
 * @returns {Promise<string>} user id
 */
async function ensureUserWithProfile(email, displayName) {
  const id = await ensureUser(email, PASSWORD, displayName);
  const { error } = await supabase
    .from("profiles")
    .upsert({ id, display_name: displayName });
  if (error) throw error;
  return id;
}

async function main() {
  // 1. Auth users + profiles.
  const adminId = await ensureUserWithProfile("admin@demo.test", "Auction Admin");
  const teamIds = [];
  for (const t of TEAM_USERS) {
    teamIds.push(await ensureUserWithProfile(t.email, t.displayName));
  }
  console.log("✓ ensured 4 users (1 admin, 3 teams) and their profiles");

  // 2. Reset demo rooms (FK cascade clears items/participants/bids).
  {
    const { error } = await supabase
      .from("rooms")
      .delete()
      .in("code", ["DEMO01", "DEMO02"]);
    if (error) throw error;
  }
  console.log("✓ cleared existing DEMO01/DEMO02 rooms");

  const roomBase = {
    admin_id: adminId,
    is_demo: true,
    currency: "₹",
    team_budget: TEAM_BUDGET,
    increment_tiers: INCREMENT_TIERS,
  };

  /**
   * Insert the 3 bidder teams as room participants.
   * @param {string} roomId
   * @param {number[]} budgets budget_remaining per team (index-aligned to TEAM_USERS)
   * @returns {Promise<string[]>} participant ids (index-aligned to TEAM_USERS)
   */
  async function insertParticipants(roomId, budgets) {
    const rows = TEAM_USERS.map((t, i) => ({
      room_id: roomId,
      user_id: teamIds[i],
      team_name: t.displayName,
      budget_remaining: budgets[i],
    }));
    const { data, error } = await supabase
      .from("room_participants")
      .insert(rows)
      .select("id, user_id");
    if (error) throw error;
    // Re-order to match TEAM_USERS order.
    return teamIds.map((uid) => data.find((p) => p.user_id === uid).id);
  }

  // 3. DEMO01 — live lobby room.
  {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        ...roomBase,
        code: "DEMO01",
        name: "IPL Demo — Live Lobby",
        status: "lobby",
        timer_seconds: 30,
      })
      .select("id")
      .single();
    if (roomError) throw roomError;

    const lobbyPlayers = PLAYERS.slice(0, 10);
    const items = lobbyPlayers.map((p, i) => ({
      room_id: room.id,
      name: p.name,
      role: p.role,
      country: p.country,
      base_price: p.base_price,
      order_index: i,
      status: "pending",
    }));
    const { error: itemsError } = await supabase.from("items").insert(items);
    if (itemsError) throw itemsError;

    await insertParticipants(room.id, [TEAM_BUDGET, TEAM_BUDGET, TEAM_BUDGET]);
    console.log("✓ created DEMO01 with 10 players, 3 teams");
  }

  // 4. DEMO02 — completed room with results + bid history.
  {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        ...roomBase,
        code: "DEMO02",
        name: "IPL Demo — Final Results",
        status: "completed",
        timer_seconds: 30,
        current_item_id: null,
        item_ends_at: null,
      })
      .select("id")
      .single();
    if (roomError) throw roomError;

    // Participants first (budgets adjusted after we know sold prices).
    const participantIds = await insertParticipants(room.id, [
      TEAM_BUDGET,
      TEAM_BUDGET,
      TEAM_BUDGET,
    ]);

    const resultPlayers = PLAYERS.slice(0, 6);

    /**
     * Sale plan for the 4 sold players: which player index, winning team index,
     * and how much over base price they went for.
     */
    const sales = [
      { player: 0, winner: 0, over: 800000 }, // Virat Kohli -> Mumbai
      { player: 1, winner: 1, over: 400000 }, // Rohit Sharma -> Chennai
      { player: 2, winner: 2, over: 500000 }, // Jasprit Bumrah -> Bangalore
      { player: 3, winner: 0, over: 300000 }, // Ravindra Jadeja -> Mumbai
    ];

    const spentByTeam = [0, 0, 0];
    const itemRows = resultPlayers.map((p, i) => {
      const sale = sales.find((s) => s.player === i);
      const base = {
        room_id: room.id,
        name: p.name,
        role: p.role,
        country: p.country,
        base_price: p.base_price,
        order_index: i,
      };
      if (!sale) {
        return { ...base, status: "unsold", sold_to: null, sold_price: null };
      }
      const soldPrice = p.base_price + sale.over;
      spentByTeam[sale.winner] += soldPrice;
      return {
        ...base,
        status: "sold",
        sold_to: participantIds[sale.winner],
        sold_price: soldPrice,
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from("items")
      .insert(itemRows)
      .select("id, order_index, base_price, sold_price, sold_to");
    if (itemsError) throw itemsError;

    // Build escalating bid history for each sold player; final/highest bid is
    // by the winning participant at sold_price.
    const bidRows = [];
    for (const sale of sales) {
      const item = insertedItems.find((it) => it.order_index === sale.player);
      const soldPrice = item.sold_price;
      const base = item.base_price;
      const winner = participantIds[sale.winner];
      // Pick a runner-up team that isn't the winner.
      const runnerUp = participantIds.find((pid) => pid !== winner);
      const step = Math.round((soldPrice - base) / 2);

      // 3 escalating bids ending at the winning bid.
      bidRows.push(
        { room_id: room.id, item_id: item.id, participant_id: runnerUp, amount: base },
        {
          room_id: room.id,
          item_id: item.id,
          participant_id: winner,
          amount: base + step,
        },
        {
          room_id: room.id,
          item_id: item.id,
          participant_id: winner,
          amount: soldPrice,
        },
      );
    }
    const { error: bidsError } = await supabase.from("bids").insert(bidRows);
    if (bidsError) throw bidsError;

    // Update each participant's remaining budget by what they spent.
    for (let i = 0; i < participantIds.length; i++) {
      const { error } = await supabase
        .from("room_participants")
        .update({ budget_remaining: TEAM_BUDGET - spentByTeam[i] })
        .eq("id", participantIds[i]);
      if (error) throw error;
    }

    console.log(
      "✓ created DEMO02 with 6 players (4 sold, 2 unsold), 3 teams, bid history",
    );
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
