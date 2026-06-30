// Synthesized audio cues (Web Audio API — no assets/licensing) behind a mute
// toggle persisted in localStorage. Every cue no-ops when muted or when the
// browser blocks audio (no prior user gesture). ponytail: synth over samples;
// swap in real samples later if richer sound is wanted.

import { useCallback, useEffect, useState } from "react";

const KEY = "auction:muted";
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Returns a live, unmuted AudioContext or null (muted / unavailable / blocked). */
function audio(): AudioContext | null {
  if (isMuted()) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type ToneOpts = { type?: OscillatorType; peak?: number };

function tone(a: AudioContext, freq: number, start: number, dur: number, { type = "triangle", peak = 0.25 }: ToneOpts = {}) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Gavel double-knock (on SOLD). */
export function playGavel() {
  const a = audio();
  if (!a) return;
  for (const off of [0, 0.15]) {
    const t = a.currentTime + off;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.07);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }
}

/** Soft countdown beep (final seconds). */
export function playBeep() {
  const a = audio();
  if (!a) return;
  tone(a, 760, a.currentTime, 0.09, { type: "sine", peak: 0.16 });
}

/** Little ascending fanfare (layered with the gavel on SOLD). */
export function playFanfare() {
  const a = audio();
  if (!a) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(a, f, a.currentTime + i * 0.1, 0.2, { type: "triangle", peak: 0.2 }));
}

/** Tiny synthesized crowd cheer (on SOLD): a band-passed noise swell + rising notes. */
export function playCheer() {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * 0.6), a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1100;
  bp.Q.value = 0.7;
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.16, t0 + 0.12);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
  noise.connect(bp);
  bp.connect(ng);
  ng.connect(a.destination);
  noise.start(t0);
  noise.stop(t0 + 0.6);
  [523, 659, 784].forEach((f, i) => tone(a, f, t0 + i * 0.08, 0.25, { type: "triangle", peak: 0.16 }));
}

/** Tiny groan (when a leader gets outbid): two detuned saws sliding down. */
export function playGroan() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  for (const [start, peak] of [[300, 0.2], [305, 0.13]] as const) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(118, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(g);
    g.connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.56);
  }
}

/** Reactive mute state for the toggle UI; the cue functions read isMuted() directly. */
export function useMuted(): [boolean, () => void] {
  const [muted, setM] = useState(false);
  useEffect(() => setM(isMuted()), []);
  const toggle = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setM(next);
  }, []);
  return [muted, toggle];
}
