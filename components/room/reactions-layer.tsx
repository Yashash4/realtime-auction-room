"use client";

import { useReactions } from "@/lib/hooks/use-reactions";

const EMOJIS = ["👏", "🔥", "😮", "❤️", "😂"];

/**
 * Live floating emoji reactions over a Supabase broadcast channel.
 * - Full-screen overlay is pointer-events-none so it never blocks bidding.
 * - A small pill bar (the only interactive bit) sends reactions.
 */
export function ReactionsLayer({ roomId }: { roomId: string }) {
  const { reactions, send } = useReactions(roomId);

  return (
    <>
      <style>{`
        @keyframes reactionFloat {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          15% { opacity: 1; transform: translateY(-4vh) scale(1); }
          100% { transform: translateY(-40vh) scale(1.1); opacity: 0; }
        }
      `}</style>

      {/* Floating overlay — never blocks clicks */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {reactions.map((r) => (
          <span
            key={r.id}
            className="absolute bottom-24 text-3xl select-none drop-shadow-[0_2px_8px_rgba(124,58,237,0.45)]"
            style={{
              left: `calc(50% + ${r.x}px)`,
              animation: "reactionFloat 2.2s ease-out forwards",
            }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Reaction bar — the only interactive part */}
      <div className="pointer-events-auto fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border bg-card px-2 py-1 shadow-lg">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => send(emoji)}
            aria-label={`React ${emoji}`}
            className="rounded-full px-2 py-1 text-xl leading-none transition-transform hover:scale-125 hover:bg-primary/10 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
