import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
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
      .eq("is_public", true)
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

  // Sold-player counts drive the per-room progress bar on active rooms. One
  // grouped read across every room we're about to render (host + joined + demo).
  const allRooms = [...(hosted ?? []), ...joined, ...(demos ?? [])] as RoomWithCount[];
  const roomIds = [...new Set(allRooms.map((r) => r.id))];
  const { data: soldRows } = roomIds.length
    ? await supabase.from("items").select("room_id").eq("status", "sold").in("room_id", roomIds)
    : { data: [] as { room_id: string }[] };
  const soldBy = new Map<string, number>();
  for (const s of (soldRows ?? []) as { room_id: string }[]) {
    soldBy.set(s.room_id, (soldBy.get(s.room_id) ?? 0) + 1);
  }

  // Merge host + joined into "my rooms", de-duplicated by id.
  const myMap = new Map<string, RoomCardData>();
  for (const r of (hosted ?? []) as RoomWithCount[]) {
    myMap.set(r.id, { code: r.code, name: r.name, status: r.status, itemCount: count(r), soldCount: soldBy.get(r.id) ?? 0, role: "Host" });
  }
  for (const r of joined as RoomWithCount[]) {
    if (!myMap.has(r.id)) {
      myMap.set(r.id, { code: r.code, name: r.name, status: r.status, itemCount: count(r), soldCount: soldBy.get(r.id) ?? 0, role: "Team" });
    }
  }
  const myRooms = [...myMap.values()];

  const demoRooms: RoomCardData[] = ((demos ?? []) as RoomWithCount[])
    .filter((r) => !myMap.has(r.id))
    .map((r) => ({ code: r.code, name: r.name, status: r.status, itemCount: count(r), soldCount: soldBy.get(r.id) ?? 0, role: "Demo" }));

  return (
    <div className="space-y-12">
      <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-card p-8 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,color-mix(in_oklch,var(--color-primary)_14%,transparent),transparent_60%)]"
        />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight">Your auction rooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a room to host, or join one with a code.</p>
        </div>
        <div className="relative">
          <CreateRoomDialog />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Join a room</h2>
        <JoinRoomForm />
      </section>

      <LiveNow initial={liveInitial} />

      <section className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight">Your rooms</h2>
        {myRooms.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myRooms.map((r) => (
              <RoomCard key={r.code} room={r} />
            ))}
          </div>
        )}
      </section>

      {demoRooms.length > 0 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Demo rooms</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open to everyone — great for trying a live bid in two windows.</p>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-muted/20 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Gavel className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">No rooms yet</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Host your first auction or join an existing one with a room code. Try a demo room below to see it live.
        </p>
      </div>
      <CreateRoomDialog />
    </div>
  );
}
