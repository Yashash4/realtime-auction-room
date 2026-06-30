"use client";

import { Pause } from "lucide-react";
import { cn } from "@/lib/utils";

/** Circular countdown. msRemaining/totalMs drive the arc; shows whole seconds.
 *  className/numberClassName let callers scale it (e.g. the projector view). */
export function TimerRing({
  msRemaining,
  totalMs,
  paused = false,
  className = "size-40",
  numberClassName = "text-3xl",
}: {
  msRemaining: number;
  totalMs: number;
  paused?: boolean;
  className?: string;
  numberClassName?: string;
}) {
  const clamped = Math.max(0, msRemaining);
  const fraction = totalMs > 0 ? Math.min(1, clamped / totalMs) : 0;
  const seconds = Math.ceil(clamped / 1000);
  const R = 52;
  const C = 2 * Math.PI * R;
  const urgent = clamped <= 5000 && !paused;

  return (
    <div
      className={cn(
        "relative rounded-full transition-shadow duration-300",
        urgent && "animate-pulse shadow-[0_0_40px_-4px] shadow-primary/60",
        className,
      )}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-muted/40" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          className={
            paused
              ? "stroke-amber-500 transition-[stroke-dashoffset] duration-200"
              : urgent
                ? "stroke-primary transition-[stroke-dashoffset] duration-200 drop-shadow-[0_0_6px_var(--color-primary)]"
                : "stroke-primary transition-[stroke-dashoffset] duration-200"
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {paused ? (
          <Pause className="size-1/3 text-amber-500" />
        ) : (
          <>
            <span
              className={cn(
                "font-bold tabular-nums text-foreground",
                numberClassName,
                urgent && "text-primary",
              )}
            >
              {seconds}
            </span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">seconds</span>
          </>
        )}
      </div>
    </div>
  );
}
