"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Gavel, XCircle } from "lucide-react";
import type { Item } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { playFanfare, playGavel } from "@/lib/sound";

export type SoldEvent = {
  key: number; // unique per event so the effect re-fires
  item: Item;
  teamName: string | null;
  currency: string;
};

/**
 * Full-screen celebratory beat shown when a player resolves. Sold = confetti +
 * gavel + "SOLD to TEAM for AMOUNT"; unsold = a quieter card. Auto-dismisses,
 * covering the transition to the next player so the result actually registers.
 */
export function SoldOverlay({ event, onDone }: { event: SoldEvent | null; onDone: () => void }) {
  const sold = event?.item.status === "sold";

  useEffect(() => {
    if (!event) return;
    let burst: ReturnType<typeof setInterval> | undefined;

    if (sold) {
      playGavel();
      playFanfare();
      const fire = () =>
        confetti({
          particleCount: 70,
          spread: 75,
          startVelocity: 45,
          origin: { y: 0.6 },
          colors: ["#8b5cf6", "#10b981", "#6366f1", "#ffffff"],
        });
      fire();
      burst = setInterval(fire, 700); // a couple of follow-up pops
    }

    const done = setTimeout(onDone, sold ? 3200 : 2000);
    return () => {
      clearTimeout(done);
      if (burst) clearInterval(burst);
    };
  }, [event?.key, sold, onDone, event]);

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-sm duration-200 animate-in fade-in">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-12 py-10 text-center shadow-2xl duration-300 animate-in zoom-in-95">
        {sold ? (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
              <Gavel className="size-8" />
            </div>
            <p className="text-4xl font-black tracking-tight text-primary">SOLD</p>
            <p className="text-xl font-semibold">{event.item.name}</p>
            <p className="text-muted-foreground">
              to <span className="font-medium text-foreground">{event.teamName ?? "—"}</span>
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {formatMoney(event.currency, event.item.sold_price)}
            </p>
          </>
        ) : (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <XCircle className="size-8" />
            </div>
            <p className="text-3xl font-black tracking-tight text-muted-foreground">UNSOLD</p>
            <p className="text-xl font-semibold">{event.item.name}</p>
            <p className="text-sm text-muted-foreground">No bids placed</p>
          </>
        )}
      </div>
    </div>
  );
}
