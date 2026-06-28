"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Copy, Radio } from "lucide-react";
import { useAuctionRoom } from "@/lib/hooks/use-auction-room";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LobbyView } from "@/components/room/lobby-view";
import { AuctionView } from "@/components/room/auction-view";
import { CompletedView } from "@/components/room/completed-view";

export function AuctionRoom({
  initial,
  userId,
  isAdmin,
}: {
  initial: { room: Room; items: Item[]; participants: Participant[]; bids: Bid[] };
  userId: string;
  isAdmin: boolean;
}) {
  const { room, items, participants, bids, conn, nowMs } = useAuctionRoom(initial);

  const myParticipant = participants.find((p) => p.user_id === userId) ?? null;
  const currentItem = items.find((i) => i.id === room.current_item_id) ?? null;
  const itemBids = currentItem
    ? bids
        .filter((b) => b.item_id === currentItem.id)
        .sort((a, b) => b.amount - a.amount || b.created_at.localeCompare(a.created_at))
    : [];

  const copyCode = () => {
    navigator.clipboard.writeText(room.code).then(
      () => toast.success("Room code copied"),
      () => toast.error("Couldn't copy"),
    );
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard" />} aria-label="Back to dashboard">
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-semibold leading-tight">{room.name}</h1>
              <button onClick={copyCode} className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground">
                {room.code} <Copy className="size-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Admin</span>
            )}
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={`Realtime: ${conn}`}
            >
              <Radio className={`size-3.5 ${conn === "live" ? "text-green-500" : conn === "error" ? "text-destructive" : "text-amber-500"}`} />
              {conn === "live" ? "Live" : conn === "error" ? "Reconnecting" : "Connecting"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {room.status === "lobby" ? (
          <LobbyView
            room={room}
            items={items}
            participants={participants}
            isAdmin={isAdmin}
            myParticipant={myParticipant}
          />
        ) : room.status === "completed" ? (
          <CompletedView room={room} items={items} participants={participants} />
        ) : (
          <AuctionView
            room={room}
            currentItem={currentItem}
            itemBids={itemBids}
            participants={participants}
            isAdmin={isAdmin}
            myParticipant={myParticipant}
            nowMs={nowMs}
          />
        )}
      </main>
    </div>
  );
}
