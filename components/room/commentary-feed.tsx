"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  ChevronsUp,
  ChevronUp,
  CircleX,
  Flag,
  Flame,
  Gavel,
  Gem,
  Hand,
  Hourglass,
  Megaphone,
  Mic,
  RotateCcw,
  Swords,
  Timer,
  Trophy,
  UserPlus,
  Wallet,
  WalletMinimal,
  type LucideIcon,
} from "lucide-react";
import { onNarration, onSpeaking, type NarrationLine } from "@/lib/auctioneer/narrator";
import type { BeatCategory } from "@/lib/auctioneer/lines";

const ICON: Record<BeatCategory, LucideIcon> = {
  welcome: Megaphone,
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
  wrap: Flag,
  budget_thin: WalletMinimal,
  budget_deep: Wallet,
  milestone_record: Trophy,
  milestone_crore: Gem,
  lull: Hourglass,
  spree: Flame,
  round_started: RotateCcw,
};

/** Live text feed mirroring the spoken commentary; the spoken line is highlighted. */
export function CommentaryFeed() {
  const [lines, setLines] = useState<NarrationLine[]>([]);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => onNarration((l) => setLines((prev) => [...prev, l].slice(-8))), []);
  useEffect(() => onSpeaking(setSpeakingId), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  return (
    <div className="rounded-xl border bg-card" data-testid="commentary-feed">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
        <Mic className="size-4 text-primary" /> Commentary
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-base text-muted-foreground">The auctioneer is warming up…</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto px-2 py-2 xl:max-h-96">
          {lines.map((l) => {
            const Icon = ICON[l.category] ?? Mic;
            const live = l.id === speakingId;
            return (
              <li
                key={l.id}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-base duration-200 animate-in fade-in xl:text-lg ${
                  live ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className={`mt-0.5 size-4 shrink-0 xl:size-5 ${live ? "text-primary" : ""}`} />
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
