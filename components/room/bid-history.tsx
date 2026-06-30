"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import type { Bid } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "12s ago" / "3m ago" / "1h ago" from an ISO timestamp. */
function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function BidHistory({
  bids,
  teamNameById,
  currency,
}: {
  bids: Bid[]; // newest first
  teamNameById: Map<string, string>;
  currency: string;
}) {
  // Re-render every 5s to keep relative times fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">Bid history</div>
      {bids.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No bids yet — be the first.
        </p>
      ) : (
        <ul className="max-h-72 divide-y overflow-y-auto">
          {bids.map((b, i) => (
            <li
              key={b.id}
              className={cn(
                "flex items-center justify-between px-4 py-2.5 text-sm duration-300 animate-in slide-in-from-right-3 fade-in",
                i === 0 && "bg-emerald-500/5",
              )}
            >
              <span className="flex items-center gap-2">
                {i === 0 && <Crown className="size-4 text-emerald-400" />}
                <span className={i === 0 ? "font-semibold" : ""}>
                  {teamNameById.get(b.participant_id) ?? "Team"}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{timeAgo(b.created_at, now)}</span>
                <span className={cn("tabular-nums", i === 0 ? "font-semibold text-emerald-400" : "text-muted-foreground")}>
                  {formatAmount(b.amount, currency)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
