"use client";

import type { Participant } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export function TeamBudgets({
  participants,
  currency,
  highlightId,
  myParticipantId,
}: {
  participants: Participant[];
  currency: string;
  highlightId?: string | null; // current highest bidder's participant id
  myParticipantId?: string | null;
}) {
  const sorted = [...participants].sort((a, b) => b.budget_remaining - a.budget_remaining);

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">Teams</div>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No teams have joined yet.</p>
      ) : (
        <ul className="divide-y">
          {sorted.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{p.team_name}</span>
                {p.id === myParticipantId && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">you</span>
                )}
                {p.id === highlightId && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                    leading
                  </span>
                )}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatMoney(currency, p.budget_remaining)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
