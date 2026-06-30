"use client";

import { useEffect, useState } from "react";
import {
  AlarmClock,
  ChevronsUp,
  ChevronUp,
  CircleX,
  Flame,
  Flag,
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
import { cn } from "@/lib/utils";

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

/**
 * Live text feed mirroring the spoken commentary. Newest line is PREPENDED (on
 * top) and slides in from above; the list scrolls inside its OWN container — no
 * scrollIntoView, so a new line never yanks the whole page to the top.
 */
export function CommentaryFeed({ className }: { className?: string }) {
  const [lines, setLines] = useState<NarrationLine[]>([]);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  useEffect(() => onNarration((l) => setLines((prev) => [l, ...prev].slice(0, 8))), []);
  useEffect(() => onSpeaking(setSpeakingId), []);

  return (
    <div className={cn("flex min-h-0 flex-col rounded-xl border bg-card", className)} data-testid="commentary-feed">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3 text-sm font-medium">
        <Mic className="size-4 text-primary" /> Commentary
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">The auctioneer is warming up…</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {lines.map((l) => {
            const Icon = ICON[l.category] ?? Mic;
            const live = l.id === speakingId;
            return (
              <li
                key={l.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm duration-300 animate-in fade-in slide-in-from-top-2",
                  live ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", live && "text-primary")} />
                <span>{l.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
