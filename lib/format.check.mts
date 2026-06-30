// Self-check for the compact amount formatter. Run:
//   node --experimental-strip-types lib/format.check.mts
import assert from "node:assert";
import { formatAmount } from "./format.ts";

// ---- Indian (₹) ----
assert.equal(formatAmount(100000000, "₹"), "₹10 Cr", "10 crore, trailing zeros trimmed");
assert.equal(formatAmount(15500000, "₹"), "₹1.55 Cr", "precision kept, not rounded to 2 Cr");
assert.equal(formatAmount(20000000, "₹"), "₹2 Cr");
assert.equal(formatAmount(5000000, "₹"), "₹50 L");
assert.equal(formatAmount(2250000, "₹"), "₹22.5 L");
assert.equal(formatAmount(100000, "₹"), "₹1 L");
assert.equal(formatAmount(99999, "₹"), "₹99,999", "below 1 lakh -> Indian-grouped full number");
assert.equal(formatAmount(50000, "₹"), "₹50,000");
assert.equal(formatAmount(0, "₹"), "₹0");
assert.equal(formatAmount(null, "₹"), "₹0");

// ---- Western (admin-set non-₹) never says "Cr" ----
assert.equal(formatAmount(100000000, "$"), "$100M");
assert.equal(formatAmount(1550000, "$"), "$1.55M");
assert.equal(formatAmount(50000, "$"), "$50K");
assert.equal(formatAmount(22500, "€"), "€22.5K");
assert.equal(formatAmount(999, "$"), "$999");
assert.ok(!formatAmount(100000000, "$").includes("Cr"), "no Cr in a $ room");
assert.ok(!formatAmount(100000000, "£").includes("L"), "no L suffix in a £ room");

console.log("format self-check: ALL ASSERTS PASSED");
