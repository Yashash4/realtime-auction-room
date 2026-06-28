import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AuctionRoom } from "@/components/room/auction-room";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS only returns the room if it's a demo, or the user is its admin/participant.
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return <RoomNotFound />;

  const [{ data: items }, { data: participants }, { data: bids }] = await Promise.all([
    supabase.from("items").select("*").eq("room_id", room.id).order("order_index"),
    supabase.from("room_participants").select("*").eq("room_id", room.id),
    supabase.from("bids").select("*").eq("room_id", room.id).order("created_at"),
  ]);

  return (
    <AuctionRoom
      initial={{
        room: room as Room,
        items: (items ?? []) as Item[],
        participants: (participants ?? []) as Participant[],
        bids: (bids ?? []) as Bid[],
      }}
      userId={user.id}
      isAdmin={(room as Room).admin_id === user.id}
    />
  );
}

function RoomNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Room not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This room doesn&apos;t exist, or it&apos;s private and you haven&apos;t joined it. Use the room code on your dashboard to join.
        </p>
      </div>
      <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
    </main>
  );
}
