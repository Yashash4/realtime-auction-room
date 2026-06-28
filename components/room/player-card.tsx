"use client";

import { Flag, Tag } from "lucide-react";
import type { Item } from "@/lib/types";
import { formatMoney } from "@/lib/format";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PlayerCard({ item, currency }: { item: Item; currency: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-3xl font-semibold text-primary ring-1 ring-primary/20">
        {initials(item.name)}
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{item.name}</h2>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {item.role && <span>{item.role}</span>}
          {item.country && (
            <span className="flex items-center gap-1">
              <Flag className="size-3.5" />
              {item.country}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Tag className="size-3.5" />
            Base {formatMoney(currency, item.base_price)}
          </span>
        </div>
      </div>
    </div>
  );
}
