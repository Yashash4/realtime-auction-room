"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Gavel, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type LiveRoom = { id: string; code: string; name: string; host: string; currentPlayer: string | null };

type RoomRow = {
  id: string;
  code: string;
  name: string;
  admin_id: string;
  currentItem: { name: string } | { name: string }[] | null;
};

/**
 * "Live now" — in-progress auctions visible to every logged-in user. Updates
 * live: re-fetches on any rooms change (+ a slow safety poll), and tracks each
 * room's realtime presence for the "X watching" count. Cards link to the shared
 * read-only watch view, openable even by non-members.
 */
export function LiveNow({ initial }: { initial: LiveRoom[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rooms, setRooms] = useState<LiveRoom[]>(initial);
  const [watching, setWatching] = useState<Record<string, number>>({});
  const channels = useRef(new Map<string, ReturnType<typeof supabase.channel>>());

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("rooms")
      .select("id, code, name, admin_id, currentItem:items!rooms_current_item_fk(name)")
      .in("status", ["active", "paused"])
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    if (!data) return;
    const rows = data as unknown as RoomRow[];
    const adminIds = [...new Set(rows.map((r) => r.admin_id))];
    const { data: profs } = adminIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", adminIds)
      : { data: [] };
    const hostBy = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
    setRooms(
      rows.map((r) => {
        const ci = Array.isArray(r.currentItem) ? r.currentItem[0] : r.currentItem;
        return { id: r.id, code: r.code, name: r.name, host: hostBy.get(r.admin_id) ?? "Host", currentPlayer: ci?.name ?? null };
      }),
    );
  }, [supabase]);

  // Keep the list live: any rooms change triggers a refetch, plus a slow poll.
  useEffect(() => {
    const ch = supabase
      .channel("dash:rooms")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void refetch())
      .subscribe();
    const poll = setInterval(() => void refetch(), 6000);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [supabase, refetch]);

  // Track each live room's presence for the "X watching" count.
  useEffect(() => {
    const ids = new Set(rooms.map((r) => r.id));
    for (const [id, ch] of channels.current) {
      if (!ids.has(id)) {
        void supabase.removeChannel(ch);
        channels.current.delete(id);
      }
    }
    for (const r of rooms) {
      if (channels.current.has(r.id)) continue;
      const ch = supabase
        .channel(`room:${r.id}`, { config: { presence: { key: `dash-${r.id}` } } })
        .on("presence", { event: "sync" }, () => {
          setWatching((w) => ({ ...w, [r.id]: Object.keys(ch.presenceState()).length }));
        })
        .subscribe();
      channels.current.set(r.id, ch);
    }
  }, [rooms, supabase]);

  useEffect(() => {
    const map = channels.current;
    return () => {
      for (const ch of map.values()) void supabase.removeChannel(ch);
      map.clear();
    };
  }, [supabase]);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">Live now</h2>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          No live auctions right now.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/rooms/${r.code}/projector`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-primary/20 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,color-mix(in_oklch,var(--color-primary)_12%,transparent),transparent_60%)]"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{r.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">Hosted by {r.host}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                  <Radio className="size-3" /> Live
                </span>
              </div>
              <div className="relative mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Gavel className="size-4 shrink-0" />
                  <span className="truncate">{r.currentPlayer ?? "Starting…"}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Eye className="size-4" />
                  {watching[r.id] ?? "–"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
