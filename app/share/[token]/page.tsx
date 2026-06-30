import Link from "next/link";
import { Gavel, SearchX, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";

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
              {players.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5">
                    {p.name}
                    {p.role && <span className="ml-2 text-xs text-muted-foreground">{p.role}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.won_by ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.status === "sold" ? (
                      formatMoney(room.currency, p.price)
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
          {teams.map((t, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.team_name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.player_count} {t.player_count === 1 ? "player" : "players"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Spent {formatMoney(room.currency, t.spent)} · {formatMoney(room.currency, t.budget_remaining)} left
              </p>
              {t.players.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {t.players.map((pl, j) => (
                    <li key={j} className="flex justify-between">
                      <span>{pl.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMoney(room.currency, pl.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
