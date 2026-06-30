// Voice selection for the DEFAULT auctioneer voice. Prefers smooth neural/online
// English voices (Edge "... Online (Natural)", Chrome "Google ...") over the old
// robotic local ones, falling back to whatever exists. Pure + structurally typed
// so it's unit-testable without a browser (SpeechSynthesisVoice satisfies VoiceLike).

export type VoiceLike = { name: string; lang: string; localService: boolean };

export function scoreVoice(v: VoiceLike): number {
  const name = (v.name || "").toLowerCase();
  const lang = (v.lang || "").toLowerCase();
  let s = 0;
  if (/natural|neural/.test(name)) s += 50;
  if (name.includes("google")) s += 45;
  if (name.includes("online")) s += 40;
  if (/premium|enhanced/.test(name)) s += 30;
  if (v.localService === false) s += 20; // remote voices are usually the good ones
  if (/espeak|compact|desktop/.test(name)) s -= 80; // old robotic/warbly ones
  if (lang.startsWith("en-in")) s += 15;
  else if (lang.startsWith("en-us")) s += 10;
  else if (lang.startsWith("en-gb")) s += 10;
  else if (lang.startsWith("en-au")) s += 8;
  else if (lang.startsWith("en")) s += 6;
  else s -= 20; // we want English commentary
  return s;
}

export function pickBestVoice<T extends VoiceLike>(voices: T[]): T | null {
  if (!voices.length) return null;
  // English first (a non-English voice reading English sounds wrong), then best
  // quality within that pool. Only fall back to all voices if none are English.
  const english = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  return pool.reduce((best, v) => (scoreVoice(v) > scoreVoice(best) ? v : best), pool[0]);
}
