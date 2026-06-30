// Self-check for the derived results report. Run:
//   node --experimental-strip-types lib/squad-report.check.mts
import assert from "node:assert";
import { buildResultsReport } from "./squad-report.ts";
import type { Item, Participant, Room } from "./types.ts";

const room = (over: Partial<Room> = {}): Room =>
  ({ currency: "₹", round: 1, ...over }) as Room;

let seq = 0;
const item = (over: Partial<Item>): Item =>
  ({
    id: `i${seq++}`,
    name: "Player",
    base_price: 100000,
    status: "sold",
    sold_to: null,
    sold_price: null,
    ...over,
  }) as Item;

const team = (id: string, name: string, budget_remaining: number): Participant =>
  ({ id, name: name, team_name: name, budget_remaining } as unknown as Participant);

// ---- 1. Normal auction: 2 teams, one wins two players, one wins nothing ----
{
  const tigers = team("t1", "Tigers", 5000000);
  const lions = team("t2", "Lions", 10000000);
  const items: Item[] = [
    item({ name: "Kohli", base_price: 2000000, sold_to: "t1", sold_price: 5000000 }),
    item({ name: "Bumrah", base_price: 1000000, sold_to: "t1", sold_price: 1000000 }), // bargain: at base
    item({ name: "Rahul", base_price: 1500000, status: "unsold", sold_to: null, sold_price: null }),
  ];
  const r = buildResultsReport(room(), items, [tigers, lions]);

  assert.match(r.summary, /2 sold, 1 unsold/, "summary counts");
  assert.match(r.summary, /top buy Kohli for/, "summary names the top buy");

  const labels = r.awards.map((a) => a.label);
  for (const l of ["Biggest spender", "Most players", "Priciest buy", "Best value", "Most budget left"]) {
    assert.ok(labels.includes(l), `award present: ${l}`);
  }
  assert.equal(r.awards.find((a) => a.label === "Biggest spender")!.winner, "Tigers");
  assert.equal(r.awards.find((a) => a.label === "Priciest buy")!.winner, "Kohli");
  // Bumrah sold AT base (ratio 1.0) -> best value over Kohli (ratio 2.5).
  assert.equal(r.awards.find((a) => a.label === "Best value")!.winner, "Bumrah");
  // Lions spent nothing -> most budget left.
  assert.equal(r.awards.find((a) => a.label === "Most budget left")!.winner, "Lions");

  const tigersText = r.reports.find((x) => x.teamId === "t1")!.text;
  assert.match(tigersText, /Tigers/);
  assert.match(tigersText, /Kohli/, "recap headlines the priciest buy");
  assert.match(tigersText, /Bumrah/, "recap names the bargain");

  // A team that won nothing reads as empty-handed, mentioning its purse in words.
  const lionsText = r.reports.find((x) => x.teamId === "t2")!.text;
  assert.match(lionsText, /Lions/);
  assert.match(lionsText, /crore|lakh|purse|unspent|reserve|empty|wallet/i, "empty-team recap");
}

// ---- 2. All-unsold auction: no awards, summary says 0 sold, no crash ----
{
  const a = team("t1", "Alpha", 8000000);
  const items: Item[] = [
    item({ name: "X", status: "unsold", sold_to: null, sold_price: null }),
    item({ name: "Y", status: "unsold", sold_to: null, sold_price: null }),
  ];
  const r = buildResultsReport(room(), items, [a]);
  assert.match(r.summary, /^0 sold, 2 unsold\.$/, "all-unsold summary");
  assert.equal(r.awards.length, 0, "no awards when nothing sold");
  assert.equal(r.reports.length, 1, "still reports each team");
  assert.match(r.reports[0].text, /Alpha/);
}

// ---- 3. Single-player team + rounds mention ----
{
  const a = team("t1", "Solo", 9000000);
  const items: Item[] = [item({ name: "Star", base_price: 500000, sold_to: "t1", sold_price: 1000000 })];
  const r = buildResultsReport(room({ round: 2 }), items, [a]);
  assert.match(r.summary, /^Across 2 rounds — 1 sold, 0 unsold, top buy Star for /, "rounds mentioned");
  assert.match(r.reports[0].text, /Star/);
}

console.log("squad-report self-check: ALL ASSERTS PASSED");
