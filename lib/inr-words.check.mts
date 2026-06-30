// Self-check for inr-words. Run: node --experimental-strip-types lib/inr-words.check.mts
// Not part of the Next build (tsconfig includes **/*.ts, not .mts).

import assert from "node:assert";
import { inrWords, intlWords, moneyWords } from "./inr-words.ts";

// Clean lakh / crore
assert.equal(inrWords(2_00_00_000), "two crore"); // 2 crore
assert.equal(inrWords(50_00_000), "fifty lakh");

// Thousands and non-round amounts (the cases that matter)
assert.equal(inrWords(50_000), "fifty thousand");
assert.equal(inrWords(14_00_000), "fourteen lakh");
assert.equal(inrWords(1_05_00_000), "one crore five lakh"); // 1 crore 5 lakh
assert.equal(inrWords(1_55_000), "one lakh fifty five thousand");
assert.equal(inrWords(12_34_567), "twelve lakh thirty four thousand five hundred sixty seven");
assert.equal(inrWords(2_001), "two thousand one");
assert.equal(inrWords(2_25_000), "two lakh twenty five thousand");
assert.equal(inrWords(0), "nothing");

// International
assert.equal(intlWords(2_050_000), "two million fifty thousand");
assert.equal(intlWords(1_500), "one thousand five hundred");
assert.equal(intlWords(50_000), "fifty thousand");

// Currency routing
assert.equal(moneyWords("₹", 2_00_00_000), "two crore");
assert.equal(moneyWords("$", 2_000_000), "two million");

console.log("inr-words self-check: ALL ASSERTS PASSED");
