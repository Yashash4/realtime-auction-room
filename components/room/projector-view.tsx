"use client";

import { Megaphone, MegaphoneOff, Radio, Trophy, Volume2, VolumeX } from "lucide-react";
import { useAuctionRoom } from "@/lib/hooks/use-auction-room";
import { useAuctioneer } from "@/lib/hooks/use-auctioneer";
import { useMuted } from "@/lib/sound";
import { useVoice } from "@/lib/auctioneer/narrator";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { TimerRing } from "@/components/room/timer-ring";
import { CommentaryFeed } from "@/components/room/commentary-feed";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** Read-only big-screen broadcast view. Mirrors live state via the same hook. */
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

  // Drive commentary + voice on the big screen too.
  useAuctioneer({ room, items, currentItem, itemBids, participants, nowMs });

  const [muted, toggleMuted] = useMuted();
  const [voice, toggleVoice] = useVoice();

  const paused = room.status === "paused";
  const endMs = room.item_ends_at ? new Date(room.item_ends_at).getTime() : 0;
  const msRemaining = paused ? (room.paused_remaining_ms ?? 0) : Math.max(0, endMs - nowMs);
  const sortedTeams = [...participants].sort((a, b) => b.budget_remaining - a.budget_remaining);
  const sold = items.filter((i) => i.status === "sold");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-8 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold leading-tight">{room.name}</h1>
          <p className="font-mono text-sm tracking-widest text-muted-foreground">{room.code}</p>
        </div>
        <div className="flex items-center gap-5">
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

      <main className="grid flex-1 lg:grid-cols-[1fr_28rem]">
        {/* Main stage */}
        <section className="flex flex-col items-center justify-center gap-8 px-10 py-8">
          {room.status === "lobby" ? (
            <div className="text-center">
              <p className="text-2xl text-muted-foreground">Waiting for the auction to begin</p>
              <p className="mt-6 font-mono text-7xl font-bold tracking-[0.2em]">{room.code}</p>
              <p className="mt-6 text-2xl text-muted-foreground">
                {items.length} players · {participants.length} teams
              </p>
            </div>
          ) : room.status === "completed" ? (
            <div className="flex flex-col items-center text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                <Trophy className="size-10" />
              </div>
              <p className="mt-6 text-5xl font-bold">Auction complete</p>
              <p className="mt-3 text-2xl text-muted-foreground">
                {sold.length} sold · {items.length - sold.length} unsold
              </p>
            </div>
          ) : currentItem ? (
            <>
              {paused && (
                <span className="rounded-full bg-amber-500/15 px-4 py-1.5 text-lg font-medium text-amber-400">Paused</span>
              )}
              <div className="flex size-40 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-6xl font-semibold text-primary ring-1 ring-primary/25">
                {initials(currentItem.name)}
              </div>
              <div className="text-center">
                <h2 className="text-6xl font-bold tracking-tight">{currentItem.name}</h2>
                <p className="mt-3 text-2xl text-muted-foreground">
                  {[currentItem.role, currentItem.country, `Base ${formatMoney(room.currency, currentItem.base_price)}`].filter(Boolean).join("  ·  ")}
                </p>
              </div>

              <TimerRing msRemaining={msRemaining} totalMs={room.timer_seconds * 1000} paused={paused} className="size-64" numberClassName="text-8xl" />

              <div className="text-center">
                <p className="text-xl uppercase tracking-[0.3em] text-muted-foreground">Current bid</p>
                <p className="mt-2 text-8xl font-black tabular-nums">
                  {formatMoney(room.currency, highest?.amount ?? currentItem.base_price)}
                </p>
                <p className="mt-3 text-3xl">
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

        {/* Teams + commentary */}
        <aside className="flex flex-col border-t lg:border-l lg:border-t-0">
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Teams</h3>
            <ul className="space-y-2">
              {sortedTeams.map((p) => {
                const leading = p.id === highest?.participant_id;
                return (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 ${leading ? "bg-primary/10 ring-1 ring-primary/30" : "bg-card"}`}
                  >
                    <span className="flex items-center gap-2 text-2xl font-medium">
                      {p.team_name}
                      {leading && <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-semibold uppercase text-primary">leading</span>}
                    </span>
                    <span className="text-2xl tabular-nums text-muted-foreground">{formatMoney(room.currency, p.budget_remaining)}</span>
                  </li>
                );
              })}
              {sortedTeams.length === 0 && <li className="text-xl text-muted-foreground">No teams yet.</li>}
            </ul>
          </div>
          <div className="border-t p-4">
            <CommentaryFeed />
          </div>
        </aside>
      </main>
    </div>
  );
}
