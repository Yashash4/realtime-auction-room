import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import type { RoomStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<RoomStatus, string> = {
  lobby: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  active: "bg-green-500/15 text-green-600 dark:text-green-400",
  paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  completed: "bg-muted text-muted-foreground",
};

export type RoomCardData = {
  code: string;
  name: string;
  status: RoomStatus;
  itemCount: number;
  role: "Host" | "Team" | "Demo";
};

export function RoomCard({ room }: { room: RoomCardData }) {
  return (
    <Link
      href={`/rooms/${room.code}`}
      className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{room.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{room.code}</p>
        </div>
        <Badge variant="secondary" className={STATUS_STYLES[room.status]}>
          {room.status}
        </Badge>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="size-4" />
          {room.itemCount} {room.itemCount === 1 ? "player" : "players"} · {room.role}
        </span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
