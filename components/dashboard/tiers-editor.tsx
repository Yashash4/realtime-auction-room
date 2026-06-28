"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { IncrementTier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_TIERS: IncrementTier[] = [
  { min_price: 0, step: 50000 },
  { min_price: 1000000, step: 100000 },
];

/**
 * Edits the room's bid-increment tiers and serializes them into a hidden input
 * (name="tiers") so the surrounding <form> submits them with createRoom.
 */
export function TiersEditor() {
  const [tiers, setTiers] = useState<IncrementTier[]>(DEFAULT_TIERS);

  const update = (i: number, key: keyof IncrementTier, value: number) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  const add = () =>
    setTiers((prev) => [...prev, { min_price: prev.at(-1)!.min_price + 1000000, step: 100000 }]);

  const remove = (i: number) =>
    setTiers((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  return (
    <div className="space-y-2">
      <Label>Bid increment tiers</Label>
      <p className="text-xs text-muted-foreground">
        At prices ≥ a tier&apos;s threshold, the bid step is its amount. Lowest tier should start at 0.
      </p>
      <div className="space-y-2">
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5">
              <span className="text-xs text-muted-foreground">from</span>
              <Input
                type="number"
                min={0}
                value={t.min_price}
                onChange={(e) => update(i, "min_price", parseInt(e.target.value || "0", 10))}
                aria-label={`Tier ${i + 1} min price`}
              />
            </div>
            <div className="flex flex-1 items-center gap-1.5">
              <span className="text-xs text-muted-foreground">step</span>
              <Input
                type="number"
                min={1}
                value={t.step}
                onChange={(e) => update(i, "step", parseInt(e.target.value || "0", 10))}
                aria-label={`Tier ${i + 1} step`}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              disabled={tiers.length === 1}
              aria-label="Remove tier"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="size-4" />
        Add tier
      </Button>
      <input type="hidden" name="tiers" value={JSON.stringify(tiers)} />
    </div>
  );
}
