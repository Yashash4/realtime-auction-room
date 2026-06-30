import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bid, Item, Participant, Room } from "@/lib/types";

export type RoomData = {
  userId: string;
  room: Room;
  items: Item[];
  participants: Participant[];
  bids: Bid[];
};

/**
 * Loads the initial snapshot for a room by code. Redirects to /login if signed
 * out; returns null if the room isn't visible to this user (RLS). Shared by the
 * room page and the projector page so they stay in sync.
 */
export async function loadRoom(code: string): Promise<RoomData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!room) return null;

  const [{ data: items }, { data: participants }, { data: bids }] = await Promise.all([
    supabase.from("items").select("*").eq("room_id", room.id).order("order_index"),
    supabase.from("room_participants").select("*").eq("room_id", room.id),
    supabase.from("bids").select("*").eq("room_id", room.id).order("created_at"),
  ]);

  return {
    userId: user.id,
    room: room as Room,
    items: (items ?? []) as Item[],
    participants: (participants ?? []) as Participant[],
    bids: (bids ?? []) as Bid[],
  };
}
