// Spoken money words. Indian system (crore/lakh) for ₹ rooms, international
// (million/thousand) otherwise. Returns the magnitude only ("two crore"), no
// currency word — the auctioneer templates read naturally as "sold for two crore".

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

/** 0..999 in words. Multiplier groups (crore/lakh/million counts) never exceed this in practice. */
function underThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(underHundred(r));
  return parts.join(" ");
}

function group(parts: string[], count: number, label: string) {
  if (count > 0) parts.push(`${underThousand(count)} ${label}`);
}

/** Indian: crore (1e7), lakh (1e5), thousand (1e3), rest. e.g. 25000000 -> "two crore fifty lakh". */
export function inrWords(amount: number): string {
  let n = Math.max(0, Math.floor(amount));
  if (n === 0) return "nothing";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const parts: string[] = [];
  group(parts, crore, "crore");
  group(parts, lakh, "lakh");
  group(parts, thousand, "thousand");
  if (n) parts.push(underThousand(n));
  return parts.join(" ");
}

/** International: million (1e6), thousand (1e3), rest. e.g. 2050000 -> "two million fifty thousand". */
export function intlWords(amount: number): string {
  let n = Math.max(0, Math.floor(amount));
  if (n === 0) return "nothing";
  const million = Math.floor(n / 1000000); n %= 1000000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const parts: string[] = [];
  group(parts, million, "million");
  group(parts, thousand, "thousand");
  if (n) parts.push(underThousand(n));
  return parts.join(" ");
}

/** Spoken magnitude for a room's currency: Indian for ₹, international otherwise. */
export function moneyWords(currency: string, amount: number): string {
  return currency === "₹" ? inrWords(amount) : intlWords(amount);
}
