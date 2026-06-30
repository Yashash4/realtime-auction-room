"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Eye, Megaphone, MegaphoneOff, Radio, Tv, Volume2, VolumeX } from "lucide-react";
import { useAuctionRoom } from "@/lib/hooks/use-auction-room";
import { useAuctioneer } from "@/lib/hooks/use-auctioneer";
import { useMuted } from "@/lib/sound";
import { primeSpeech, useVoice } from "@/lib/auctioneer/narrator";
import type { Bid, Item, Participant, Room } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LobbyView } from "@/components/room/lobby-view";
import { AuctionView } from "@/components/room/auction-view";
import { CompletedView } from "@/components/room/completed-view";
import { SoldOverlay, type SoldEvent } from "@/components/room/sold-overlay";
import { VoiceSettings } from "@/components/room/voice-settings";

export function AuctionRoom({
  initial,
  userId,
  isAdmin,
}: {
  initial: { room: Room; items: Item[]; participants: Participant[]; bids: Bid[] };
  userId: string;
  isAdmin: boolean;
}) {
  const { room, items, participants, bids, conn, nowMs, watching } = useAuctionRoom(initial, userId);

  const myParticipant = participants.find((p) => p.user_id === userId) ?? null;
  const currentItem = items.find((i) => i.id === room.current_item_id) ?? null;
  const itemBids = currentItem
    ? bids
        .filter((b) => b.item_id === currentItem.id)
        .sort((a, b) => b.amount - a.amount || b.created_at.localeCompare(a.created_at))
    : [];

  // Detect a player resolving (sold/unsold) and fire the celebratory overlay.
  // Pre-existing resolved items (e.g. reopening a finished room) are not celebrated.
  const celebrated = useRef<Set<string> | null>(null);
  const [soldEvent, setSoldEvent] = useState<SoldEvent | null>(null);
  // A new round reopens already-resolved players; re-arm so their re-sales celebrate.
  const prevRound = useRef(room.round);
  useEffect(() => {
    if (room.round > prevRound.current) celebrated.current = null;
    prevRound.current = room.round;
  }, [room.round]);
  useEffect(() => {
    const resolved = items.filter((i) => i.status === "sold" || i.status === "unsold");
    if (celebrated.current === null) {
      celebrated.current = new Set(resolved.map((i) => i.id));
      return;
    }
    const fresh = resolved.filter((i) => !celebrated.current!.has(i.id));
    if (fresh.length === 0) return;
    fresh.forEach((i) => celebrated.current!.add(i.id));
    const latest = fresh.sort((a, b) => b.order_index - a.order_index)[0];
    setSoldEvent({
      key: Date.now(),
      item: latest,
      teamName: participants.find((p) => p.id === latest.sold_to)?.team_name ?? null,
      currency: room.currency,
    });
  }, [items, participants, room.currency]);

  // Live auctioneer: derives spoken beats + the commentary feed from state.
  useAuctioneer({ room, items, currentItem, itemBids, participants, nowMs });

  const clearSold = useCallback(() => setSoldEvent(null), []);
  const [muted, toggleMuted] = useMuted();
  const [voice, toggleVoice] = useVoice();

  // Warm up TTS on the first user gesture (some browsers gate the first utterance).
  useEffect(() => {
    const prime = () => primeSpeech();
    window.addEventListener("pointerdown", prime, { once: true });
    return () => window.removeEventListener("pointerdown", prime);
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code).then(
      () => toast.success("Room code copied"),
      () => toast.error("Couldn't copy"),
    );
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard" />} aria-label="Back to dashboard">
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-semibold leading-tight">{room.name}</h1>
              <button onClick={copyCode} className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground">
                {room.code} <Copy className="size-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              render={<Link href={`/rooms/${room.code}/projector`} target="_blank" />}
              aria-label="Open watch / cast view"
              title="Cast / projector — big-screen watch view"
            >
              <Tv className="size-4" />
            </Button>
            {isAdmin && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Admin</span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="People in this room">
              <Eye className="size-3.5" />
              {watching} watching
            </span>
            {/* Sound/voice controls are meaningless on a finished results page. */}
            {room.status !== "completed" && (
              <>
                <VoiceSettings />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleVoice}
                  aria-label={voice ? "Turn off auctioneer voice" : "Turn on auctioneer voice"}
                  title={voice ? "Auctioneer voice on" : "Auctioneer voice off"}
                >
                  {voice ? <Megaphone className="size-4" /> : <MegaphoneOff className="size-4 text-muted-foreground" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleMuted}
                  aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                  title={muted ? "Unmute sounds" : "Mute sounds"}
                >
                  {muted ? <VolumeX className="size-4 text-muted-foreground" /> : <Volume2 className="size-4" />}
                </Button>
              </>
            )}
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={`Realtime: ${conn}`}
            >
              <Radio className={`size-3.5 ${conn === "live" ? "text-green-500" : conn === "error" ? "text-destructive" : "text-amber-500"}`} />
              {conn === "live" ? "Live" : conn === "error" ? "Reconnecting" : "Connecting"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {room.status === "lobby" ? (
          <LobbyView
            room={room}
            items={items}
            participants={participants}
            isAdmin={isAdmin}
            myParticipant={myParticipant}
          />
        ) : room.status === "completed" ? (
          <CompletedView room={room} items={items} participants={participants} isAdmin={isAdmin} />
        ) : (
          <AuctionView
            room={room}
            currentItem={currentItem}
            itemBids={itemBids}
            participants={participants}
            isAdmin={isAdmin}
            myParticipant={myParticipant}
            nowMs={nowMs}
          />
        )}
      </main>

      <SoldOverlay event={soldEvent} onDone={clearSold} />
    </div>
  );
}
