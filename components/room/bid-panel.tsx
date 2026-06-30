"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Gavel, ShieldCheck } from "lucide-react";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { tierStep } from "@/lib/types";
import { formatAmount } from "@/lib/format";
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
  myOwned = 0,
}: {
  room: Room;
  item: Item;
  highest: Bid | null;
  myParticipant: Participant | null;
  isAdmin: boolean;
  open: boolean; // is bidding currently open (active + time left)
  myOwned?: number; // SOLD players this team already owns (for the squad cap)
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
  const cap = room.max_players_per_team ?? 0;
  const squadFull = cap > 0 && myOwned >= cap;

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

  const quickDisabled = !open || pending || iAmHighest || quickBid > budget || squadFull;

  return (
    <Panel>
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Your budget</span>
        <span className="font-semibold tabular-nums">{formatAmount(budget, room.currency)}</span>
      </div>

      {cap > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Your squad</span>
          <span className={`font-semibold tabular-nums ${squadFull ? "text-amber-400" : ""}`}>
            {myOwned} / {cap} players
          </span>
        </div>
      )}

      {squadFull && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-center text-sm font-medium text-amber-600 dark:text-amber-400">
          Your squad is full ({cap} {cap === 1 ? "player" : "players"}) — you can&apos;t bid on more.
        </p>
      )}

      <Button size="lg" className="h-14 w-full text-base" disabled={quickDisabled} onClick={() => submit(quickBid)}>
        <Gavel className="size-5" />
        {squadFull
          ? "Squad full"
          : iAmHighest
            ? "You're the highest bidder"
            : isOpening
              ? `Open at ${formatAmount(quickBid, room.currency)}`
              : `Bid ${formatAmount(quickBid, room.currency)}`}
      </Button>

      {!isOpening && (
        <p className="text-center text-xs text-muted-foreground">
          Current {formatAmount(currentPrice, room.currency)} · next step +{formatAmount(step, room.currency)}
        </p>
      )}

      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder={`Custom ≥ ${quickBid}`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={!open || pending || iAmHighest || squadFull}
        />
        <Button
          variant="outline"
          disabled={!open || pending || iAmHighest || squadFull || !custom}
          onClick={() => {
            const amt = parseInt(custom, 10);
            if (!Number.isFinite(amt) || amt < quickBid) {
              toast.error(`Custom bid must be at least ${formatAmount(quickBid, room.currency)}`);
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
  return <div className="space-y-3 rounded-xl border bg-card p-4 shadow-lg">{children}</div>;
}
