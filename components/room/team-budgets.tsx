"use client";

import type { Participant } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TeamBudgets({
  participants,
  currency,
  highlightId,
  myParticipantId,
  soldByTeam,
  maxPerTeam,
}: {
  participants: Participant[];
  currency: string;
  highlightId?: string | null; // current highest bidder's participant id
  myParticipantId?: string | null;
  soldByTeam?: Map<string, number>;
  maxPerTeam?: number | null;
}) {
  const sorted = [...participants].sort((a, b) => b.budget_remaining - a.budget_remaining);
  const cap = maxPerTeam ?? 0;

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">Teams</div>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No teams have joined yet.</p>
      ) : (
        <ul className="divide-y">
          {sorted.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center justify-between border-l-2 border-transparent px-4 py-2.5 text-sm transition-colors",
                p.id === highlightId && "border-l-primary bg-primary/10",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{p.team_name}</span>
                {p.id === myParticipantId && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">you</span>
                )}
                {p.id === highlightId && (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    leading
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end">
                <span className="tabular-nums text-muted-foreground">
                  {formatAmount(p.budget_remaining, currency)}
                </span>
                {cap > 0 && (
                  <span
                    className={`text-[10px] tabular-nums ${
                      (soldByTeam?.get(p.id) ?? 0) >= cap ? "text-amber-500" : "text-muted-foreground"
                    }`}
                  >
                    {soldByTeam?.get(p.id) ?? 0} / {cap} players
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
