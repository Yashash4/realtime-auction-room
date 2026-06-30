"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createRoom, type CreateRoomState } from "@/app/dashboard/actions";
import { SAMPLE_PLAYERS_TEXT } from "@/lib/players";
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
              <select id="currency" name="currency" defaultValue="₹" className={inputClass}>
                <option value="₹">₹</option>
                <option value="$">$</option>
                <option value="€">€</option>
                <option value="£">£</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamBudget">Team budget</Label>
              <Input id="teamBudget" name="teamBudget" type="number" min={1} defaultValue={100000000} required />
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

          <TiersEditor />

          <div className="space-y-2">
            <Label htmlFor="players">Players</Label>
            <p className="text-xs text-muted-foreground">
              One per line: <span className="font-mono">Name, Role, Country, BasePrice</span>
            </p>
            <textarea
              id="players"
              name="players"
              defaultValue={SAMPLE_PLAYERS_TEXT}
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
