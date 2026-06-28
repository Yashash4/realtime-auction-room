"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pause, Play, SkipForward, Square } from "lucide-react";
import type { Room } from "@/lib/types";
import { adminNextItem, endAuction, pauseAuction, resumeAuction } from "@/lib/auction";
import { Button } from "@/components/ui/button";

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
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 text-sm font-medium">Admin controls</div>
      <div className="grid grid-cols-2 gap-2">
        {room.status === "active" ? (
          <Button variant="outline" disabled={!!pending} onClick={() => run("pause", () => pauseAuction(room.id))}>
            <Pause className="size-4" /> Pause
          </Button>
        ) : (
          <Button variant="outline" disabled={!!pending} onClick={() => run("resume", () => resumeAuction(room.id))}>
            <Play className="size-4" /> Resume
          </Button>
        )}
        <Button
          variant="outline"
          disabled={!!pending || room.status !== "active"}
          onClick={() => run("next", () => adminNextItem(room.id))}
        >
          <SkipForward className="size-4" /> Next
        </Button>
        <Button
          variant="destructive"
          className="col-span-2"
          disabled={!!pending}
          onClick={() => run("end", () => endAuction(room.id))}
        >
          <Square className="size-4" /> End auction
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Next sells the current player to the top bidder immediately; End finalizes and closes the room.
      </p>
    </div>
  );
}
