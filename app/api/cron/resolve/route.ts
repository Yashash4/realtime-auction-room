import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Room } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Best-effort backstop sweep. Live rooms resolve instantly via the client
 * trigger; this only catches items left expired in abandoned rooms. On Vercel
 * Hobby this runs ~once/day (per-minute cron is Pro-only), so it is NOT the
 * primary timing mechanism. Guarded by CRON_SECRET (Vercel sends it as Bearer).
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("id")
    .eq("status", "active")
    .lte("item_ends_at", new Date().toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let resolvedItems = 0;
  for (const r of rooms ?? []) {
    // Drain any back-to-back expired items in this room (resolve advances one).
    for (let i = 0; i < 100; i++) {
      const { data } = await supabase.rpc("resolve_current_item", { p_room: r.id });
      resolvedItems++;
      const room = data as Room | null;
      if (!room || room.status !== "active" || !room.item_ends_at) break;
      if (new Date(room.item_ends_at).getTime() > Date.now()) break;
    }
  }

  return NextResponse.json({ ok: true, sweptRooms: rooms?.length ?? 0, resolvedItems });
}
