"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Timer, Trophy } from "lucide-react";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { playBeep } from "@/lib/sound";
import { PlayerCard } from "@/components/room/player-card";
import { TimerRing } from "@/components/room/timer-ring";
import { BidPanel } from "@/components/room/bid-panel";
import { BidHistory } from "@/components/room/bid-history";
import { TeamBudgets } from "@/components/room/team-budgets";
import { AdminControls } from "@/components/room/admin-controls";
import { CommentaryFeed } from "@/components/room/commentary-feed";
import { ReactionsLayer } from "@/components/room/reactions-layer";

export function AuctionView({
  room,
  currentItem,
  itemBids,
  participants,
  isAdmin,
  myParticipant,
  nowMs,
}: {
  room: Room;
  currentItem: Item | null;
  itemBids: Bid[]; // newest first
  participants: Participant[];
  isAdmin: boolean;
  myParticipant: Participant | null;
  nowMs: number;
}) {
  const teamNameById = new Map(participants.map((p) => [p.id, p.team_name]));
  const highest = itemBids[0] ?? null;

  const paused = room.status === "paused";
  const endMs = room.item_ends_at ? new Date(room.item_ends_at).getTime() : 0;
  const msRemaining = paused ? (room.paused_remaining_ms ?? 0) : Math.max(0, endMs - nowMs);
  const totalMs = room.timer_seconds * 1000;
  const open = room.status === "active" && msRemaining > 0;

  // Am I winning / outbid on this player?
  const iAmHighest = !!myParticipant && highest?.participant_id === myParticipant.id;
  const iBidThisItem = !!myParticipant && itemBids.some((b) => b.participant_id === myParticipant.id);
  const myStatus: "winning" | "outbid" | null =
    isAdmin || !myParticipant ? null : iAmHighest ? "winning" : iBidThisItem ? "outbid" : null;

  // Toast when I lose the lead I previously held (per item).
  const prevWinning = useRef<{ id: string | null; winning: boolean }>({ id: null, winning: false });
  useEffect(() => {
    const id = currentItem?.id ?? null;
    if (prevWinning.current.id === id && prevWinning.current.winning && !iAmHighest && iBidThisItem) {
      toast.error("You've been outbid!");
    }
    prevWinning.current = { id, winning: iAmHighest };
  }, [iAmHighest, iBidThisItem, currentItem?.id]);

  // Anti-snipe feedback: the timer was bumped forward for the SAME active player
  // (and we weren't just resuming from pause) -> a late bid extended the clock.
  const [extended, setExtended] = useState(false);
  const prevEnds = useRef<{ id: string | null; ends: number; status: string }>({ id: null, ends: 0, status: "" });
  useEffect(() => {
    const id = currentItem?.id ?? null;
    const prev = prevEnds.current;
    if (
      prev.id === id &&
      prev.status === "active" &&
      room.status === "active" &&
      endMs > prev.ends + 500
    ) {
      toast.info("Time extended — a late bid!", { icon: "⏱" });
      setExtended(true);
      const t = setTimeout(() => setExtended(false), 1800);
      prevEnds.current = { id, ends: endMs, status: room.status };
      return () => clearTimeout(t);
    }
    prevEnds.current = { id, ends: endMs, status: room.status };
  }, [endMs, currentItem?.id, room.status]);

  // Soft beep once per second in the final 5s (gated by the mute toggle inside playBeep).
  const lastBeep = useRef(-1);
  useEffect(() => {
    if (room.status !== "active") {
      lastBeep.current = -1;
      return;
    }
    const secs = Math.ceil(msRemaining / 1000);
    if (secs >= 1 && secs <= 5 && secs !== lastBeep.current) {
      lastBeep.current = secs;
      playBeep();
    }
  }, [msRemaining, room.status]);

  if (!currentItem) {
    return <p className="py-20 text-center text-muted-foreground">Loading current player…</p>;
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-6 rounded-xl border bg-card p-8">
          {room.round > 1 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Round {room.round} · unsold players
            </span>
          )}
          {paused && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              Paused by admin
            </span>
          )}
          <PlayerCard item={currentItem} currency={room.currency} />

          <div className="relative">
            <TimerRing msRemaining={msRemaining} totalMs={totalMs} paused={paused} />
            {extended && (
              <span className="absolute -top-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-lg duration-300 animate-in fade-in slide-in-from-bottom-1">
                <Timer className="size-3" /> +time
              </span>
            )}
          </div>

          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current bid</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {formatAmount(highest?.amount ?? currentItem.base_price, room.currency)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {highest ? `Leading: ${teamNameById.get(highest.participant_id) ?? "Team"}` : "No bids yet"}
            </p>
          </div>
        </div>

        {myStatus === "winning" && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm font-semibold text-green-600 duration-200 animate-in fade-in dark:text-green-400">
            <Trophy className="size-4" /> You&apos;re winning this player
          </div>
        )}
        {myStatus === "outbid" && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive duration-200 animate-in fade-in">
            <AlertTriangle className="size-4" /> You&apos;ve been outbid
          </div>
        )}

        <BidPanel
          room={room}
          item={currentItem}
          highest={highest}
          myParticipant={myParticipant}
          isAdmin={isAdmin}
          open={open}
        />

        <BidHistory bids={itemBids} teamNameById={teamNameById} currency={room.currency} />
      </div>

      <div className="space-y-6">
        {isAdmin && <AdminControls room={room} />}
        <TeamBudgets
          participants={participants}
          currency={room.currency}
          highlightId={highest?.participant_id}
          myParticipantId={myParticipant?.id}
        />
        <CommentaryFeed />
      </div>

      <ReactionsLayer roomId={room.id} />
    </div>
  );
}
