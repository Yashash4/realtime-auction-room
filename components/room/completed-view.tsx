"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Crown, Download, PiggyBank, RotateCcw, Share2, Tag, TrendingUp, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Item, Participant, Room } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { startUnsoldRound } from "@/lib/auction";
import { buildResultsReport, type Award } from "@/lib/squad-report";
import { cn } from "@/lib/utils";
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

  // Standout squad = most spent, tie-broken by player count (squads already sorted by spent).
  const standoutId = squads.length
    ? squads.reduce((best, s) =>
        s.spent > best.spent || (s.spent === best.spent && s.players.length > best.players.length) ? s : best,
      ).team.id
    : null;

  // Top stat callouts — all derived from items/participants, no API.
  const totalSpent = sold.reduce((s, i) => s + (i.sold_price ?? 0), 0);
  const highestSale = sold.reduce((m, i) => Math.max(m, i.sold_price ?? 0), 0);
  const budgetLeft = participants.reduce((s, p) => s + p.budget_remaining, 0);
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Users, label: "Players sold", value: String(sold.length) },
    { icon: Banknote, label: "Total spent", value: formatAmount(totalSpent, room.currency) },
    { icon: TrendingUp, label: "Highest sale", value: formatAmount(highestSale, room.currency) },
    { icon: Wallet, label: "Budget left", value: formatAmount(budgetLeft, room.currency) },
  ];

  // Derived (no API): one-line summary, awards board, per-team recaps.
  const report = buildResultsReport(room, items, participants);
  const recapByTeam = new Map(report.reports.map((r) => [r.teamId, r.text]));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-lg ring-1 ring-primary/30">
          <Trophy className="size-7" />
        </div>
        <h2 className="text-3xl font-black tracking-tight">Auction complete</h2>
        {room.round > 1 && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            After Round {room.round}
          </span>
        )}
        <p className="max-w-xl text-sm text-muted-foreground">{report.summary}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={shareResults}>
            <Share2 />
            Share results
          </Button>
          <Button variant="outline" render={<a href={`/api/rooms/${room.code}/results`} />}>
            <Download />
            Download CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-lg">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <Icon className="size-3.5 text-primary" /> {s.label}
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      {isAdmin && unsold.length > 0 && (
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{unsold.length} player{unsold.length === 1 ? "" : "s"} went unsold</p>
            <p className="text-sm text-muted-foreground">
              Reopens unsold players at reduced base prices for a new round.
            </p>
          </div>
          <Button disabled={reauctioning} onClick={reauction} className="shrink-0">
            <RotateCcw />
            Re-auction unsold (Round {room.round + 1})
          </Button>
        </section>
      )}

      {report.awards.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium">Awards</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.awards.map((a) => {
              const Icon = AWARD_ICON[a.icon];
              return (
                <div key={a.label} className="rounded-xl border bg-card p-4 shadow-lg">
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
        <div className="overflow-hidden rounded-xl border shadow-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Player</th>
                <th className="px-4 py-2.5 font-medium">Won by</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => {
                const isUnsold = it.status !== "sold";
                return (
                  <tr key={it.id} className={isUnsold ? "opacity-60" : undefined}>
                    <td className={cn("px-4 py-2.5", isUnsold && "line-through")}>{it.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {isUnsold ? "—" : (teamById.get(it.sold_to ?? "")?.team_name ?? "—")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {isUnsold ? (
                        <span className="text-muted-foreground">unsold</span>
                      ) : (
                        formatAmount(it.sold_price, room.currency)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Squads</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {squads.map(({ team, players, spent }) => {
            const isStandout = team.id === standoutId;
            return (
              <div
                key={team.id}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-lg",
                  isStandout && "ring-2 ring-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    {isStandout && <Crown className="size-4 text-primary" />}
                    {team.team_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {players.length} {players.length === 1 ? "player" : "players"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Spent {formatAmount(spent, room.currency)} · {formatAmount(team.budget_remaining, room.currency)} left
                </p>
                {players.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {players.map((pl) => (
                      <li key={pl.id} className="flex justify-between">
                        <span>{pl.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatAmount(pl.sold_price, room.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
                  {recapByTeam.get(team.id)}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
