"use client";

import { useState } from "react";
import { ChevronDown, Crown } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Squad = {
  name: string;
  players: { name: string; price: number | null }[];
  spent: number;
  budgetLeft: number;
  standout: boolean;
  recap: string;
};

/**
 * Final-results squads as collapsible cards, stacked one-per-row (so 3 teams read
 * 1/1/1, not 2/1). The standout team opens by default; the rest hide their squad
 * behind a header showing spend / budget left / player count. Used by both the
 * logged-in results view and the public share page.
 */
export function SquadList({ squads, currency }: { squads: Squad[]; currency: string }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(squads.filter((s) => s.standout).map((s) => s.name)));
  const toggle = (name: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  if (squads.length === 0) return <p className="text-sm text-muted-foreground">No teams joined.</p>;

  return (
    <div className="space-y-2">
      {squads.map((sq) => {
        const isOpen = open.has(sq.name);
        return (
          <div
            key={sq.name}
            className={cn("overflow-hidden rounded-xl border bg-card shadow-lg", sq.standout && "ring-2 ring-primary/40")}
          >
            <button
              onClick={() => toggle(sq.name)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                {sq.standout && <Crown className="size-4 shrink-0 text-primary" />}
                <span className="truncate">{sq.name}</span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="block tabular-nums">Spent {formatAmount(sq.spent, currency)}</span>
                <span className="block text-xs text-muted-foreground">
                  {sq.players.length} {sq.players.length === 1 ? "player" : "players"} · {formatAmount(sq.budgetLeft, currency)} left
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t px-4 py-3">
                {sq.players.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {sq.players.map((pl, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">{pl.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatAmount(pl.price, currency)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No players won.</p>
                )}
                {sq.recap && <p className="mt-3 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{sq.recap}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
