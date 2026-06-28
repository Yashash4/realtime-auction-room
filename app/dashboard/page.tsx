import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateRoomDialog } from "@/components/dashboard/create-room-dialog";
import { JoinRoomForm } from "@/components/dashboard/join-room-form";
import { RoomCard, type RoomCardData } from "@/components/dashboard/room-card";
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

  const select = "id, code, name, status, admin_id, is_demo, items(count)";

  // Rooms I host, rooms I joined as a team, and the public demo rooms.
  const [{ data: hosted }, { data: memberships }, { data: demos }] = await Promise.all([
    supabase.from("rooms").select(select).eq("admin_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("room_participants")
      .select(`rooms(${select})`)
      .eq("user_id", user.id),
    supabase.from("rooms").select(select).eq("is_demo", true).order("created_at", { ascending: false }),
  ]);

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
