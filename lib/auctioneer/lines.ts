// Templated auctioneer lines. Pools per event; pick() avoids repeating the last
// line of a category; renderLine() fills {vars}. No LLM — instant and local.

export type BeatCategory =
  | "auction_start"
  | "new_player"
  | "first_bid"
  | "raise_small"
  | "raise_big"
  | "bidding_war"
  | "anti_snipe"
  | "going_once"
  | "going_twice"
  | "sold"
  | "unsold";

const POOLS: Record<BeatCategory, string[]> = {
  auction_start: [
    "Welcome to the auction! Let's get bidding.",
    "Here we go — the auction is underway!",
    "Alright, paddles ready. Let's begin!",
  ],
  new_player: [
    "Next up — {player}! {desc}. We open at {base}. Who'll start us off?",
    "Here comes {player}, {desc}. Bidding starts at {base}.",
    "{player} on the block now — {desc}. Base price {base}.",
    "Let's bring up {player}! {desc}. Opening at {base}, who wants in?",
    "Up for grabs — {player}, {desc}. We'll start at {base}.",
  ],
  first_bid: [
    "And we're off — {team} opens at {amount}!",
    "{team} gets the ball rolling at {amount}!",
    "First blood to {team} — {amount}!",
    "Here we go — {team} in at {amount}!",
    "{team} breaks the ice at {amount}!",
  ],
  raise_small: [
    "{team} nudges it to {amount}.",
    "{team} bumps it up — {amount}.",
    "{amount} now, from {team}.",
    "{team} ticks it along to {amount}.",
    "Up to {amount}, {team} in front.",
  ],
  raise_big: [
    "Whoa! {team} slams in {amount}!",
    "Big move from {team} — {amount}!",
    "{team} means business — {amount}!",
    "That's a statement! {team} jumps to {amount}!",
    "{team} goes large — {amount}!",
  ],
  bidding_war: [
    "It's a war now — {amount}!",
    "They're trading blows — {team} at {amount}!",
    "End to end stuff — {amount}!",
    "Toe to toe! {team} hits {amount}!",
    "The paddles are flying — {amount}!",
  ],
  anti_snipe: [
    "Last-second bid! The clock's back on!",
    "Ooh — sneaks in at the death! Time added!",
    "Not so fast! {team} keeps it alive — clock resets!",
    "Right on the buzzer! We're not done — clock's back!",
  ],
  going_once: [
    "Going once… at {amount}…",
    "Going once! Any more out there?",
    "That's going once… last calls now…",
    "Once!… is everyone done at {amount}?",
  ],
  going_twice: [
    "Going twice… last chance…",
    "Twice! Anyone? Speak now…",
    "Going twice at {amount}… don't miss out…",
    "Second call… going twice…",
  ],
  sold: [
    "SOLD! To {team}, for {amount}!",
    "Gone! {player} goes to {team} — {amount}!",
    "That's it — sold to {team} for {amount}! What a buy!",
    "Hammer down! {team} land {player} for {amount}!",
    "Sold! {team} get their man at {amount}!",
  ],
  unsold: [
    "No takers — {player} goes unsold.",
    "Nothing on the board. {player} unsold, we move on.",
    "Couldn't find a buyer — {player} unsold.",
    "And that one passes — {player} goes unsold.",
  ],
};

const lastIdx: Partial<Record<BeatCategory, number>> = {};

function pick(cat: BeatCategory): string {
  const pool = POOLS[cat];
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === lastIdx[cat]) i = (i + 1) % pool.length; // no back-to-back repeat
  lastIdx[cat] = i;
  return pool[i];
}

export type LineVars = Partial<
  Record<"player" | "desc" | "team" | "amount" | "base" | "step", string>
>;

export function renderLine(cat: BeatCategory, vars: LineVars): string {
  return pick(cat).replace(/\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "");
}
