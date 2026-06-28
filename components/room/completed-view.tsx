"use client";

import { Trophy } from "lucide-react";
import type { Item, Participant, Room } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export function CompletedView({
  room,
  items,
  participants,
}: {
  room: Room;
  items: Item[];
  participants: Participant[];
}) {
  const teamById = new Map(participants.map((p) => [p.id, p]));
  const sold = items.filter((i) => i.status === "sold");
  const unsold = items.filter((i) => i.status === "unsold");

  const squads = participants
    .map((p) => {
      const players = sold.filter((i) => i.sold_to === p.id);
      const spent = players.reduce((s, i) => s + (i.sold_price ?? 0), 0);
      return { team: p, players, spent };
    })
    .sort((a, b) => b.spent - a.spent);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <Trophy className="size-6" />
        </div>
        <h2 className="text-2xl font-bold">Auction complete</h2>
        <p className="text-sm text-muted-foreground">
          {sold.length} sold · {unsold.length} unsold
        </p>
      </div>

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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
