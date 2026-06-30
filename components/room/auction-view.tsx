"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ListOrdered, Mic, Timer, Trophy, Users, type LucideIcon } from "lucide-react";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { playBeep } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { PlayerCard } from "@/components/room/player-card";
import { TimerRing } from "@/components/room/timer-ring";
import { BidPanel } from "@/components/room/bid-panel";
import { AdminControls } from "@/components/room/admin-controls";
import { CommentaryFeed } from "@/components/room/commentary-feed";
import { TeamsPanel } from "@/components/room/teams-panel";
import { PlayerList } from "@/components/room/player-list";
import { ReactionsLayer } from "@/components/room/reactions-layer";

type Tab = "teams" | "players" | "live";

/**
 * Live auction screen. Fits ONE viewport: the left column holds the player +
 * timer + current bid + bid button (the bid flow never scrolls — the stage
 * shrinks, the bid panel is pinned visible). The right column is a tabbed
 * sidebar (teams / players / commentary) that scrolls on its own.
 */
export function AuctionView({
  room,
  items,
  currentItem,
  itemBids,
  participants,
  isAdmin,
  myParticipant,
  nowMs,
}: {
  room: Room;
  items: Item[];
  currentItem: Item | null;
  itemBids: Bid[]; // highest first
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

  const soldByTeam = new Map<string, number>();
  for (const it of items) if (it.status === "sold" && it.sold_to) soldByTeam.set(it.sold_to, (soldByTeam.get(it.sold_to) ?? 0) + 1);
  const myOwned = myParticipant ? (soldByTeam.get(myParticipant.id) ?? 0) : 0;
  const idx = items.findIndex((i) => i.id === room.current_item_id);

  const iAmHighest = !!myParticipant && highest?.participant_id === myParticipant.id;
  const iBidThisItem = !!myParticipant && itemBids.some((b) => b.participant_id === myParticipant.id);
  const myStatus: "winning" | "outbid" | null =
    isAdmin || !myParticipant ? null : iAmHighest ? "winning" : iBidThisItem ? "outbid" : null;

  const [tab, setTab] = useState<Tab>("teams");

  // Toast when I lose a lead I held (per item).
  const prevWinning = useRef<{ id: string | null; winning: boolean }>({ id: null, winning: false });
  useEffect(() => {
    const id = currentItem?.id ?? null;
    if (prevWinning.current.id === id && prevWinning.current.winning && !iAmHighest && iBidThisItem) {
      toast.error("You've been outbid!");
    }
    prevWinning.current = { id, winning: iAmHighest };
  }, [iAmHighest, iBidThisItem, currentItem?.id]);

  // Anti-snipe: show the inline "+time" badge ONLY when item_ends_at actually
  // moved forward for the same active player. (No per-bid toast — that fired on
  // nearly every bid since most bids land inside the anti-snipe window.)
  const [extended, setExtended] = useState(false);
  const prevEnds = useRef<{ id: string | null; ends: number; status: string }>({ id: null, ends: 0, status: "" });
  useEffect(() => {
    const id = currentItem?.id ?? null;
    const prev = prevEnds.current;
    if (prev.id === id && prev.status === "active" && room.status === "active" && endMs > prev.ends + 500) {
      setExtended(true);
      const t = setTimeout(() => setExtended(false), 1800);
      prevEnds.current = { id, ends: endMs, status: room.status };
      return () => clearTimeout(t);
    }
    prevEnds.current = { id, ends: endMs, status: room.status };
  }, [endMs, currentItem?.id, room.status]);

  // Soft beep in the final 5s.
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
    return <div className="grid h-[calc(100vh-3.5rem)] place-items-center text-muted-foreground">Loading current player…</div>;
  }

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: "teams", label: "Teams", icon: Users },
    { key: "players", label: "Players", icon: ListOrdered },
    { key: "live", label: "Live", icon: Mic },
  ];

  return (
    <div className="mx-auto grid h-[calc(100vh-3.5rem)] w-full max-w-7xl gap-4 overflow-hidden px-4 py-3 lg:grid-cols-[1fr_22rem]">
      {/* MAIN — the full bid flow, always visible without scrolling */}
      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-center gap-2 text-xs">
          {idx >= 0 && (
            <span className="font-medium uppercase tracking-wide text-muted-foreground">
              Player {idx + 1} of {items.length}
            </span>
          )}
          {room.round > 1 && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">Round {room.round}</span>}
          {paused && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-400">Paused by admin</span>}
        </div>

        {/* Stage — shrinks to fit; never pushes the bid panel off-screen. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-b from-card to-card/60 p-4 shadow-xl">
          <PlayerCard item={currentItem} currency={room.currency} compact />
          <div className="relative">
            <TimerRing msRemaining={msRemaining} totalMs={totalMs} paused={paused} className="size-28" numberClassName="text-2xl" />
            {extended && (
              <span className="absolute -top-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-lg duration-300 animate-in fade-in slide-in-from-bottom-1">
                <Timer className="size-3" /> +time
              </span>
            )}
          </div>
          <div className="w-full max-w-sm rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Current bid</p>
            <p className="text-3xl font-black leading-tight tabular-nums xl:text-4xl">
              <span key={highest?.id ?? "base"} className="inline-block animate-bid-flash">
                {formatAmount(highest?.amount ?? currentItem.base_price, room.currency)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {highest ? `Leading: ${teamNameById.get(highest.participant_id) ?? "Team"}` : "No bids yet"}
            </p>
          </div>
        </div>

        {myStatus === "winning" && (
          <div className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-bold text-emerald-400">
            <Trophy className="size-4" /> You&apos;re winning this player
          </div>
        )}
        {myStatus === "outbid" && (
          <div className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4" /> You&apos;ve been outbid
          </div>
        )}

        {/* Bid button (or admin controls) — pinned, always visible. */}
        <div className="shrink-0">
          {isAdmin ? (
            <AdminControls room={room} />
          ) : (
            <BidPanel
              room={room}
              item={currentItem}
              highest={highest}
              myParticipant={myParticipant}
              isAdmin={isAdmin}
              open={open}
              myOwned={myOwned}
            />
          )}
        </div>
      </section>

      {/* SIDEBAR — tabbed, scrolls on its own without moving the bid area. */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card/40">
        <div className="flex shrink-0 gap-1 border-b p-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                  tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/40",
                )}
              >
                <Icon className="size-4" /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === "teams" && (
            <TeamsPanel
              participants={participants}
              items={items}
              currency={room.currency}
              highlightId={highest?.participant_id}
              myParticipantId={myParticipant?.id}
              maxPerTeam={room.max_players_per_team}
            />
          )}
          {tab === "players" && (
            <PlayerList items={items} participants={participants} currency={room.currency} currentItemId={room.current_item_id} />
          )}
          {tab === "live" && <CommentaryFeed className="h-full" />}
        </div>
      </aside>

      <ReactionsLayer roomId={room.id} />
    </div>
  );
}
