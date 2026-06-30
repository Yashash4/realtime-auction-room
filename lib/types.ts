// Hand-written DB row types mirroring supabase/migrations. Kept in sync with
// the schema by hand (small surface; avoids a codegen step).

export type RoomStatus = "lobby" | "active" | "paused" | "completed";
export type ItemStatus = "pending" | "active" | "sold" | "unsold";

/** One increment tier: at prices >= min_price, the bid step is `step`. */
export type IncrementTier = { min_price: number; step: number };

export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  admin_id: string;
  status: RoomStatus;
  current_item_id: string | null;
  item_ends_at: string | null;
  paused_remaining_ms: number | null;
  team_budget: number;
  currency: string;
  increment_tiers: IncrementTier[];
  timer_seconds: number;
  anti_snipe_seconds: number;
  round: number;
  is_demo: boolean;
  created_at: string;
};

export type Participant = {
  id: string;
  room_id: string;
  user_id: string;
  team_name: string;
  budget_remaining: number;
  joined_at: string;
};

export type Item = {
  id: string;
  room_id: string;
  name: string;
  role: string | null;
  country: string | null;
  base_price: number;
  image_url: string | null;
  order_index: number;
  status: ItemStatus;
  sold_to: string | null;
  sold_price: number | null;
  created_at: string;
};

export type Bid = {
  id: string;
  room_id: string;
  item_id: string;
  participant_id: string;
  amount: number;
  created_at: string;
};

export type AuctionEventType =
  | "auction_started"
  | "bid_placed"
  | "timer_extended"
  | "sold"
  | "unsold"
  | "round_started";

/** Append-only log row (see supabase/migrations/0007). For replay + analytics. */
export type AuctionEvent = {
  id: number;
  room_id: string;
  item_id: string | null;
  participant_id: string | null;
  type: AuctionEventType;
  amount: number | null;
  data: Record<string, unknown>;
  created_at: string;
};

/** Pick the bid increment for a current price (mirrors SQL tier_step). */
export function tierStep(tiers: IncrementTier[], price: number): number {
  const applicable = tiers
    .filter((t) => t.min_price <= price)
    .sort((a, b) => b.min_price - a.min_price)[0];
  return applicable?.step ?? tiers[0]?.step ?? 0;
}

/**
 * Minimum allowed next bid given the current highest bid (or null for the
 * opening bid, where the floor is the item's base price).
 */
export function minNextBid(
  tiers: IncrementTier[],
  currentHigh: number | null,
  basePrice: number,
): number {
  if (currentHigh == null) return basePrice;
  return currentHigh + tierStep(tiers, currentHigh);
}
