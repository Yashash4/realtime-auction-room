"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Crown, Download, PiggyBank, RotateCcw, Share2, Tag, Trophy, Users, type LucideIcon } from "lucide-react";
import type { Item, Participant, Room } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { startUnsoldRound } from "@/lib/auction";
import { buildResultsReport, type Award } from "@/lib/squad-report";
import { Button } from "@/components/ui/button";

const AWARD_ICON: Record<Award["icon"], LucideIcon> = {
  spender: Banknote,
  players: Users,
  priciest: Crown,
  value: Tag,
  budget: PiggyBank,
};

export function CompletedView({
  room,
  items,
  participants,
  isAdmin,
}: {
  room: Room;
  items: Item[];
  participants: Participant[];
  isAdmin: boolean;
}) {
  const teamById = new Map(participants.map((p) => [p.id, p]));
  const sold = items.filter((i) => i.status === "sold");
  const unsold = items.filter((i) => i.status === "unsold");

  const shareResults = () => {
    const url = `${window.location.origin}/share/${room.share_token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Public results link copied"),
      () => toast.error("Couldn't copy the link"),
    );
  };

  const [reauctioning, setReauctioning] = useState(false);
  const reauction = async () => {
    setReauctioning(true);
    try {
      await startUnsoldRound(room.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the round");
      setReauctioning(false); // success transitions the room out of this view via realtime
    }
  };

  const squads = participants
    .map((p) => {
      const players = sold.filter((i) => i.sold_to === p.id);
      const spent = players.reduce((s, i) => s + (i.sold_price ?? 0), 0);
      return { team: p, players, spent };
    })
    .sort((a, b) => b.spent - a.spent);

  // Derived (no API): one-line summary, awards board, per-team recaps.
  const report = buildResultsReport(room, items, participants);
  const recapByTeam = new Map(report.reports.map((r) => [r.teamId, r.text]));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <Trophy className="size-6" />
        </div>
        <h2 className="text-2xl font-bold">Auction complete</h2>
        {room.round > 1 && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            After Round {room.round}
          </span>
        )}
        <p className="max-w-xl text-sm text-muted-foreground">{report.summary}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" render={<a href={`/api/rooms/${room.code}/results`} />}>
            <Download />
            Download CSV
          </Button>
          <Button variant="outline" onClick={shareResults}>
            <Share2 />
            Share results
          </Button>
          {isAdmin && unsold.length > 0 && (
            <Button disabled={reauctioning} onClick={reauction}>
              <RotateCcw />
              Re-auction unsold (Round {room.round + 1})
            </Button>
          )}
        </div>
      </div>

      {report.awards.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium">Awards</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.awards.map((a) => {
              const Icon = AWARD_ICON[a.icon];
              return (
                <div key={a.label} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    <Icon className="size-3.5 text-primary" /> {a.label}
                  </div>
                  <p className="mt-2 font-semibold leading-tight">{a.winner}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.value}
                    {a.sub ? ` · ${a.sub}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-medium">Results</h3>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Player</th>
                <th className="px-4 py-2.5 font-medium">Won by</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2.5">{it.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {it.status === "sold" ? (teamById.get(it.sold_to ?? "")?.team_name ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {it.status === "sold" ? (
                      formatMoney(room.currency, it.sold_price)
                    ) : (
                      <span className="text-muted-foreground">unsold</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Squads</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {squads.map(({ team, players, spent }) => (
            <div key={team.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{team.team_name}</span>
                <span className="text-xs text-muted-foreground">
                  {players.length} {players.length === 1 ? "player" : "players"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Spent {formatMoney(room.currency, spent)} · {formatMoney(room.currency, team.budget_remaining)} left
              </p>
              {players.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {players.map((pl) => (
                    <li key={pl.id} className="flex justify-between">
                      <span>{pl.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMoney(room.currency, pl.sold_price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 border-t pt-3 text-sm italic leading-relaxed text-muted-foreground">
                {recapByTeam.get(team.id)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
