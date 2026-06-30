// On-screen amount display. Currency is a display-only label (amounts are stored
// and compared as raw integers). Everything on screen uses the COMPACT form:
// Indian (Cr/L) for ₹ rooms, western (K/M) for any other admin-set currency — so
// a $ room never says "Cr". Spoken auctioneer words are separate (lib/inr-words).
// User-typed inputs (create-room budget, base price) stay raw, not compacted.

/** N.toFixed(d) with trailing zeros (and a bare dot) trimmed: 10.00 -> "10", 1.50 -> "1.5". */
function trimDec(n: number, decimals: number): string {
  const s = n.toFixed(decimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/**
 * Compact amount keyed off the room's currency label.
 *   ₹:        >=1cr "₹1.55 Cr" (2dp) · >=1L "₹22.5 L" (1dp) · else "₹12,345" (Indian-grouped)
 *   $ / € / £: >=1M "$1.55M" (2dp) · >=1K "$22.5K" (1dp) · else "$999" (grouped)
 * Trailing zeros trimmed (₹10 Cr, not ₹10.00 Cr); enough precision to never round
 * ₹1.55 Cr up to ₹2 Cr. Display only — bids/budgets stay exact integers underneath.
 */
export function formatAmount(value: number | null, currency: string): string {
  const n = value ?? 0;
  if (currency === "₹") {
    if (n >= 1e7) return `₹${trimDec(n / 1e7, 2)} Cr`;
    if (n >= 1e5) return `₹${trimDec(n / 1e5, 1)} L`;
    return `₹${n.toLocaleString("en-IN")}`;
  }
  if (n >= 1e6) return `${currency}${trimDec(n / 1e6, 2)}M`;
  if (n >= 1e3) return `${currency}${trimDec(n / 1e3, 1)}K`;
  return `${currency}${n.toLocaleString("en-US")}`;
}
