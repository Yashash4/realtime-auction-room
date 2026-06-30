// Narrator: one speech pipeline that both speaks (browser speechSynthesis) and
// emits the on-screen feed. Pacing keeps the voice in sync with live state:
//   - critical beats (sold / gone / anti-snipe) interrupt and flush lower lanes
//   - normal beats (intro, going once/twice, milestones, bookends) queue, but are
//     stale-dropped on dequeue
//   - raise beats coalesce into ONE slot (only the CURRENT high is announced)
//   - flavor beats (budget / spree / lull) coalesce into a LAST slot, played only
//     when nothing meaningful is pending — so they never delay the real beats
// When voice is off/muted (or TTS blocked) each beat is "spoken" via an estimated
// timer instead, so the feed (and the spoken-line highlight) still pace like speech.

import { useCallback, useEffect, useState } from "react";
import { isMuted } from "@/lib/sound";
import type { BeatCategory } from "@/lib/auctioneer/lines";

const VKEY = "auction:voice";
const CFG_KEY = "auction:voicecfg";

export function voiceOn(): boolean {
  try {
    return localStorage.getItem(VKEY) !== "0"; // default ON
  } catch {
    return true;
  }
}
export function setVoiceOn(v: boolean): void {
  try {
    localStorage.setItem(VKEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export type VoiceConfig = { voiceURI: string | null; rate: number; volume: number };
const DEFAULT_CFG: VoiceConfig = { voiceURI: null, rate: 1.05, volume: 1 };

export function getVoiceConfig(): VoiceConfig {
  try {
    return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) ?? "{}") };
  } catch {
    return { ...DEFAULT_CFG };
  }
}
export function setVoiceConfig(patch: Partial<VoiceConfig>): VoiceConfig {
  const next = { ...getVoiceConfig(), ...patch };
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export type NarrationLine = { id: number; text: string; category: BeatCategory };
export type Beat = {
  text: string;
  category: BeatCategory;
  priority: "critical" | "normal" | "raise" | "flavor";
  isStale?: () => boolean;
};

export type NarrState = {
  itemId: string | null;
  highest: number | null;
  epoch: string | null;
  remainingMs: number;
  status: string;
};
let narr: NarrState = { itemId: null, highest: null, epoch: null, remainingMs: 0, status: "" };
export function setNarrationState(s: NarrState) {
  narr = s;
}
export function getNarrationState(): NarrState {
  return narr;
}

// Feed fan-out + currently-spoken line id (for the subtitle highlight).
const feedListeners = new Set<(l: NarrationLine) => void>();
const speakingListeners = new Set<(id: number | null) => void>();
export function onNarration(cb: (l: NarrationLine) => void) {
  feedListeners.add(cb);
  return () => {
    feedListeners.delete(cb);
  };
}
export function onSpeaking(cb: (id: number | null) => void) {
  speakingListeners.add(cb);
  return () => {
    speakingListeners.delete(cb);
  };
}
let feedSeq = 0;
function setSpeakingId(id: number | null) {
  speakingListeners.forEach((cb) => cb(id));
}

let queue: Beat[] = [];
let raiseSlot: Beat | null = null;
let flavorSlot: Beat | null = null;
let speaking = false;
let gen = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastText = "";
let lastTextAt = 0;

function findVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const wanted = getVoiceConfig().voiceURI;
  if (wanted) {
    const v = voices.find((x) => x.voiceURI === wanted);
    if (v) return v;
  }
  const prefs = ["en-in", "en-gb", "en-au", "en-us", "en"];
  for (const p of prefs) {
    const v = voices.find((x) => x.lang?.toLowerCase().startsWith(p));
    if (v) return v;
  }
  return voices[0];
}

function estimateMs(text: string) {
  return Math.min(6500, 500 + text.split(/\s+/).length * 320);
}

function cancel() {
  gen++;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

function deliver(b: Beat, onDone: () => void) {
  const myGen = gen;
  const finish = () => {
    if (myGen !== gen) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    onDone();
  };

  const audible = !isMuted() && voiceOn() && typeof speechSynthesis !== "undefined";
  if (audible) {
    try {
      const cfg = getVoiceConfig();
      const u = new SpeechSynthesisUtterance(b.text);
      const v = findVoice();
      if (v) u.voice = v;
      u.rate = Math.min(1.6, cfg.rate * (b.priority === "critical" ? 1.06 : 1));
      u.pitch = b.priority === "critical" ? 1.12 : 1.02;
      u.volume = cfg.volume;
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      timer = setTimeout(finish, estimateMs(b.text) + 1800);
      return;
    } catch {
      /* fall through */
    }
  }
  timer = setTimeout(finish, estimateMs(b.text));
}

function pump(force: boolean) {
  if (speaking && !force) return;
  speaking = false;
  let next = queue.shift() ?? null;
  if (!next && raiseSlot) {
    next = raiseSlot;
    raiseSlot = null;
  }
  if (!next && flavorSlot) {
    next = flavorSlot;
    flavorSlot = null;
  }
  if (!next) {
    setSpeakingId(null);
    return;
  }
  if (next.isStale?.()) {
    pump(true);
    return;
  }
  // Suppress a back-to-back identical line (also masks dev StrictMode double-mounts).
  if (next.priority !== "critical" && next.text === lastText && Date.now() - lastTextAt < 2500) {
    pump(true);
    return;
  }
  speaking = true;
  lastText = next.text;
  lastTextAt = Date.now();
  const line: NarrationLine = { id: ++feedSeq, text: next.text, category: next.category };
  feedListeners.forEach((cb) => cb(line));
  setSpeakingId(line.id);
  deliver(next, () => pump(true));
}

export function narrate(b: Beat) {
  if (b.priority === "critical") {
    queue = queue.filter((q) => q.priority === "critical");
    raiseSlot = null;
    flavorSlot = null;
    cancel();
    queue.push(b);
    pump(true);
  } else if (b.priority === "raise") {
    raiseSlot = b; // coalesce to the current high
    pump(false);
  } else if (b.priority === "flavor") {
    flavorSlot = b; // only plays in a genuine gap
    pump(false);
  } else {
    queue.push(b);
    pump(false);
  }
}

export function primeSpeech() {
  try {
    if (typeof speechSynthesis !== "undefined" && !isMuted() && voiceOn()) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    }
  } catch {
    /* ignore */
  }
}

/** Speak a one-off sample with the current config (for the settings "Test" button). */
export function speakSample(text: string) {
  try {
    if (typeof speechSynthesis === "undefined") return;
    const cfg = getVoiceConfig();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = findVoice();
    if (v) u.voice = v;
    u.rate = cfg.rate;
    u.volume = cfg.volume;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function useVoice(): [boolean, () => void] {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(voiceOn()), []);
  const toggle = useCallback(() => {
    const next = !voiceOn();
    setVoiceOn(next);
    setOn(next);
    if (next) primeSpeech();
    else {
      cancel();
      pump(true);
    }
  }, []);
  return [on, toggle];
}

/** Voice list + config for the picker UI. */
export function useVoiceSettings() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cfg, setCfg] = useState<VoiceConfig>(DEFAULT_CFG);

  useEffect(() => {
    setCfg(getVoiceConfig());
    if (typeof speechSynthesis === "undefined") return;
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const update = useCallback((patch: Partial<VoiceConfig>) => setCfg(setVoiceConfig(patch)), []);
  return { voices, cfg, update };
}
