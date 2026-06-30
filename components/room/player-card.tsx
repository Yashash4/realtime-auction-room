"use client";

import { Flag, Tag } from "lucide-react";
import type { Item } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Color-coded role badge classes, matched case-insensitively against item.role. */
function roleBadge(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("bat")) return "bg-primary/15 text-primary border-primary/30";
  if (r.includes("bowl") || r.includes("all")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (r.includes("keep") || r.includes("wk")) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

/** The player on the block. `compact` shrinks it so the bid flow fits one viewport. */
export function PlayerCard({ item, currency, compact = false }: { item: Item; currency: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-2" : "gap-5")}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent font-bold text-primary shadow-[0_0_60px_-12px] shadow-primary/50 ring-1 ring-primary/30",
          compact ? "size-20 text-3xl" : "size-36 text-5xl lg:size-40",
        )}
      >
        <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">{initials(item.name)}</span>
      </div>
      <div>
        <h2 className={cn("font-bold tracking-tight", compact ? "text-2xl" : "text-3xl")}>{item.name}</h2>
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground",
            compact ? "mt-1.5" : "mt-3",
          )}
        >
          {item.role && (
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide", roleBadge(item.role))}>
              {item.role}
            </span>
          )}
          {item.country && (
            <span className="flex items-center gap-1">
              <Flag className="size-3.5" />
              {item.country}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Tag className="size-3.5" />
            Base {formatAmount(item.base_price, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
