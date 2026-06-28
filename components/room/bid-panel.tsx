"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Gavel, ShieldCheck } from "lucide-react";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { tierStep } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { placeBid } from "@/lib/auction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BidPanel({
  room,
  item,
  highest,
  myParticipant,
  isAdmin,
  open,
}: {
  room: Room;
  item: Item;
  highest: Bid | null;
  myParticipant: Participant | null;
  isAdmin: boolean;
  open: boolean; // is bidding currently open (active + time left)
}) {
  const [pending, setPending] = useState(false);
  const [custom, setCustom] = useState("");

  const currentPrice = highest?.amount ?? item.base_price;
  const isOpening = !highest;
  const step = tierStep(room.increment_tiers, currentPrice);
  const quickBid = isOpening ? item.base_price : currentPrice + step;

  if (isAdmin) {
    return (
      <Panel>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          You&apos;re the admin — you run the auction and don&apos;t bid.
        </div>
      </Panel>
    );
  }

  if (!myParticipant) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          You&apos;re spectating. Join this room from the dashboard (while it&apos;s in the lobby) to bid.
        </p>
      </Panel>
    );
  }

  const iAmHighest = highest?.participant_id === myParticipant.id;
  const budget = myParticipant.budget_remaining;

  async function submit(amount: number) {
    if (amount > budget) {
      toast.error("That bid exceeds your remaining budget");
      return;
    }
    setPending(true);
    try {
      await placeBid(room.id, item.id, amount);
      setCustom("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bid failed");
    } finally {
      setPending(false);
    }
  }

  const quickDisabled = !open || pending || iAmHighest || quickBid > budget;

  return (
    <Panel>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Your budget</span>
        <span className="font-medium tabular-nums">{formatMoney(room.currency, budget)}</span>
      </div>

      <Button size="lg" className="h-14 w-full text-base" disabled={quickDisabled} onClick={() => submit(quickBid)}>
        <Gavel className="size-5" />
        {iAmHighest
          ? "You're the highest bidder"
          : isOpening
            ? `Open at ${formatMoney(room.currency, quickBid)}`
            : `Bid ${formatMoney(room.currency, quickBid)}`}
      </Button>

      {!isOpening && (
        <p className="text-center text-xs text-muted-foreground">
          Current {formatMoney(room.currency, currentPrice)} · next step +{formatMoney(room.currency, step)}
        </p>
      )}

      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder={`Custom ≥ ${quickBid}`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={!open || pending || iAmHighest}
        />
        <Button
          variant="outline"
          disabled={!open || pending || iAmHighest || !custom}
          onClick={() => {
            const amt = parseInt(custom, 10);
            if (!Number.isFinite(amt) || amt < quickBid) {
              toast.error(`Custom bid must be at least ${formatMoney(room.currency, quickBid)}`);
              return;
            }
            void submit(amt);
          }}
        >
          Bid
        </Button>
      </div>

      {!open && <p className="text-center text-xs text-muted-foreground">Bidding is closed for this player.</p>}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 rounded-xl border bg-card p-4">{children}</div>;
}
