"use client";

import { Crown } from "lucide-react";
import type { Bid } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export function BidHistory({
  bids,
  teamNameById,
  currency,
}: {
  bids: Bid[]; // newest first
  teamNameById: Map<string, string>;
  currency: string;
}) {
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
            <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                {i === 0 && <Crown className="size-4 text-amber-500" />}
                <span className={i === 0 ? "font-medium" : ""}>
                  {teamNameById.get(b.participant_id) ?? "Team"}
                </span>
              </span>
              <span className={`tabular-nums ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}>
                {formatMoney(currency, b.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
