import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateRoomDialog } from "@/components/dashboard/create-room-dialog";
import { JoinRoomForm } from "@/components/dashboard/join-room-form";
import { RoomCard, type RoomCardData } from "@/components/dashboard/room-card";
import { LiveNow, type LiveRoom } from "@/components/dashboard/live-now";
import type { Room } from "@/lib/types";

export const dynamic = "force-dynamic";

type RoomWithCount = Pick<Room, "id" | "code" | "name" | "status" | "admin_id" | "is_demo"> & {
  items: { count: number }[];
};

const count = (r: RoomWithCount) => r.items?.[0]?.count ?? 0;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Disambiguate the embed: rooms has TWO relationships to items (items.room_id
  // and rooms.current_item_id), so PostgREST needs the explicit FK to count players.
  const select = "id, code, name, status, admin_id, is_demo, items!items_room_id_fkey(count)";

  // Rooms I host, rooms I joined, the public demos, and every in-progress room.
  const [{ data: hosted }, { data: memberships }, { data: demos }, { data: active }] = await Promise.all([
    supabase.from("rooms").select(select).eq("admin_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("room_participants")
      .select(`rooms(${select})`)
      .eq("user_id", user.id),
    supabase.from("rooms").select(select).eq("is_demo", true).order("created_at", { ascending: false }),
    supabase
      .from("rooms")
      .select("id, code, name, admin_id, currentItem:items!rooms_current_item_fk(name)")
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false }),
  ]);

  // "Live now" list (host names need a separate lookup — no rooms→profiles FK).
  type ActiveRow = { id: string; code: string; name: string; admin_id: string; currentItem: { name: string } | { name: string }[] | null };
  const activeRows = (active ?? []) as ActiveRow[];
  const liveAdminIds = [...new Set(activeRows.map((r) => r.admin_id))];
  const { data: liveHosts } = liveAdminIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", liveAdminIds)
    : { data: [] as { id: string; display_name: string }[] };
  const liveHostBy = new Map((liveHosts ?? []).map((p) => [p.id, p.display_name]));
  const liveInitial: LiveRoom[] = activeRows.map((r) => {
    const ci = Array.isArray(r.currentItem) ? r.currentItem[0] : r.currentItem;
    return { id: r.id, code: r.code, name: r.name, host: liveHostBy.get(r.admin_id) ?? "Host", currentPlayer: ci?.name ?? null };
  });

  const joined = (memberships ?? [])
    .flatMap((m) => (m as unknown as { rooms: RoomWithCount | null }).rooms ?? [])
    .filter(Boolean);

  // Merge host + joined into "my rooms", de-duplicated by id.
  const myMap = new Map<string, RoomCardData>();
  for (const r of (hosted ?? []) as RoomWithCount[]) {
    myMap.set(r.id, { code: r.code, name: r.name, status: r.status, itemCount: count(r), role: "Host" });
  }
  for (const r of joined as RoomWithCount[]) {
    if (!myMap.has(r.id)) {
      myMap.set(r.id, { code: r.code, name: r.name, status: r.status, itemCount: count(r), role: "Team" });
    }
  }
  const myRooms = [...myMap.values()];

  const demoRooms: RoomCardData[] = ((demos ?? []) as RoomWithCount[])
    .filter((r) => !myMap.has(r.id))
    .map((r) => ({ code: r.code, name: r.name, status: r.status, itemCount: count(r), role: "Demo" }));

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Your auction rooms</h1>
          <p className="text-sm text-muted-foreground">Create a room to host, or join one with a code.</p>
        </div>
        <CreateRoomDialog />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Join a room</h2>
        <JoinRoomForm />
      </section>

      <LiveNow initial={liveInitial} />

      <section className="space-y-4">
        <h2 className="font-medium">Your rooms</h2>
        {myRooms.length === 0 ? (
          <EmptyState text="You haven't created or joined any rooms yet. Create one above or try a demo room below." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myRooms.map((r) => (
              <RoomCard key={r.code} room={r} />
            ))}
          </div>
        )}
      </section>

      {demoRooms.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-medium">Demo rooms</h2>
            <p className="text-sm text-muted-foreground">Open to everyone — great for trying a live bid in two windows.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {demoRooms.map((r) => (
              <RoomCard key={r.code} room={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
