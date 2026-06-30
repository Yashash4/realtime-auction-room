// Results-page extras, all DERIVED from the final results (no API, no tables,
// no LLM): a one-line auction summary, a small awards board, and a templated
// journalist-style recap per team. Phrasing varies by team index so squads read
// differently, and money is spoken in words (Indian for ₹). Pure + deterministic
// (no Math.random) so it's stable across SSR/hydration. Relative imports keep the
// self-check runnable under `node --experimental-strip-types`.

import type { Item, Participant, Room } from "./types";
// Explicit .ts on the runtime imports so the sibling self-check runs under
// `node --experimental-strip-types` (Next/tsc resolve these fine either way).
import { moneyWords } from "./inr-words.ts";
import { formatAmount } from "./format.ts";

export type Award = {
  icon: "spender" | "players" | "priciest" | "value" | "budget";
  label: string;
  winner: string;
  value: string;
  sub?: string;
};

export type SquadReport = { teamId: string; teamName: string; text: string };

export type ResultsReport = {
  summary: string;
  awards: Award[];
  reports: SquadReport[];
};

type Agg = { p: Participant; players: Item[]; spent: number; count: number };

const byPriceDesc = (a: Item, b: Item) => (b.sold_price ?? 0) - (a.sold_price ?? 0);

/**
 * The best-value pick: lowest sold price RELATIVE to base (smallest premium over
 * the base price). Falls back to the lowest absolute price when no player had a
 * positive base. Returns null for an empty list.
 */
function bargainOf(players: Item[]): Item | null {
  const withBase = players.filter((i) => i.base_price > 0);
  const pool = withBase.length ? withBase : players;
  if (pool.length === 0) return null;
  const ratio = (i: Item) => (i.sold_price ?? 0) / (i.base_price > 0 ? i.base_price : 1);
  return pool.slice().sort((a, b) => ratio(a) - ratio(b) || (a.sold_price ?? 0) - (b.sold_price ?? 0))[0];
}

const pick = <T>(arr: T[], seed: number): T => arr[seed % arr.length];
const fill = (t: string, vars: Record<string, string>) =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

const EMPTY_LINES = [
  "{team} went home empty-handed, holding on to their full purse of {budget}.",
  "{team} kept their wallet shut — not a single signing, {budget} left in the bank.",
  "A quiet night for {team}: no players bought, {budget} left unspent.",
];
const ONE_LINES = [
  "{team} made just one move, landing {top} for {topPrice} — {budget} still in reserve.",
  "{team}'s night came down to a single buy: {top} at {topPrice}, with {budget} to spare.",
  "One and done for {team} — {top} for {topPrice}, {budget} kept back.",
];
const MANY_LINES = [
  "{team} splashed {spent} on {count} players, headlined by {top} at {topPrice}; their bargain of the night was {bargain} at {bargainPrice}.",
  "{team} built a {count}-player squad for {spent}, marquee signing {top} ({topPrice}). Best value: {bargain} at {bargainPrice}.",
  "A busy night for {team} — {count} players, {spent} spent. {top} was the big-ticket buy at {topPrice}, while {bargain} ({bargainPrice}) looked a steal.",
  "{team} committed {spent} for {count} players, led by {top} at {topPrice}; {bargain} at {bargainPrice} may prove the shrewdest pick.",
];

function recap(a: Agg, idx: number, words: (n: number) => string): string {
  const team = a.p.team_name;
  if (a.count === 0) {
    return fill(pick(EMPTY_LINES, idx), { team, budget: words(a.p.budget_remaining) });
  }
  const top = a.players[0];
  if (a.count === 1) {
    return fill(pick(ONE_LINES, idx), {
      team,
      top: top.name,
      topPrice: words(top.sold_price ?? 0),
      budget: words(a.p.budget_remaining),
    });
  }
  let bargain = bargainOf(a.players)!;
  if (bargain.id === top.id) bargain = a.players[a.players.length - 1]; // cheapest, so it differs from the headline
  return fill(pick(MANY_LINES, idx), {
    team,
    count: String(a.count),
    spent: words(a.spent),
    top: top.name,
    topPrice: words(top.sold_price ?? 0),
    bargain: bargain.name,
    bargainPrice: words(bargain.sold_price ?? 0),
  });
}

export function buildResultsReport(
  room: Room,
  items: Item[],
  participants: Participant[],
): ResultsReport {
  const words = (n: number) => moneyWords(room.currency, n);
  const money = (n: number) => formatAmount(n, room.currency);

  const sold = items.filter((i) => i.status === "sold" && i.sold_price != null);
  const unsold = items.filter((i) => i.status === "unsold");

  const aggs: Agg[] = participants.map((p) => {
    const players = sold.filter((i) => i.sold_to === p.id).slice().sort(byPriceDesc);
    return { p, players, spent: players.reduce((s, i) => s + (i.sold_price ?? 0), 0), count: players.length };
  });

  // ---- One-line summary ----
  const topBuy = sold.slice().sort(byPriceDesc)[0] ?? null;
  const parts = [`${sold.length} sold`, `${unsold.length} unsold`];
  if (topBuy) parts.push(`top buy ${topBuy.name} for ${words(topBuy.sold_price ?? 0)}`);
  const joined = parts.join(", ");
  const summary = room.round > 1 ? `Across ${room.round} rounds — ${joined}.` : `${joined}.`;

  // ---- Awards (only meaningful once something has sold) ----
  const awards: Award[] = [];
  if (sold.length > 0) {
    const spender = aggs.filter((a) => a.spent > 0).sort((a, b) => b.spent - a.spent)[0];
    if (spender) awards.push({ icon: "spender", label: "Biggest spender", winner: spender.p.team_name, value: money(spender.spent) });

    const most = aggs.filter((a) => a.count > 0).sort((a, b) => b.count - a.count)[0];
    if (most) awards.push({ icon: "players", label: "Most players", winner: most.p.team_name, value: `${most.count} ${most.count === 1 ? "player" : "players"}` });

    if (topBuy) {
      const team = participants.find((p) => p.id === topBuy.sold_to)?.team_name;
      awards.push({ icon: "priciest", label: "Priciest buy", winner: topBuy.name, value: money(topBuy.sold_price ?? 0), sub: team });
    }

    const bargain = bargainOf(sold);
    if (bargain) {
      const team = participants.find((p) => p.id === bargain.sold_to)?.team_name;
      awards.push({ icon: "value", label: "Best value", winner: bargain.name, value: money(bargain.sold_price ?? 0), sub: team ? `won by ${team}` : undefined });
    }

    const richest = aggs.slice().sort((a, b) => b.p.budget_remaining - a.p.budget_remaining)[0];
    if (richest) awards.push({ icon: "budget", label: "Most budget left", winner: richest.p.team_name, value: money(richest.p.budget_remaining) });
  }

  // ---- Per-team recaps (phrasing varies by team index) ----
  const reports: SquadReport[] = aggs.map((a, idx) => ({
    teamId: a.p.id,
    teamName: a.p.team_name,
    text: recap(a, idx, words),
  }));

  return { summary, awards, reports };
}
