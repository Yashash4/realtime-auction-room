"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { tierStep } from "@/lib/types";
import { moneyWords } from "@/lib/inr-words";
import { renderLine } from "@/lib/auctioneer/lines";
import { getNarrationState, narrate, setNarrationState } from "@/lib/auctioneer/narrator";

/**
 * Watches live auction state and emits auctioneer "beats" to the narrator.
 * Pure side-effects; the narrator handles speech + the on-screen feed. Reacts to
 * current state (not an event backlog), so in a bid storm it announces the
 * current high and drops stale lines.
 */
export function useAuctioneer(args: {
  room: Room;
  items: Item[];
  currentItem: Item | null;
  itemBids: Bid[]; // sorted desc by amount
  participants: Participant[];
  nowMs: number;
}) {
  const { room, items, currentItem, itemBids, participants, nowMs } = args;
  const teamNameById = useMemo(
    () => new Map(participants.map((p) => [p.id, p.team_name])),
    [participants],
  );
  const highest = itemBids[0] ?? null;

  const announcedItemId = useRef<string | null>(null);
  const lastHigh = useRef<number | null>(null);
  const startedOpener = useRef(false);
  const prevEnds = useRef<{ itemId: string | null; ends: number; status: string }>({ itemId: null, ends: 0, status: "" });
  const resolved = useRef<Set<string> | null>(null);
  const closeEpoch = useRef<string | null>(null);
  const onceSaid = useRef(false);
  const twiceSaid = useRef(false);
  const onceAt = useRef(7000);
  const twiceAt = useRef(3500);

  // Keep the narrator's view of live state fresh for staleness checks.
  useEffect(() => {
    setNarrationState({
      itemId: currentItem?.id ?? null,
      highest: highest?.amount ?? null,
      epoch: highest?.id ?? null,
      remainingMs: room.item_ends_at ? new Date(room.item_ends_at).getTime() - nowMs : 0,
      status: room.status,
    });
  });

  // New player on the block (+ a one-time opener).
  useEffect(() => {
    if (room.status !== "active" || !currentItem) return;
    if (announcedItemId.current === currentItem.id) return;
    announcedItemId.current = currentItem.id;
    lastHigh.current = null;
    if (!startedOpener.current) {
      startedOpener.current = true;
      narrate({ category: "auction_start", priority: "normal", text: renderLine("auction_start", {}) });
    }
    const desc = [currentItem.role, currentItem.country ? `from ${currentItem.country}` : ""].filter(Boolean).join(" ");
    narrate({
      category: "new_player",
      priority: "normal",
      text: renderLine("new_player", {
        player: currentItem.name,
        desc: desc || "up for grabs",
        base: moneyWords(room.currency, currentItem.base_price),
      }),
    });
  }, [room.status, currentItem?.id, room.currency]);

  // First bid / raises / bidding war.
  useEffect(() => {
    if (room.status !== "active" || !currentItem || !highest) return;
    if (lastHigh.current === highest.amount) return;
    const prev = lastHigh.current;
    lastHigh.current = highest.amount;
    const team = teamNameById.get(highest.participant_id) ?? "a team";
    const amount = moneyWords(room.currency, highest.amount);
    const stale = () => {
      const s = getNarrationState();
      return s.itemId !== currentItem.id || s.highest !== highest.amount;
    };
    if (prev == null) {
      narrate({ category: "first_bid", priority: "normal", text: renderLine("first_bid", { team, amount }), isStale: stale });
      return;
    }
    const now = Date.now();
    const recent = itemBids.filter((b) => now - new Date(b.created_at).getTime() < 4500).length;
    if (recent >= 3) {
      narrate({ category: "bidding_war", priority: "raise", text: renderLine("bidding_war", { team, amount }), isStale: stale });
      return;
    }
    const step = tierStep(room.increment_tiers, prev);
    const cat = highest.amount - prev >= step * 2 ? "raise_big" : "raise_small";
    narrate({ category: cat, priority: "raise", text: renderLine(cat, { team, amount }), isStale: stale });
  }, [highest?.id, highest?.amount, room.status, currentItem?.id, room.currency]);

  // Anti-snipe: the clock was bumped forward for the same active player.
  useEffect(() => {
    const ends = room.item_ends_at ? new Date(room.item_ends_at).getTime() : 0;
    const p = prevEnds.current;
    const id = currentItem?.id ?? null;
    if (p.itemId === id && p.status === "active" && room.status === "active" && ends > p.ends + 500) {
      narrate({
        category: "anti_snipe",
        priority: "critical",
        text: renderLine("anti_snipe", { team: highest ? (teamNameById.get(highest.participant_id) ?? "") : "" }),
      });
      onceSaid.current = false;
      twiceSaid.current = false;
    }
    prevEnds.current = { itemId: id, ends, status: room.status };
  }, [room.item_ends_at, currentItem?.id, room.status]);

  // Sold / unsold (don't celebrate items already resolved when we mounted).
  useEffect(() => {
    const done = items.filter((i) => i.status === "sold" || i.status === "unsold");
    if (resolved.current === null) {
      resolved.current = new Set(done.map((i) => i.id));
      return;
    }
    const fresh = done.filter((i) => !resolved.current!.has(i.id));
    if (fresh.length === 0) return;
    fresh.forEach((i) => resolved.current!.add(i.id));
    const latest = fresh.sort((a, b) => b.order_index - a.order_index)[0];
    if (latest.status === "sold") {
      const team = teamNameById.get(latest.sold_to ?? "") ?? "a team";
      narrate({
        category: "sold",
        priority: "critical",
        text: renderLine("sold", { player: latest.name, team, amount: moneyWords(room.currency, latest.sold_price ?? 0) }),
      });
    } else {
      narrate({ category: "unsold", priority: "critical", text: renderLine("unsold", { player: latest.name }) });
    }
  }, [items, room.currency]);

  // Going once / going twice — tension in the closing seconds, reset per bid epoch.
  useEffect(() => {
    if (room.status !== "active" || !currentItem || !highest || !room.item_ends_at) return;
    const epoch = highest.id;
    if (closeEpoch.current !== epoch) {
      closeEpoch.current = epoch;
      onceSaid.current = false;
      twiceSaid.current = false;
      onceAt.current = 6500 + Math.random() * 1000; // 6.5–7.5s
      twiceAt.current = 3000 + Math.random() * 1000; // 3–4s
    }
    const remaining = new Date(room.item_ends_at).getTime() - nowMs;
    const stale = () => {
      const s = getNarrationState();
      return s.itemId !== currentItem.id || s.epoch !== epoch; // a new bid (epoch) cancels the call
    };
    const amount = moneyWords(room.currency, highest.amount);
    if (!onceSaid.current && remaining <= onceAt.current && remaining > 1500) {
      onceSaid.current = true;
      narrate({ category: "going_once", priority: "normal", text: renderLine("going_once", { amount }), isStale: stale });
    } else if (!twiceSaid.current && remaining <= twiceAt.current && remaining > 700) {
      twiceSaid.current = true;
      narrate({ category: "going_twice", priority: "normal", text: renderLine("going_twice", { amount }), isStale: stale });
    }
  }, [nowMs, room.status, currentItem?.id, highest?.id, highest?.amount, room.item_ends_at, room.currency]);
}
