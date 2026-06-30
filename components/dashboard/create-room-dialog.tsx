"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createRoom, type CreateRoomState } from "@/app/dashboard/actions";
import { SAMPLE_PLAYERS_TEXT } from "@/lib/players";
import { formatAmount } from "@/lib/format";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TiersEditor } from "@/components/dashboard/tiers-editor";

const inputClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create room"}
    </Button>
  );
}

export function CreateRoomDialog() {
  const [open, setOpen] = useState(false);
  const [playersText, setPlayersText] = useState(SAMPLE_PLAYERS_TEXT);
  const [currency, setCurrency] = useState("₹");
  const [budget, setBudget] = useState("100000000");
  const [state, formAction] = useActionState<CreateRoomState, FormData>(createRoom, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Create room
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an auction room</DialogTitle>
          <DialogDescription>
            You&apos;ll be the admin: you run the auction but don&apos;t bid. Share the code so teams can join.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room name</Label>
            <Input id="name" name="name" placeholder="Friday Mega Auction" required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                <option value="₹">₹</option>
                <option value="$">$</option>
                <option value="€">€</option>
                <option value="£">£</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamBudget">Team budget</Label>
              <Input id="teamBudget" name="teamBudget" type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} required />
              {Number(budget) > 0 && (
                <p className="text-[11px] text-muted-foreground">= {formatAmount(Number(budget), currency)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="timerSeconds">Timer (s)</Label>
              <Input id="timerSeconds" name="timerSeconds" type="number" min={10} max={300} defaultValue={30} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="antiSnipeSeconds">Anti-snipe extension (s)</Label>
            <Input id="antiSnipeSeconds" name="antiSnipeSeconds" type="number" min={5} max={120} defaultValue={20} required />
            <p className="text-xs text-muted-foreground">
              A bid in the final seconds bumps the clock back up to this many seconds.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select id="visibility" name="isPublic" defaultValue="true" className={inputClass}>
                <option value="true">Public — anyone can watch</option>
                <option value="false">Private — members only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPlayers">Max players / team</Label>
              <Input id="maxPlayers" name="maxPlayersPerTeam" type="number" min={1} placeholder="No cap" />
              <p className="text-[11px] text-muted-foreground">Blank = no limit.</p>
            </div>
          </div>

          <TiersEditor />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="players">Players</Label>
              <CsvImportDialog
                onImport={(players) => {
                  setPlayersText((prev) =>
                    [
                      prev.trimEnd(),
                      ...players.map(
                        (p) => `${p.name}, ${p.role ?? ""}, ${p.country ?? ""}, ${p.base_price}`,
                      ),
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  );
                  toast.success(`Added ${players.length} players`);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              One per line: <span className="font-mono">Name, Role, Country, BasePrice</span>
            </p>
            <textarea
              id="players"
              name="players"
              value={playersText}
              onChange={(e) => setPlayersText(e.target.value)}
              rows={8}
              className={`${inputClass} font-mono text-xs`}
              required
            />
          </div>

          {state.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
