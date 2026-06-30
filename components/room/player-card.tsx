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
  if (r.includes("bowl") || r.includes("all"))
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (r.includes("keep") || r.includes("wk"))
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export function PlayerCard({ item, currency }: { item: Item; currency: string }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      {/* Spotlight: gradient pool + violet glow ring */}
      <div className="relative flex size-36 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-transparent text-5xl font-bold text-primary ring-1 ring-primary/30 shadow-[0_0_60px_-12px] shadow-primary/50 lg:size-40">
        <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">{initials(item.name)}</span>
      </div>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{item.name}</h2>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          {item.role && (
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                roleBadge(item.role),
              )}
            >
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
