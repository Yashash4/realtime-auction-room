"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  ChevronsUp,
  ChevronUp,
  CircleX,
  Gavel,
  Hand,
  Megaphone,
  Mic,
  Swords,
  Timer,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { onNarration, type NarrationLine } from "@/lib/auctioneer/narrator";
import type { BeatCategory } from "@/lib/auctioneer/lines";

const ICON: Record<BeatCategory, LucideIcon> = {
  auction_start: Megaphone,
  new_player: UserPlus,
  first_bid: Hand,
  raise_small: ChevronUp,
  raise_big: ChevronsUp,
  bidding_war: Swords,
  anti_snipe: Timer,
  going_once: AlarmClock,
  going_twice: AlarmClock,
  sold: Gavel,
  unsold: CircleX,
};

/** Live text feed mirroring the spoken commentary (works even when muted). */
export function CommentaryFeed() {
  const [lines, setLines] = useState<NarrationLine[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => onNarration((l) => setLines((prev) => [...prev, l].slice(-8))), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  return (
    <div className="rounded-xl border bg-card" data-testid="commentary-feed">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
        <Mic className="size-4 text-primary" /> Commentary
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">The auctioneer is warming up…</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
          {lines.map((l, i) => {
            const Icon = ICON[l.category] ?? Mic;
            const isLast = i === lines.length - 1;
            return (
              <li
                key={l.id}
                className={`flex items-start gap-2 text-sm duration-200 animate-in fade-in ${isLast ? "text-foreground" : "text-muted-foreground"}`}
              >
                <Icon className={`mt-0.5 size-3.5 shrink-0 ${isLast ? "text-primary" : ""}`} />
                <span>{l.text}</span>
              </li>
            );
          })}
          <div ref={bottom} />
        </ul>
      )}
    </div>
  );
}
