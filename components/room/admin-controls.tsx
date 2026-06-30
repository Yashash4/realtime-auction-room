"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pause, Play, SkipForward, Square } from "lucide-react";
import type { Room } from "@/lib/types";
import { adminNextItem, endAuction, pauseAuction, resumeAuction } from "@/lib/auction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdminControls({ room }: { room: Room }) {
  const [pending, setPending] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setPending(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-lg">
      <div className="mb-3 text-sm font-semibold">Control deck</div>

      {/* Safe actions */}
      <div className="grid grid-cols-2 gap-2">
        {room.status === "active" ? (
          <Button
            size="lg"
            variant="outline"
            className="h-12 flex-col gap-0.5"
            disabled={!!pending}
            onClick={() => run("pause", () => pauseAuction(room.id))}
          >
            <Pause className="size-4" /> Pause
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="h-12 flex-col gap-0.5"
            disabled={!!pending}
            onClick={() => run("resume", () => resumeAuction(room.id))}
          >
            <Play className="size-4" /> Resume
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          className="h-12 flex-col gap-0.5"
          disabled={!!pending || room.status !== "active"}
          onClick={() => run("next", () => adminNextItem(room.id))}
        >
          <SkipForward className="size-4" /> Next
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Next sells the current player to the top bidder immediately.
      </p>

      {/* Separated destructive zone */}
      <div className="mt-4 border-t border-destructive/20 pt-4">
        <Dialog>
          <DialogTrigger
            render={
              <Button variant="destructive" className="h-11 w-full" disabled={!!pending}>
                <Square className="size-4" /> End auction
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End this auction?</DialogTitle>
              <DialogDescription>
                This finalizes all results and closes the room for everyone. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <DialogClose
                render={
                  <Button
                    variant="destructive"
                    disabled={!!pending}
                    onClick={() => run("end", () => endAuction(room.id))}
                  >
                    <Square className="size-4" /> End auction
                  </Button>
                }
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
