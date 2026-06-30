"use client";

import type { Item, ItemStatus, Participant } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS: Record<ItemStatus, { label: string; cls: string }> = {
  active: { label: "On now", cls: "bg-primary/20 text-primary" },
  pending: { label: "Upcoming", cls: "bg-muted text-muted-foreground" },
  sold: { label: "Sold", cls: "bg-emerald-500/15 text-emerald-400" },
  unsold: { label: "Unsold", cls: "bg-destructive/10 text-destructive" },
};

/** The full lot list so bidders can see what's coming and what's gone. */
export function PlayerList({
  items,
  participants,
  currency,
  currentItemId,
}: {
  items: Item[];
  participants: Participant[];
  currency: string;
  currentItemId: string | null;
}) {
  const teamName = new Map(participants.map((p) => [p.id, p.team_name]));

  return (
    <ul className="space-y-1">
      {items.map((it, idx) => {
        const s = STATUS[it.status];
        const active = it.id === currentItemId;
        return (
          <li
            key={it.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
              active ? "border-primary/40 bg-primary/10" : "border-transparent",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.name}</span>
                {it.status === "sold" && it.sold_to ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {teamName.get(it.sold_to) ?? "—"} · {formatAmount(it.sold_price, currency)}
                  </span>
                ) : (
                  it.role && <span className="block truncate text-xs text-muted-foreground">{it.role}</span>
                )}
              </span>
            </span>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", s.cls)}>
              {s.label}
            </span>
          </li>
        );
      })}
      {items.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No players.</li>}
    </ul>
  );
}
