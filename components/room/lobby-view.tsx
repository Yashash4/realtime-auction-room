"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Play, Plus, Users } from "lucide-react";
import type { Item, Participant, Room } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { joinRoom, startAuction } from "@/lib/auction";
import { createClient } from "@/lib/supabase/client";
import { CsvImportDialog, type ImportedPlayer } from "@/components/csv-import-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Role-colored accent (matches item.role, case-insensitive): bat→violet, bowl/all→emerald,
// keep/wk→amber, else neutral. Used for the left border on each queued-player row.
function roleBorder(role: string | null): string {
  const r = (role ?? "").toLowerCase();
  if (r.startsWith("bat")) return "border-l-primary";
  if (r.startsWith("bowl") || r.startsWith("all")) return "border-l-emerald-500";
  if (r.startsWith("keep") || r.startsWith("wk") || r.includes("keeper")) return "border-l-amber-500";
  return "border-l-border";
}

export function LobbyView({
  room,
  items,
  participants,
  isAdmin,
  myParticipant,
}: {
  room: Room;
  items: Item[];
  participants: Participant[];
  isAdmin: boolean;
  myParticipant: Participant | null;
}) {
  const [pending, setPending] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [copied, setCopied] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: "", role: "", country: "", base_price: "" });

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code);
    toast.success("Room code copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const start = async () => {
    setPending(true);
    try {
      await startAuction(room.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start");
      setPending(false);
    }
  };

  const join = async () => {
    if (!teamName.trim()) return toast.error("Enter a team name");
    setPending(true);
    try {
      await joinRoom(room.code, teamName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setPending(false);
    }
  };

  // Shared insert for both manual add and CSV import. Realtime hook refreshes the list.
  const addPlayers = async (players: ImportedPlayer[]) => {
    if (players.length === 0) return false;
    const startIdx = Math.max(-1, ...items.map((i) => i.order_index)) + 1;
    const supabase = createClient();
    const { error } = await supabase.from("items").insert(
      players.map((p, i) => ({
        room_id: room.id,
        name: p.name,
        role: p.role,
        country: p.country,
        base_price: p.base_price,
        order_index: startIdx + i,
        status: "pending" as const,
      })),
    );
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const addManual = async () => {
    const name = newPlayer.name.trim();
    const base_price = Number(newPlayer.base_price.replace(/,/g, "").trim());
    if (!name) return toast.error("Enter a player name");
    if (Number.isNaN(base_price) || base_price < 0) return toast.error("Enter a valid base price");
    setPending(true);
    const ok = await addPlayers([
      {
        name,
        role: newPlayer.role.trim() || null,
        country: newPlayer.country.trim() || null,
        base_price,
      },
    ]);
    setPending(false);
    if (ok) {
      toast.success(`Added ${name}`);
      setNewPlayer({ name: "", role: "", country: "", base_price: "" });
    }
  };

  const importPlayers = async (players: ImportedPlayer[]) => {
    if (await addPlayers(players)) toast.success(`Added ${players.length} players`);
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Share this code so teams can join</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{room.code}</p>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy room code"
              onClick={copyCode}
              className="shrink-0"
            >
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 text-sm font-medium">
            Players queued ({items.length})
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No players added.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {items.map((it, i) => (
                <li
                  key={it.id}
                  className={cn(
                    "flex items-center justify-between border-l-2 px-4 py-2.5 text-sm",
                    roleBorder(it.role),
                  )}
                >
                  <span>
                    <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                    {it.name}
                    {it.role && <span className="ml-2 text-xs text-muted-foreground">{it.role}</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatAmount(it.base_price, room.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin && (
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Add players</p>
              <CsvImportDialog onImport={importPlayers} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Name"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                placeholder="Role"
                value={newPlayer.role}
                onChange={(e) => setNewPlayer((p) => ({ ...p, role: e.target.value }))}
              />
              <Input
                placeholder="Country"
                value={newPlayer.country}
                onChange={(e) => setNewPlayer((p) => ({ ...p, country: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                placeholder="Base price"
                value={newPlayer.base_price}
                onChange={(e) => setNewPlayer((p) => ({ ...p, base_price: e.target.value }))}
              />
            </div>
            <Button className="w-full gap-2" disabled={pending} onClick={addManual}>
              <Plus className="size-4" /> Add player
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
            <Users className="size-4" /> Teams ({participants.length})
          </div>
          {participants.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Waiting for teams…</p>
          ) : (
            <ul className="divide-y">
              {participants.map((p) => (
                <li key={p.id} className="px-4 py-2.5 text-sm">
                  {p.team_name}
                  {p.id === myParticipant?.id && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">you</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin ? (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <p className="text-center text-xs text-muted-foreground">
              {items.length === 0 ? (
                <>Add players to begin.</>
              ) : (
                <>
                  <span className="font-medium text-foreground">{participants.length}</span> teams ·{" "}
                  <span className="font-medium text-foreground">{items.length}</span> players ·{" "}
                  <span className="text-emerald-500">ready</span>
                </>
              )}
            </p>
            <Button
              size="lg"
              disabled={pending || items.length === 0}
              onClick={start}
              className="w-full shadow-lg shadow-primary/30 ring-1 ring-primary/40 transition-shadow hover:shadow-xl hover:shadow-primary/40"
            >
              <Play className="size-5" /> Start auction
            </Button>
          </div>
        ) : myParticipant ? (
          <div className="rounded-xl border bg-card p-4 text-center text-sm">
            You&apos;re in as <span className="font-medium">{myParticipant.team_name}</span>. Waiting for the admin to start.
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">Join as a team</p>
            <Input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <Button className="w-full" disabled={pending} onClick={join}>
              Join room
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
