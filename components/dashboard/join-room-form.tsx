"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { joinRoom } from "@/lib/auction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !teamName.trim()) {
      toast.error("Enter a room code and your team name");
      return;
    }
    setPending(true);
    try {
      const room = await joinRoom(code, teamName);
      router.push(`/rooms/${room.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join room");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
    >
      <Input
        placeholder="Room code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="font-mono tracking-widest uppercase sm:max-w-[10rem]"
        maxLength={8}
        aria-label="Room code"
      />
      <Input
        placeholder="Your team name"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        aria-label="Team name"
      />
      <Button type="submit" disabled={pending} className="gap-2 sm:shrink-0">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        {pending ? "Joining…" : "Join room"}
      </Button>
    </form>
  );
}
