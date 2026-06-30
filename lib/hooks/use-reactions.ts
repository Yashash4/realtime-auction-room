"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FLOAT_MS = 2200;
const THROTTLE_WINDOW_MS = 2000;
const THROTTLE_MAX = 3;

export type Reaction = { id: number; emoji: string; x: number };

/**
 * Ephemeral floating reactions over a Supabase Realtime *broadcast* channel
 * (no DB table). Separate channel from the auction hook's `room:${roomId}`.
 */
export function useReactions(roomId: string): {
  reactions: Reaction[];
  send: (emoji: string) => void;
} {
  const supabase = useMemo(() => createClient(), []);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const nextId = useRef(0);
  const sentAt = useRef<number[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`reactions:${roomId}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const emoji = (payload as { emoji?: string })?.emoji;
        if (!emoji) return;
        const id = nextId.current++;
        const x = Math.random() * 60 - 30; // -30..30 horizontal drift
        setReactions((prev) => [...prev, { id, emoji, x }]);
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== id));
        }, FLOAT_MS);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId]);

  const send = useCallback((emoji: string) => {
    const now = Date.now();
    const recent = sentAt.current.filter((t) => now - t < THROTTLE_WINDOW_MS);
    if (recent.length >= THROTTLE_MAX) {
      sentAt.current = recent; // silent no-op
      return;
    }
    recent.push(now);
    sentAt.current = recent;
    channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
  }, []);

  return { reactions, send };
}
