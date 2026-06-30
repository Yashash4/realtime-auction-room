"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

/**
 * Admin-only delete for a room the user hosts. RLS (rooms_delete_admin) already
 * restricts deletes to admin_id = auth.uid(), and FKs cascade, so removing the
 * room clears its players/bids/results too. `relative z-10` keeps the trigger
 * above the card's stretched-link overlay so it doesn't navigate.
 */
export function DeleteRoomButton({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const { error } = await createClient().from("rooms").delete().eq("code", code);
    if (error) {
      toast.error(error.message);
      setPending(false);
      return;
    }
    toast.success(`Deleted "${name}"`);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative z-10 text-muted-foreground hover:text-destructive"
          />
        }
        aria-label={`Delete ${name}`}
        title="Delete room"
      >
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this room?</DialogTitle>
          <DialogDescription>
            “{name}” and all its players, bids and results will be permanently removed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={pending} onClick={remove}>
            {pending ? "Deleting…" : "Delete room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
