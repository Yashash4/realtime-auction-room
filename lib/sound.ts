// Gavel "double knock" synthesized with the Web Audio API — avoids shipping/
// licensing an audio asset. A wooden knock is a fast-decaying low tone, struck
// twice. No-ops gracefully if the browser blocks audio (no prior user gesture).
// ponytail: synth over a binary asset; swap in a real sample if richer sound is wanted.

let ctx: AudioContext | null = null;

function knock(audio: AudioContext, at: number) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, at);
  osc.frequency.exponentialRampToValueAtTime(70, at + 0.07);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.14);
}

export function playGavel() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    knock(ctx, t);
    knock(ctx, t + 0.15);
  } catch {
    /* audio unavailable or blocked — silent fallback */
  }
}
