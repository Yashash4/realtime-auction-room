"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCurrentItem } from "@/lib/auction";
import type { Bid, Item, Participant, Room } from "@/lib/types";

export type ConnStatus = "connecting" | "live" | "error";

export type AuctionState = {
  room: Room;
  items: Item[];
  participants: Participant[];
  bids: Bid[];
  conn: ConnStatus;
  /** Server-aligned current time in ms, ticking ~4x/sec. */
  nowMs: number;
};

type Initial = {
  room: Room;
  items: Item[];
  participants: Participant[];
  bids: Bid[];
};

const byOrder = (a: Item, b: Item) => a.order_index - b.order_index;

/**
 * Subscribes to all live tables for one room and keeps a local mirror in sync.
 * The DB is the source of truth: on every (re)subscribe we refetch a full
 * snapshot to close any gap between the SSR render and the live subscription
 * (this also handles reconnects and late joiners). The timer is rendered from
 * room.item_ends_at against a server-time offset, and when it expires this hook
 * fires the idempotent resolve_current_item RPC (safe if many clients race).
 */
export function useAuctionRoom(initial: Initial): AuctionState {
  const supabase = useMemo(() => createClient(), []);
  const roomId = initial.room.id;

  const [room, setRoom] = useState<Room>(initial.room);
  const [items, setItems] = useState<Item[]>([...initial.items].sort(byOrder));
  const [participants, setParticipants] = useState<Participant[]>(initial.participants);
  const [bids, setBids] = useState<Bid[]>(initial.bids);
  const [conn, setConn] = useState<ConnStatus>("connecting");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const offsetRef = useRef(0); // serverNow - clientNow, in ms
  const resolveRequestedFor = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    const [r, it, pa, bd] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).single(),
      supabase.from("items").select("*").eq("room_id", roomId).order("order_index"),
      supabase.from("room_participants").select("*").eq("room_id", roomId),
      supabase.from("bids").select("*").eq("room_id", roomId).order("created_at"),
    ]);
    if (r.data) setRoom(r.data as Room);
    if (it.data) setItems((it.data as Item[]).sort(byOrder));
    if (pa.data) setParticipants(pa.data as Participant[]);
    if (bd.data) setBids(bd.data as Bid[]);
  }, [supabase, roomId]);

  // Server-time offset for the countdown.
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("server_now").then(({ data }) => {
      if (!cancelled && data) offsetRef.current = new Date(data as string).getTime() - Date.now();
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Ticking clock (server-aligned).
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now() + offsetRef.current), 250);
    return () => clearInterval(id);
  }, []);

  // Realtime subscriptions.
  useEffect(() => {
    const upsertItem = (row: Item) =>
      setItems((prev) => {
        const next = prev.some((i) => i.id === row.id)
          ? prev.map((i) => (i.id === row.id ? row : i))
          : [...prev, row];
        return next.sort(byOrder);
      });
    const upsertParticipant = (row: Participant) =>
      setParticipants((prev) =>
        prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row],
      );

    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (p) => {
        if (p.new && Object.keys(p.new).length) setRoom(p.new as Room);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `room_id=eq.${roomId}` }, (p) => {
        if (p.eventType === "DELETE") setItems((prev) => prev.filter((i) => i.id === (p.old as Item).id));
        else upsertItem(p.new as Item);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `room_id=eq.${roomId}` }, (p) => {
        if (p.eventType !== "INSERT") return;
        setBids((prev) => (prev.some((b) => b.id === (p.new as Bid).id) ? prev : [...prev, p.new as Bid]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` }, (p) => {
        if (p.eventType === "DELETE")
          setParticipants((prev) => prev.filter((x) => x.id === (p.old as Participant).id));
        else upsertParticipant(p.new as Participant);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConn("live");
          void refetch(); // resync snapshot on connect/reconnect
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConn("error");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId, refetch]);

  // Resilience net: realtime is the fast path, but a dropped or delayed event
  // must never leave a client permanently desynced. Re-sync on tab focus and on
  // a slow poll so state always converges within a few seconds.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(onVisible, 4000); // ponytail: cheap backstop; realtime handles the instant case
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [refetch]);

  // Idempotent client-triggered resolution when the timer expires.
  useEffect(() => {
    if (room.status !== "active" || !room.item_ends_at || !room.current_item_id) return;
    const endMs = new Date(room.item_ends_at).getTime();
    if (nowMs < endMs) {
      resolveRequestedFor.current = null; // re-arm for the current item
      return;
    }
    if (resolveRequestedFor.current === room.current_item_id) return;
    resolveRequestedFor.current = room.current_item_id;
    // Small jitter so a packed room doesn't fire in perfect unison (still idempotent).
    const jitter = 50 + Math.floor((endMs % 200));
    const t = setTimeout(() => {
      resolveCurrentItem(roomId).catch(() => {
        resolveRequestedFor.current = null; // allow a retry on transient failure
      });
    }, jitter);
    return () => clearTimeout(t);
  }, [room.status, room.item_ends_at, room.current_item_id, nowMs, roomId]);

  return { room, items, participants, bids, conn, nowMs };
}
