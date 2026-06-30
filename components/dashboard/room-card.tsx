import Link from "next/link";
import { ArrowRight, CheckCircle2, DoorOpen, Pause, Radio, Users, type LucideIcon } from "lucide-react";
import type { RoomStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DeleteRoomButton } from "@/components/dashboard/delete-room-button";
import { CopyCodeButton } from "@/components/dashboard/copy-code-button";

type StatusMeta = { label: string; icon: LucideIcon; badge: string; dot?: boolean };

const STATUS_META: Record<RoomStatus, StatusMeta> = {
  active: { label: "LIVE", icon: Radio, badge: "bg-primary/15 text-primary", dot: true },
  lobby: { label: "LOBBY", icon: DoorOpen, badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  paused: { label: "PAUSED", icon: Pause, badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  completed: { label: "DONE", icon: CheckCircle2, badge: "bg-muted text-muted-foreground" },
};

export type RoomCardData = {
  code: string;
  name: string;
  status: RoomStatus;
  itemCount: number;
  soldCount: number;
  role: "Host" | "Team" | "Demo";
};

export function RoomCard({ room }: { room: RoomCardData }) {
  const meta = STATUS_META[room.status];
  const StatusIcon = meta.icon;
  const pct = room.itemCount > 0 ? Math.round((room.soldCount / room.itemCount) * 100) : 0;

  return (
    <div className="group relative flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40 hover:shadow-xl">
      {/* Stretched link: the whole card is clickable, but sibling controls with
          relative z-10 (the delete button) sit above it and stay interactive. */}
      <Link href={`/rooms/${room.code}`} aria-label={`Open ${room.name}`} className="absolute inset-0 rounded-xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{room.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground">
            {room.code}
            <CopyCodeButton code={room.code} />
          </p>
        </div>
        <Badge variant="secondary" className={cn("gap-1 font-semibold tracking-wide", meta.badge)}>
          {meta.dot ? (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          ) : (
            <StatusIcon className="size-3" />
          )}
          {meta.label}
        </Badge>
      </div>

      {room.status === "active" && room.itemCount > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{room.soldCount} sold / {room.itemCount} players</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {room.status === "completed" && room.itemCount > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          {room.soldCount} sold of {room.itemCount}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="size-4" />
          {room.itemCount} {room.itemCount === 1 ? "player" : "players"} · {room.role}
        </span>
        <div className="flex items-center gap-1">
          {room.role === "Host" && <DeleteRoomButton code={room.code} name={room.name} />}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
}
