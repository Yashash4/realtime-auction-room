// Thin typed wrappers over the auction RPC functions. These are the ONLY way
// the app mutates auction state — there is no direct table-write path (RLS
// forbids it). Each throws the Postgres RAISE EXCEPTION message, which is
// already human-readable and safe to show in a toast.

import { createClient } from "@/lib/supabase/client";
import type { Bid, Room } from "@/lib/types";

function rpc() {
  return createClient();
}

export async function joinRoom(code: string, teamName: string): Promise<Room> {
  const { data, error } = await rpc().rpc("join_room", {
    p_code: code.trim().toUpperCase(),
    p_team_name: teamName,
  });
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function placeBid(
  roomId: string,
  itemId: string,
  amount: number,
): Promise<Bid> {
  // Deterministic key: the same (item, amount) intent — so a double-click or
  // retry maps to one bid. Valid amounts strictly increase, so distinct bids
  // never collide on this key.
  const { data, error } = await rpc().rpc("place_bid", {
    p_room: roomId,
    p_item: itemId,
    p_amount: amount,
    p_key: `${itemId}:${amount}`,
  });
  if (error) throw new Error(error.message);
  return data as Bid;
}

export async function startAuction(roomId: string): Promise<Room> {
  const { data, error } = await rpc().rpc("start_auction", { p_room: roomId });
  if (error) throw new Error(error.message);
  return data as Room;
}

/** Idempotent — called by clients when their countdown hits zero. */
export async function resolveCurrentItem(roomId: string): Promise<Room> {
  const { data, error } = await rpc().rpc("resolve_current_item", {
    p_room: roomId,
  });
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function adminNextItem(roomId: string): Promise<Room> {
  const { data, error } = await rpc().rpc("admin_next_item", { p_room: roomId });
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function pauseAuction(roomId: string): Promise<Room> {
  const { data, error } = await rpc().rpc("pause_auction", { p_room: roomId });
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function resumeAuction(roomId: string): Promise<Room> {
  const { data, error } = await rpc().rpc("resume_auction", { p_room: roomId });
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function endAuction(roomId: string): Promise<Room> {
  const { data, error } = await rpc().rpc("end_auction", { p_room: roomId });
  if (error) throw new Error(error.message);
  return data as Room;
}
