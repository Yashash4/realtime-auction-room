// Narrator: one speech pipeline that both speaks (browser speechSynthesis) and
// emits the on-screen feed. Pacing keeps the voice in sync with live state:
//   - critical beats (sold / gone / anti-snipe) interrupt and flush lower lanes
//   - normal beats (intro, going once/twice) queue, but are stale-dropped on dequeue
//   - raise beats coalesce into ONE slot, so only the CURRENT high is announced
// When voice is off/muted (or TTS is blocked) each beat is "spoken" via an
// estimated-duration timer instead, so the feed still paces like speech.

import { useCallback, useEffect, useState } from "react";
import { isMuted } from "@/lib/sound";
import type { BeatCategory } from "@/lib/auctioneer/lines";

const VKEY = "auction:voice";

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

export type NarrationLine = { id: number; text: string; category: BeatCategory };
export type Beat = {
  text: string;
  category: BeatCategory;
  priority: "critical" | "normal" | "raise";
  /** Evaluated at dequeue; true -> the beat is outdated and gets dropped. */
  isStale?: () => boolean;
};

// Current live-state snapshot, refreshed by the hook; used for staleness checks.
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

// Feed fan-out.
const feedListeners = new Set<(l: NarrationLine) => void>();
export function onNarration(cb: (l: NarrationLine) => void) {
  feedListeners.add(cb);
  return () => {
    feedListeners.delete(cb);
  };
}
let feedSeq = 0;

// Queue state.
let queue: Beat[] = [];
let raiseSlot: Beat | null = null;
let speaking = false;
let gen = 0; // bumped on cancel; in-flight callbacks check it to avoid double-advance
let timer: ReturnType<typeof setTimeout> | null = null;

let cachedVoice: SpeechSynthesisVoice | null = null;
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  if (cachedVoice) return cachedVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefs = ["en-in", "en-gb", "en-au", "en-us", "en"];
  for (const p of prefs) {
    const v = voices.find((x) => x.lang?.toLowerCase().startsWith(p));
    if (v) return (cachedVoice = v);
  }
  return (cachedVoice = voices[0]);
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
    if (myGen !== gen) return; // superseded by a cancel/interrupt
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    onDone();
  };

  const audible = !isMuted() && voiceOn() && typeof speechSynthesis !== "undefined";
  if (audible) {
    try {
      const u = new SpeechSynthesisUtterance(b.text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = b.priority === "critical" ? 1.12 : 1.05;
      u.pitch = b.priority === "critical" ? 1.12 : 1.02;
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      timer = setTimeout(finish, estimateMs(b.text) + 1800); // safety net if TTS is blocked/silent
      return;
    } catch {
      /* fall through to silent pacing */
    }
  }
  timer = setTimeout(finish, estimateMs(b.text)); // muted/off/unavailable -> pace silently
}

function pump(force: boolean) {
  if (speaking && !force) return;
  speaking = false;
  let next = queue.shift() ?? null;
  if (!next && raiseSlot) {
    next = raiseSlot;
    raiseSlot = null;
  }
  if (!next) return;
  if (next.isStale?.()) {
    pump(true); // drop stale, try the next one
    return;
  }
  speaking = true;
  const line: NarrationLine = { id: ++feedSeq, text: next.text, category: next.category };
  feedListeners.forEach((cb) => cb(line));
  deliver(next, () => pump(true));
}

export function narrate(b: Beat) {
  if (b.priority === "critical") {
    queue = queue.filter((q) => q.priority === "critical"); // flush normals/raises
    raiseSlot = null;
    cancel();
    queue.push(b);
    pump(true);
  } else if (b.priority === "raise") {
    raiseSlot = b; // coalesce: only the latest high survives
    pump(false);
  } else {
    queue.push(b);
    pump(false);
  }
}

/** Warm up TTS on a user gesture (some browsers gate the first utterance). */
export function primeSpeech() {
  try {
    if (typeof speechSynthesis !== "undefined" && !isMuted() && voiceOn()) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    }
  } catch {
    /* ignore */
  }
}

/** Reactive voice on/off for the toggle UI. */
export function useVoice(): [boolean, () => void] {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(voiceOn()), []);
  const toggle = useCallback(() => {
    const next = !voiceOn();
    setVoiceOn(next);
    setOn(next);
    if (next) primeSpeech();
    else {
      cancel(); // stop current line immediately...
      pump(true); // ...but keep the feed flowing silently
    }
  }, []);
  return [on, toggle];
}
