"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        placeholder="Room code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="font-mono uppercase sm:max-w-[9rem]"
        maxLength={8}
        aria-label="Room code"
      />
      <Input
        placeholder="Your team name"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        aria-label="Team name"
      />
      <Button type="submit" variant="secondary" disabled={pending} className="gap-2">
        <LogIn className="size-4" />
        {pending ? "Joining…" : "Join"}
      </Button>
    </form>
  );
}
