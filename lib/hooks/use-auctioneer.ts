"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { tierStep } from "@/lib/types";
import { moneyWords } from "@/lib/inr-words";
import { renderLine } from "@/lib/auctioneer/lines";
import { getNarrationState, narrate, setNarrationState } from "@/lib/auctioneer/narrator";
import { playCheer, playGroan } from "@/lib/sound";

const CRORE = 1_00_00_000; // 10,000,000

/**
 * Watches live auction state and emits auctioneer beats to the narrator. Pure
 * side-effects; the narrator handles speech + the feed. Reacts to current state
 * (not a backlog), and flavor lines (budget/spree/lull) use the narrator's
 * coalescing flavor lane so they never delay the meaningful beats.
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
  const prevHighPart = useRef<string | null>(null);
  const welcomed = useRef(false);
  const wrapSaid = useRef(false);
  const prevEnds = useRef<{ itemId: string | null; ends: number; status: string }>({ itemId: null, ends: 0, status: "" });
  const resolved = useRef<Set<string> | null>(null);
  const closeEpoch = useRef<string | null>(null);
  const onceSaid = useRef(false);
  const twiceSaid = useRef(false);
  const onceAt = useRef(7000);
  const twiceAt = useRef(3500);

  // running stats / cooldowns
  const highestSold = useRef(0);
  const sawCrore = useRef(false);
  const winsByTeam = useRef<Map<string, number>>(new Map());
  const lastBidActivity = useRef(0);
  const lastBudgetAt = useRef(0);
  const lastSpreeAt = useRef(0);
  const lastLullAt = useRef(0);
  const lastGroanAt = useRef(0);

  const staleItem = (id: string) => () => getNarrationState().itemId !== id;

  // Keep the narrator's live-state view fresh for staleness checks.
  useEffect(() => {
    setNarrationState({
      itemId: currentItem?.id ?? null,
      highest: highest?.amount ?? null,
      epoch: highest?.id ?? null,
      remainingMs: room.item_ends_at ? new Date(room.item_ends_at).getTime() - nowMs : 0,
      status: room.status,
    });
  });

  // Welcome bookend + new player on the block.
  useEffect(() => {
    if (room.status !== "active" || !currentItem) return;
    if (announcedItemId.current === currentItem.id) return;
    announcedItemId.current = currentItem.id;
    lastHigh.current = null;
    prevHighPart.current = null;
    lastBidActivity.current = Date.now();
    if (!welcomed.current) {
      welcomed.current = true;
      narrate({ category: "welcome", priority: "normal", text: renderLine("welcome", { count: String(items.length) }) });
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
  }, [room.status, currentItem?.id, room.currency, items.length]);

  // First bid / raises / war (+ groan on a lead change, + occasional budget flavor).
  useEffect(() => {
    if (room.status !== "active" || !currentItem || !highest) return;
    if (lastHigh.current === highest.amount) return;
    const prev = lastHigh.current;
    const prevPart = prevHighPart.current;
    lastHigh.current = highest.amount;
    prevHighPart.current = highest.participant_id;
    lastBidActivity.current = Date.now();
    const team = teamNameById.get(highest.participant_id) ?? "a team";
    const amount = moneyWords(room.currency, highest.amount);
    const stale = () => {
      const s = getNarrationState();
      return s.itemId !== currentItem.id || s.highest !== highest.amount;
    };

    if (prevPart && prevPart !== highest.participant_id && Date.now() - lastGroanAt.current > 2500) {
      lastGroanAt.current = Date.now();
      playGroan(); // a leader just got outbid
    }

    if (prev == null) {
      narrate({ category: "first_bid", priority: "normal", text: renderLine("first_bid", { team, amount }), isStale: stale });
    } else {
      const now = Date.now();
      const recent = itemBids.filter((b) => now - new Date(b.created_at).getTime() < 4500).length;
      if (recent >= 3) {
        narrate({ category: "bidding_war", priority: "raise", text: renderLine("bidding_war", { team, amount }), isStale: stale });
      } else {
        const step = tierStep(room.increment_tiers, prev);
        const cat = highest.amount - prev >= step * 2 ? "raise_big" : "raise_small";
        narrate({ category: cat, priority: "raise", text: renderLine(cat, { team, amount }), isStale: stale });
      }
    }

    // budget-aware flavor (occasional)
    const p = participants.find((x) => x.id === highest.participant_id);
    const ratio = p && room.team_budget > 0 ? p.budget_remaining / room.team_budget : 1;
    const now = Date.now();
    if (now - lastBudgetAt.current > 16000) {
      if (ratio < 0.25 && Math.random() < 0.5) {
        lastBudgetAt.current = now;
        narrate({ category: "budget_thin", priority: "flavor", text: renderLine("budget_thin", { team }), isStale: staleItem(currentItem.id) });
      } else if (ratio > 0.7 && Math.random() < 0.3) {
        lastBudgetAt.current = now;
        narrate({ category: "budget_deep", priority: "flavor", text: renderLine("budget_deep", { team }), isStale: staleItem(currentItem.id) });
      }
    }
  }, [highest?.id, highest?.amount, room.status, currentItem?.id, room.currency]);

  // Anti-snipe.
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

  // Sold / unsold (+ cheer, milestones, per-team spree).
  useEffect(() => {
    const done = items.filter((i) => i.status === "sold" || i.status === "unsold");
    if (resolved.current === null) {
      resolved.current = new Set(done.map((i) => i.id));
      for (const it of done) {
        if (it.status === "sold" && it.sold_price != null) {
          highestSold.current = Math.max(highestSold.current, it.sold_price);
          if (it.sold_price >= CRORE) sawCrore.current = true;
          if (it.sold_to) winsByTeam.current.set(it.sold_to, (winsByTeam.current.get(it.sold_to) ?? 0) + 1);
        }
      }
      return;
    }
    const fresh = done.filter((i) => !resolved.current!.has(i.id));
    if (fresh.length === 0) return;
    fresh.forEach((i) => resolved.current!.add(i.id));
    const latest = fresh.sort((a, b) => b.order_index - a.order_index)[0];

    if (latest.status !== "sold") {
      narrate({ category: "unsold", priority: "critical", text: renderLine("unsold", { player: latest.name }) });
      return;
    }

    const team = teamNameById.get(latest.sold_to ?? "") ?? "a team";
    const price = latest.sold_price ?? 0;
    playCheer();
    narrate({ category: "sold", priority: "critical", text: renderLine("sold", { player: latest.name, team, amount: moneyWords(room.currency, price) }) });

    if (price >= CRORE && !sawCrore.current) {
      sawCrore.current = true;
      narrate({ category: "milestone_crore", priority: "normal", text: renderLine("milestone_crore", {}) });
    } else if (highestSold.current > 0 && price > highestSold.current) {
      narrate({ category: "milestone_record", priority: "normal", text: renderLine("milestone_record", {}) });
    }
    highestSold.current = Math.max(highestSold.current, price);

    if (latest.sold_to) {
      const wins = (winsByTeam.current.get(latest.sold_to) ?? 0) + 1;
      winsByTeam.current.set(latest.sold_to, wins);
      if (wins >= 2 && Date.now() - lastSpreeAt.current > 20000) {
        lastSpreeAt.current = Date.now();
        narrate({ category: "spree", priority: "normal", text: renderLine("spree", { team }) });
      }
    }
  }, [items, room.currency]);

  // Going once / going twice — closing tension, reset per bid epoch.
  useEffect(() => {
    if (room.status !== "active" || !currentItem || !highest || !room.item_ends_at) return;
    const epoch = highest.id;
    if (closeEpoch.current !== epoch) {
      closeEpoch.current = epoch;
      onceSaid.current = false;
      twiceSaid.current = false;
      onceAt.current = 6500 + Math.random() * 1000;
      twiceAt.current = 3000 + Math.random() * 1000;
    }
    const remaining = new Date(room.item_ends_at).getTime() - nowMs;
    const stale = () => {
      const s = getNarrationState();
      return s.itemId !== currentItem.id || s.epoch !== epoch;
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

  // Lull filler — when it goes quiet well before the close.
  useEffect(() => {
    if (room.status !== "active" || !currentItem || !room.item_ends_at) return;
    const remaining = new Date(room.item_ends_at).getTime() - nowMs;
    if (remaining <= onceAt.current + 2500) return;
    const now = Date.now();
    if (now - lastBidActivity.current < 7000 || now - lastLullAt.current < 9000) return;
    lastLullAt.current = now;
    const amount = moneyWords(room.currency, highest ? highest.amount : currentItem.base_price);
    narrate({ category: "lull", priority: "flavor", text: renderLine("lull", { amount }), isStale: staleItem(currentItem.id) });
  }, [nowMs, room.status, currentItem?.id, room.item_ends_at, room.currency]);

  // Wrap bookend.
  useEffect(() => {
    if (room.status === "completed" && !wrapSaid.current) {
      wrapSaid.current = true;
      narrate({ category: "wrap", priority: "normal", text: renderLine("wrap", {}) });
    }
  }, [room.status]);
}
