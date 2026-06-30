"use client";

import { Megaphone, MegaphoneOff, Radio, Trophy, Volume2, VolumeX } from "lucide-react";
import { useAuctionRoom } from "@/lib/hooks/use-auction-room";
import { useAuctioneer } from "@/lib/hooks/use-auctioneer";
import { useMuted } from "@/lib/sound";
import { useVoice } from "@/lib/auctioneer/narrator";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { TimerRing } from "@/components/room/timer-ring";
import { BidHistory } from "@/components/room/bid-history";
import { CommentaryFeed } from "@/components/room/commentary-feed";
import { ReactionsLayer } from "@/components/room/reactions-layer";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/**
 * Single read-only live view — used both for watching a match and as the
 * cast/projector screen. Big and legible on a normal screen, scales up on a TV
 * (xl: breakpoint). No bid panel, no admin controls. Mirrors live state via the
 * same realtime hook, and runs the auctioneer so it narrates too.
 */
export function ProjectorView({
  initial,
  userId,
}: {
  initial: { room: Room; items: Item[]; participants: Participant[]; bids: Bid[] };
  userId: string;
}) {
  const { room, items, participants, bids, conn, nowMs, watching } = useAuctionRoom(initial, userId);
  const currentItem = items.find((i) => i.id === room.current_item_id) ?? null;
  const itemBids = currentItem
    ? bids.filter((b) => b.item_id === currentItem.id).sort((a, b) => b.amount - a.amount || b.created_at.localeCompare(a.created_at))
    : [];
  const highest = itemBids[0] ?? null;
  const teamNameById = new Map(participants.map((p) => [p.id, p.team_name]));

  useAuctioneer({ room, items, currentItem, itemBids, participants, nowMs });

  const [muted, toggleMuted] = useMuted();
  const [voice, toggleVoice] = useVoice();

  const paused = room.status === "paused";
  const endMs = room.item_ends_at ? new Date(room.item_ends_at).getTime() : 0;
  const msRemaining = paused ? (room.paused_remaining_ms ?? 0) : Math.max(0, endMs - nowMs);
  const sortedTeams = [...participants].sort((a, b) => b.budget_remaining - a.budget_remaining);
  const soldCount = items.filter((i) => i.status === "sold").length;
  const live = room.status === "active" || room.status === "paused";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-3 xl:px-8 xl:py-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-tight xl:text-2xl">{room.name}</h1>
          <p className="font-mono text-xs tracking-widest text-muted-foreground xl:text-sm">
            {room.code}
            {room.round > 1 && <span className="ml-2 text-primary">· Round {room.round}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4 xl:gap-5">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className={`size-4 ${conn === "live" ? "text-green-500" : conn === "error" ? "text-destructive" : "text-amber-500"}`} />
            {conn === "live" ? "Live" : conn === "error" ? "Reconnecting" : "Connecting"} · {watching} watching
          </span>
          <button onClick={toggleVoice} aria-label="Toggle auctioneer voice" className="text-muted-foreground hover:text-foreground">
            {voice ? <Megaphone className="size-5" /> : <MegaphoneOff className="size-5" />}
          </button>
          <button onClick={toggleMuted} aria-label="Toggle sound" className="text-muted-foreground hover:text-foreground">
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>
      </header>

      <main className="grid flex-1 lg:grid-cols-[1fr_26rem] xl:grid-cols-[1fr_30rem]">
        {/* Stage */}
        <section className="flex flex-col items-center justify-center gap-4 px-8 py-6 xl:gap-8 xl:px-10 xl:py-10">
          {room.status === "lobby" ? (
            <div className="text-center">
              <p className="text-xl text-muted-foreground xl:text-2xl">Waiting for the auction to begin</p>
              <p className="mt-6 font-mono text-6xl font-bold tracking-[0.2em] xl:text-7xl">{room.code}</p>
              <p className="mt-6 text-xl text-muted-foreground xl:text-2xl">
                {items.length} players · {participants.length} teams
              </p>
            </div>
          ) : room.status === "completed" ? (
            <div className="flex flex-col items-center text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                <Trophy className="size-10" />
              </div>
              <p className="mt-6 text-4xl font-bold xl:text-5xl">Auction complete</p>
              <p className="mt-3 text-xl text-muted-foreground xl:text-2xl">
                {soldCount} sold · {items.length - soldCount} unsold
              </p>
            </div>
          ) : currentItem ? (
            <>
              {paused && (
                <span className="rounded-full bg-amber-500/15 px-4 py-1.5 text-base font-medium text-amber-400 xl:text-lg">Paused</span>
              )}
              <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-5xl font-semibold text-primary ring-1 ring-primary/25 xl:size-40 xl:text-6xl">
                {initials(currentItem.name)}
              </div>
              <div className="text-center">
                <h2 className="text-4xl font-bold tracking-tight xl:text-6xl">{currentItem.name}</h2>
                <p className="mt-2 text-lg text-muted-foreground xl:mt-3 xl:text-2xl">
                  {[currentItem.role, currentItem.country, `Base ${formatMoney(room.currency, currentItem.base_price)}`].filter(Boolean).join("  ·  ")}
                </p>
              </div>

              <TimerRing msRemaining={msRemaining} totalMs={room.timer_seconds * 1000} paused={paused} className="size-48 xl:size-64" numberClassName="text-6xl xl:text-8xl" />

              <div className="text-center">
                <p className="text-base uppercase tracking-[0.3em] text-muted-foreground xl:text-xl">Current bid</p>
                <p className="mt-2 text-6xl font-black tabular-nums xl:text-8xl">
                  {formatMoney(room.currency, highest?.amount ?? currentItem.base_price)}
                </p>
                <p className="mt-2 text-2xl xl:mt-3 xl:text-3xl">
                  {highest ? (
                    <span className="text-primary">{teamNameById.get(highest.participant_id) ?? "Team"}</span>
                  ) : (
                    <span className="text-muted-foreground">No bids yet</span>
                  )}
                </p>
              </div>
            </>
          ) : (
            <p className="text-2xl text-muted-foreground">Loading…</p>
          )}
        </section>

        {/* Teams · bid history · commentary */}
        <aside className="flex flex-col gap-4 overflow-y-auto border-t p-4 lg:border-l lg:border-t-0 xl:p-5">
          <div className="rounded-xl border bg-card">
            <h3 className="border-b px-4 py-3 text-sm font-medium">Teams</h3>
            <ul className="divide-y">
              {sortedTeams.map((p) => {
                const leading = p.id === highest?.participant_id;
                return (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-base xl:text-lg">
                    <span className="flex items-center gap-2 font-medium">
                      {p.team_name}
                      {leading && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">leading</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatMoney(room.currency, p.budget_remaining)}</span>
                  </li>
                );
              })}
              {sortedTeams.length === 0 && <li className="px-4 py-4 text-sm text-muted-foreground">No teams yet.</li>}
            </ul>
          </div>

          {live && <BidHistory bids={itemBids} teamNameById={teamNameById} currency={room.currency} />}
          <CommentaryFeed />
        </aside>
      </main>

      <ReactionsLayer roomId={room.id} />
    </div>
  );
}
