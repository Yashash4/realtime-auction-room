import Link from "next/link";
import { Banknote, Crown, Gavel, PiggyBank, SearchX, Tag, TrendingUp, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format";
import { buildResultsReport, type Award } from "@/lib/squad-report";
import type { Item, Participant, Room } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { SquadList } from "@/components/room/squad-list";

const AWARD_ICON: Record<Award["icon"], LucideIcon> = {
  spender: Banknote,
  players: Users,
  priciest: Crown,
  value: Tag,
  budget: PiggyBank,
};

export const dynamic = "force-dynamic";

// Shape of get_room_results(token) — a public, completed-room-only results doc.
// No ids, no emails, no user_id; team names are the only participant data.
type ShareResults = {
  room: { name: string; currency: string; round: number };
  players: {
    name: string;
    role: string | null;
    status: "sold" | "unsold";
    won_by: string | null;
    price: number | null;
  }[];
  teams: {
    team_name: string;
    budget_remaining: number;
    spent: number;
    player_count: number;
    players: { name: string; price: number }[];
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let data: ShareResults | null = null;
  if (UUID.test(token)) {
    const supabase = await createClient();
    const { data: res } = await supabase.rpc("get_room_results", { p_token: token });
    data = (res as ShareResults | null) ?? null;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Nav />
      {data ? <Results data={data} /> : <NotAvailable />}
      <Cta />
    </div>
  );
}

function Nav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gavel className="size-4" />
          </span>
          Auction Room
        </Link>
        <Button variant="ghost" size="sm" render={<Link href="/login" />}>
          Log in
        </Button>
      </div>
    </header>
  );
}

function Cta() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">Want to run your own live auction?</p>
        <Button render={<Link href="/register" />}>Create your own auction</Button>
      </div>
    </footer>
  );
}

function NotAvailable() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Results not available</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This share link is invalid, or its auction hasn&apos;t finished yet. Results appear here once
          the auction is complete.
        </p>
      </div>
    </main>
  );
}

function Results({ data }: { data: ShareResults }) {
  const { room, players, teams } = data;
  const soldCount = players.filter((p) => p.status === "sold").length;
  const unsoldCount = players.length - soldCount;

  // Synthetic inputs for the pure, API-free report builder (shared with the
  // logged-in results view). The share doc carries no ids, so team names double
  // as participant ids and sold_to references.
  const participants = teams.map((t) => ({
    id: t.team_name,
    team_name: t.team_name,
    budget_remaining: t.budget_remaining,
  })) as unknown as Participant[];
  const items = players.map((p, i) => ({
    id: String(i),
    name: p.name,
    role: p.role,
    status: p.status,
    sold_to: p.won_by,
    sold_price: p.price,
    base_price: 0,
    order_index: i,
  })) as unknown as Item[];
  const report = buildResultsReport(
    { currency: room.currency, round: room.round } as unknown as Room,
    items,
    participants,
  );
  const recapByTeam = new Map(report.reports.map((r) => [r.teamName, r.text]));
  const standoutName = teams.length ? teams.reduce((b, t) => (t.spent > b.spent ? t : b), teams[0]).team_name : null;
  const squadData = teams.map((t) => ({
    name: t.team_name,
    players: t.players.map((pl) => ({ name: pl.name, price: pl.price })),
    spent: t.spent,
    budgetLeft: t.budget_remaining,
    standout: t.team_name === standoutName,
    recap: recapByTeam.get(t.team_name) ?? "",
  }));

  const totalSpent = players.reduce((s, p) => s + (p.status === "sold" ? (p.price ?? 0) : 0), 0);
  const highestSale = players.reduce((m, p) => Math.max(m, p.status === "sold" ? (p.price ?? 0) : 0), 0);
  const budgetLeft = teams.reduce((s, t) => s + t.budget_remaining, 0);
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Users, label: "Players sold", value: String(soldCount) },
    { icon: Banknote, label: "Total spent", value: formatAmount(totalSpent, room.currency) },
    { icon: TrendingUp, label: "Highest sale", value: formatAmount(highestSale, room.currency) },
    { icon: Wallet, label: "Budget left", value: formatAmount(budgetLeft, room.currency) },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <Trophy className="size-6" />
        </div>
        <h2 className="text-2xl font-bold">{room.name}</h2>
        {room.round > 1 && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            After Round {room.round}
          </span>
        )}
        <p className="text-sm text-muted-foreground">
          Final results · {soldCount} sold · {unsoldCount} unsold
        </p>
        <p className="max-w-xl text-sm text-muted-foreground">{report.summary}</p>
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

      {/* Squads above the results, stacked + collapsible (standout opens). */}
      <section className="space-y-3">
        <h3 className="font-medium">Squads</h3>
        <SquadList squads={squadData} currency={room.currency} />
      </section>

      {/* Results scroll inside this box so a long player list doesn't scroll the page. */}
      <section className="space-y-3">
        <h3 className="font-medium">Results</h3>
        <div className="max-h-[28rem] overflow-y-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Player</th>
                <th className="px-4 py-2.5 font-medium">Won by</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {players.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5">
                    {p.name}
                    {p.role && <span className="ml-2 text-xs text-muted-foreground">{p.role}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.won_by ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.status === "sold" ? (
                      formatAmount(p.price, room.currency)
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
    </main>
  );
}
