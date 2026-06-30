"use client";

import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { Crown, Eye, Megaphone, MegaphoneOff, Radio, Settings, Trophy, Users, Volume2, VolumeX } from "lucide-react";
import { useAuctionRoom } from "@/lib/hooks/use-auction-room";
import { useAuctioneer } from "@/lib/hooks/use-auctioneer";
import { useMuted } from "@/lib/sound";
import { useVoice } from "@/lib/auctioneer/narrator";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TimerRing } from "@/components/room/timer-ring";
import { BidHistory } from "@/components/room/bid-history";
import { CommentaryFeed } from "@/components/room/commentary-feed";
import { ReactionsLayer } from "@/components/room/reactions-layer";
import { VoiceSettings } from "@/components/room/voice-settings";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** Role → glow/ring colour classes (case-insensitive prefix match). */
function roleStyle(role: string | null): { ring: string; glow: string; chip: string } {
  const r = (role ?? "").toLowerCase();
  if (r.startsWith("bowl") || r.startsWith("all"))
    return { ring: "ring-emerald-400/50", glow: "shadow-[0_0_120px_-20px] shadow-emerald-500/50 from-emerald-500/25 to-emerald-500/0", chip: "bg-emerald-500/15 text-emerald-400" };
  if (r.startsWith("keep") || r.startsWith("wk"))
    return { ring: "ring-amber-400/50", glow: "shadow-[0_0_120px_-20px] shadow-amber-500/50 from-amber-500/25 to-amber-500/0", chip: "bg-amber-500/15 text-amber-400" };
  // "bat" and everything else → brand violet
  return { ring: "ring-primary/50", glow: "shadow-[0_0_120px_-20px] shadow-primary/60 from-primary/30 to-primary/0", chip: "bg-primary/15 text-primary" };
}

/** One settings popover grouping the sound/voice toggles + voice config.
 *  ponytail: local toggled panel (no Popover primitive exists); a transparent
 *  backdrop catches outside clicks to close. */
function SettingsPanel({
  voice,
  muted,
  toggleVoice,
  toggleMuted,
}: {
  voice: boolean;
  muted: boolean;
  toggleVoice: () => void;
  toggleMuted: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Sound & voice settings"
        aria-expanded={open}
        title="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings className="size-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
            <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sound &amp; voice</p>
            <button
              onClick={toggleVoice}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              {voice ? <Megaphone className="size-4 text-primary" /> : <MegaphoneOff className="size-4" />}
              {voice ? "Auctioneer voice: on" : "Auctioneer voice: off"}
            </button>
            <button
              onClick={toggleMuted}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-primary" />}
              {muted ? "Sound effects: off" : "Sound effects: on"}
            </button>
            <div className="my-1 h-px bg-border" />
            {/* Self-contained Dialog (own modal) — lives outside any menu primitive so it opens cleanly. */}
            <div className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted">
              <span>Voice options…</span>
              <VoiceSettings />
            </div>
          </div>
        </>
      )}
    </div>
  );
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
  const soldItems = items.filter((i) => i.status === "sold");
  const live = room.status === "active" || room.status === "paused";

  // Item position N/M by auction order.
  const orderedIds = [...items].sort((a, b) => a.order_index - b.order_index).map((i) => i.id);
  const itemPos = currentItem ? orderedIds.indexOf(currentItem.id) + 1 : 0;

  const role = roleStyle(currentItem?.role ?? null);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-3 xl:px-8 xl:py-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight leading-tight xl:text-3xl">{room.name}</h1>
          <p className="font-mono text-xs tracking-widest text-muted-foreground xl:text-sm">
            {room.code}
            {room.round > 1 && <span className="ml-2 text-primary">· Round {room.round}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 xl:gap-4">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium xl:text-base",
              conn === "live"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : conn === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400",
            )}
          >
            <Radio className={cn("size-4", conn === "live" && "animate-pulse")} />
            {conn === "live" ? "Live" : conn === "error" ? "Reconnecting" : "Connecting"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary xl:text-base">
            <Eye className="size-4" />
            <span className="tabular-nums">{watching}</span> watching
          </span>

          <SettingsPanel
            voice={voice}
            muted={muted}
            toggleVoice={toggleVoice}
            toggleMuted={toggleMuted}
          />
        </div>
      </header>

      <main className="grid flex-1 lg:grid-cols-[1fr_26rem] xl:grid-cols-[1fr_30rem]">
        {/* Stage */}
        <section className="relative flex flex-col items-center justify-center gap-4 px-8 py-6 xl:gap-8 xl:px-10 xl:py-10">
          {room.status === "lobby" ? (
            <LobbyWait room={room} participants={participants} itemCount={items.length} />
          ) : room.status === "completed" ? (
            <CompletedClimax
              participants={participants}
              soldItems={soldItems}
              items={items}
              currency={room.currency}
              teamNameById={teamNameById}
            />
          ) : currentItem ? (
            <>
              {paused && (
                <span className="rounded-full bg-amber-500/15 px-4 py-1.5 text-base font-medium text-amber-400 xl:text-lg">Paused</span>
              )}

              <span className="rounded-full border border-border bg-card px-4 py-1 text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground xl:text-base">
                Player <span className="text-foreground tabular-nums">{itemPos}</span> / {items.length}
              </span>

              <div
                className={cn(
                  "flex size-60 items-center justify-center rounded-full bg-gradient-to-br text-7xl font-black text-foreground ring-2 xl:size-72 xl:text-8xl",
                  role.ring,
                  role.glow,
                )}
              >
                {initials(currentItem.name)}
              </div>
              <div className="text-center">
                <h2 className="text-5xl font-black tracking-tight xl:text-7xl">{currentItem.name}</h2>
                <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-lg text-muted-foreground xl:text-2xl">
                  {currentItem.role && (
                    <span className={cn("rounded-full px-3 py-0.5 text-sm font-semibold uppercase tracking-wide xl:text-base", role.chip)}>
                      {currentItem.role}
                    </span>
                  )}
                  {[currentItem.country, `Base ${formatAmount(currentItem.base_price, room.currency)}`]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>

              <TimerRing
                msRemaining={msRemaining}
                totalMs={room.timer_seconds * 1000}
                paused={paused}
                className="size-56 xl:size-72"
                numberClassName="text-6xl xl:text-8xl"
              />

              <div className="text-center">
                <p className="text-base uppercase tracking-[0.3em] text-muted-foreground xl:text-xl">Current bid</p>
                <p
                  key={highest?.amount ?? currentItem.base_price}
                  className="mt-2 text-6xl font-black tracking-tight tabular-nums text-foreground animate-bid-flash xl:text-8xl"
                >
                  {formatAmount(highest?.amount ?? currentItem.base_price, room.currency)}
                </p>
                <p className="mt-2 text-2xl xl:mt-3 xl:text-3xl">
                  {highest ? (
                    <span className="font-bold text-primary">{teamNameById.get(highest.participant_id) ?? "Team"}</span>
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
                    <span className="tabular-nums text-muted-foreground">{formatAmount(p.budget_remaining, room.currency)}</span>
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

/** Atmospheric "starting soon" screen for the lobby phase. */
function LobbyWait({ room, participants, itemCount }: { room: Room; participants: Participant[]; itemCount: number }) {
  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center xl:gap-12">
      <div className="relative flex flex-col items-center gap-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.25em] text-primary xl:text-base">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          Waiting to start
        </span>
        <p className="text-xl font-medium text-muted-foreground xl:text-2xl">Teams — join with code</p>
        <p className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/0 px-10 py-6 font-mono text-7xl font-black tracking-[0.18em] text-foreground shadow-[0_0_140px_-30px] shadow-primary/60 xl:text-8xl">
          {room.code}
        </p>
      </div>

      <div className="w-full">
        <p className="mb-4 inline-flex items-center gap-2 text-base font-semibold uppercase tracking-[0.2em] text-muted-foreground xl:text-lg">
          <Users className="size-5 text-primary" />
          {participants.length} {participants.length === 1 ? "team" : "teams"} joined · {itemCount} players
        </p>
        {participants.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-3 xl:gap-4">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 xl:px-5 xl:py-3.5"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-lg font-black text-primary ring-1 ring-primary/30 xl:size-12">
                  {initials(p.team_name)}
                </span>
                <span className="text-lg font-bold xl:text-xl">{p.team_name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-lg text-muted-foreground xl:text-xl">No teams have joined yet. The room is open.</p>
        )}
      </div>
    </div>
  );
}

/** Celebratory finale: winning team huge, confetti, final stat callouts. */
function CompletedClimax({
  participants,
  soldItems,
  items,
  currency,
  teamNameById,
}: {
  participants: Participant[];
  soldItems: Item[];
  items: Item[];
  currency: string;
  teamNameById: Map<string, string>;
}) {
  // Total spent per team = sum of sold_price for items they won.
  const spentByTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of soldItems) {
      if (it.sold_to) m.set(it.sold_to, (m.get(it.sold_to) ?? 0) + (it.sold_price ?? 0));
    }
    return m;
  }, [soldItems]);

  const winner = useMemo(() => {
    let best: { id: string; spent: number } | null = null;
    for (const [id, spent] of spentByTeam) {
      if (!best || spent > best.spent) best = { id, spent };
    }
    return best;
  }, [spentByTeam]);

  const totalSpent = soldItems.reduce((s, it) => s + (it.sold_price ?? 0), 0);
  const topSale = soldItems.reduce<Item | null>((top, it) => ((it.sold_price ?? 0) > (top?.sold_price ?? 0) ? it : top), null);
  const winnerName = winner ? teamNameById.get(winner.id) ?? "Team" : null;

  useEffect(() => {
    // Two celebratory bursts on mount, cleaned up on unmount.
    const fire = (origin: { x: number; y: number }) =>
      confetti({
        particleCount: 120,
        spread: 90,
        startVelocity: 50,
        origin,
        colors: ["#8b5cf6", "#10b981", "#6366f1", "#f59e0b", "#ffffff"],
      });
    fire({ x: 0.3, y: 0.5 });
    const t = setTimeout(() => fire({ x: 0.7, y: 0.5 }), 350);
    const t2 = setTimeout(() => fire({ x: 0.5, y: 0.4 }), 800);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center xl:gap-10">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-1.5 text-sm font-semibold uppercase tracking-[0.3em] text-primary xl:text-base">
        <Trophy className="size-5" />
        Auction complete
      </span>

      {winnerName ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/30 to-amber-500/0 text-amber-300 ring-2 ring-amber-400/50 shadow-[0_0_120px_-20px] shadow-amber-500/60 xl:size-28">
            <Crown className="size-12 xl:size-14" />
          </div>
          <p className="text-lg font-medium uppercase tracking-[0.25em] text-muted-foreground xl:text-xl">Top spender</p>
          <p className="text-6xl font-black tracking-tight text-foreground xl:text-8xl">{winnerName}</p>
          <p className="text-2xl font-bold tabular-nums text-primary xl:text-3xl">
            {formatAmount(winner!.spent, currency)} spent
          </p>
        </div>
      ) : (
        <p className="text-5xl font-black tracking-tight text-foreground xl:text-7xl">No players sold</p>
      )}

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Players sold" value={`${soldItems.length} / ${items.length}`} />
        <Stat label="Total spent" value={formatAmount(totalSpent, currency)} />
        <Stat
          label="Top sale"
          value={topSale ? formatAmount(topSale.sold_price, currency) : "—"}
          sub={topSale?.name ?? undefined}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight tabular-nums xl:text-4xl">{value}</p>
      {sub && <p className="mt-1 truncate text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
