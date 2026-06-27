// Display helpers. Currency is a display-only label (numbers are stored raw),
// so formatting just groups digits and prepends the room's chosen label.

/** e.g. ("$", 150000) -> "$150,000" */
export function formatMoney(currency: string, amount: number | null): string {
  if (amount == null) return `${currency}0`;
  return `${currency}${amount.toLocaleString("en-US")}`;
}

/** Compact form for tight spots, e.g. 1500000 -> "1.5M". */
export function formatCompact(currency: string, amount: number | null): string {
  if (amount == null) return `${currency}0`;
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  return `${currency}${compact}`;
}
