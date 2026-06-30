"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Item, Participant } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * All teams, with MY team pinned to the top and clearly marked. Each row expands
 * (a disclosure) to its squad — players won, total spent, budget left — so you
 * can check your own squad and scout opponents mid-auction.
 */
export function TeamsPanel({
  participants,
  items,
  currency,
  highlightId,
  myParticipantId,
  maxPerTeam,
}: {
  participants: Participant[];
  items: Item[];
  currency: string;
  highlightId?: string | null; // current highest bidder
  myParticipantId?: string | null;
  maxPerTeam?: number | null;
}) {
  const wonByTeam = new Map<string, Item[]>();
  for (const it of items) {
    if (it.status === "sold" && it.sold_to) {
      const arr = wonByTeam.get(it.sold_to) ?? [];
      arr.push(it);
      wonByTeam.set(it.sold_to, arr);
    }
  }

  const teams = participants
    .map((p) => {
      const won = (wonByTeam.get(p.id) ?? []).slice().sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0));
      const spent = won.reduce((s, i) => s + (i.sold_price ?? 0), 0);
      return { p, won, spent };
    })
    .sort((a, b) => {
      if (a.p.id === myParticipantId) return -1; // my team always first
      if (b.p.id === myParticipantId) return 1;
      return b.spent - a.spent;
    });

  const cap = maxPerTeam ?? 0;
  // Default: my team open so I immediately see my squad.
  const [open, setOpen] = useState<Set<string>>(() => new Set(myParticipantId ? [myParticipantId] : []));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (teams.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">No teams have joined yet.</p>;
  }

  return (
    <div className="space-y-2">
      {teams.map(({ p, won, spent }) => {
        const mine = p.id === myParticipantId;
        const leading = p.id === highlightId;
        const isOpen = open.has(p.id);
        return (
          <div
            key={p.id}
            className={cn(
              "overflow-hidden rounded-xl border bg-card",
              mine && "ring-1 ring-primary/40",
              leading && "border-l-2 border-l-primary",
            )}
          >
            <button
              onClick={() => toggle(p.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                <span className="truncate font-medium">{p.team_name}</span>
                {mine && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">YOU</span>}
                {leading && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">LEADING</span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums">{formatAmount(p.budget_remaining, currency)}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {won.length}
                  {cap > 0 ? ` / ${cap}` : ""} {won.length === 1 ? "player" : "players"}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t px-3 py-2">
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>Spent {formatAmount(spent, currency)}</span>
                  <span>{formatAmount(p.budget_remaining, currency)} left</span>
                </div>
                {won.length === 0 ? (
                  <p className="py-1 text-xs text-muted-foreground">No players won yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {won.map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span className="truncate">{i.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatAmount(i.sold_price, currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
