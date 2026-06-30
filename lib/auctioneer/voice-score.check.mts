// Self-check for default voice selection. Run:
//   node --experimental-strip-types lib/auctioneer/voice-score.check.mts
import assert from "node:assert";
import { pickBestVoice } from "./voice-score.ts";

const v = (name: string, lang: string, localService: boolean) => ({ name, lang, localService });

// Edge-style list: the en-IN Online (Natural) voice must win.
assert.equal(
  pickBestVoice([
    v("Microsoft David Desktop - English (United States)", "en-US", true),
    v("Microsoft Zira Desktop - English (United States)", "en-US", true),
    v("Microsoft Ravi Online (Natural) - English (India)", "en-IN", false),
    v("Microsoft Guy Online (Natural) - English (United States)", "en-US", false),
  ])!.name,
  "Microsoft Ravi Online (Natural) - English (India)",
);

// Chrome-style list: a Google voice beats a plain local one.
assert.equal(
  pickBestVoice([
    v("Microsoft Zira Desktop - English (United States)", "en-US", true),
    v("Google US English", "en-US", false),
  ])!.name,
  "Google US English",
);

// Only robotic options: pick the plain local English over eSpeak.
assert.equal(
  pickBestVoice([
    v("eSpeak English", "en", true),
    v("Microsoft David Desktop - English (United States)", "en-US", true),
  ])!.name,
  "Microsoft David Desktop - English (United States)",
);

// English is preferred over a non-English neural voice.
assert.equal(
  pickBestVoice([
    v("Microsoft Elsa Online (Natural) - Italian (Italy)", "it-IT", false),
    v("Google UK English Female", "en-GB", false),
  ])!.name,
  "Google UK English Female",
);

console.log("voice-score self-check: ALL ASSERTS PASSED");
