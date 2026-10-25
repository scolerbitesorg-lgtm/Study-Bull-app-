// StudyBull sound manager — one shared Web Audio context, unlocked on the first tap.
// Every play builds fresh nodes, so rapid / overlapping sounds never cut each other.
// Fallback (no Web Audio, or context refuses to run): synthesized WAV played through a
// fresh HTMLAudioElement per play.

export type SoundType = 'tap' | 'correct' | 'wrong' | 'celebrate' | 'tick' | 'timeup';

type Note = { f: number; f2?: number; t: number; d: number; v: number; w: OscillatorType };

// Short, soft but clearly audible on phone speakers.
const SOUNDS: Record<SoundType, Note[]> = {
  tap: [{ f: 660, t: 0, d: 0.06, v: 0.18, w: 'sine' }],
  correct: [
    { f: 523.25, t: 0, d: 0.16, v: 0.32, w: 'triangle' },
    { f: 659.25, t: 0.09, d: 0.16, v: 0.32, w: 'triangle' },
    { f: 783.99, t: 0.18, d: 0.3, v: 0.34, w: 'triangle' },
  ],
  wrong: [
    { f: 311.13, f2: 277.18, t: 0, d: 0.18, v: 0.3, w: 'square' },
    { f: 233.08, f2: 196, t: 0.16, d: 0.3, v: 0.3, w: 'square' },
  ],
  celebrate: [
    { f: 523.25, t: 0, d: 0.14, v: 0.28, w: 'triangle' },
    { f: 659.25, t: 0.11, d: 0.14, v: 0.28, w: 'triangle' },
    { f: 783.99, t: 0.22, d: 0.14, v: 0.28, w: 'triangle' },
    { f: 1046.5, t: 0.33, d: 0.5, v: 0.32, w: 'triangle' },
    { f: 1318.5, t: 0.33, d: 0.5, v: 0.14, w: 'sine' },
  ],
  tick: [{ f: 1000, t: 0, d: 0.05, v: 0.16, w: 'sine' }],
  timeup: [
    { f: 880, t: 0, d: 0.18, v: 0.28, w: 'square' },
    { f: 880, t: 0.26, d: 0.18, v: 0.28, w: 'square' },
    { f: 660, t: 0.52, d: 0.4, v: 0.3, w: 'square' },
  ],
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let webAudioBroken = false;
let listenersAdded = false;
const wavUrls: Partial<Record<SoundType, string>> = {};

const getCtor = (): typeof AudioContext | undefined =>
  typeof window === 'undefined'
    ? undefined
    : window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

function ensureCtx(): AudioContext | null {
  if (ctx || webAudioBroken) return ctx;
  const Ctor = getCtor();
  if (!Ctor) { webAudioBroken = true; return null; }
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
  } catch {
    ctx = null;
    webAudioBroken = true;
  }
  return ctx;
}

// Called from a real user gesture: create/resume the context and play one silent
// sample (iOS needs a sound started inside a gesture to unlock output).
export function unlockAudio(): void {
  const c = ensureCtx();
  if (!c) return;
  try {
    if (c.state !== 'running') void c.resume().catch(() => {});
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch { /* ignore */ }
}

export function initSound(): void {
  if (listenersAdded || typeof window === 'undefined') return;
  listenersAdded = true;
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, opts),
  );
  // Android/iOS suspend or "interrupt" audio when the tab is hidden; wake it on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
      void ctx.resume().catch(() => {});
    }
  });
}

function scheduleWebAudio(c: AudioContext, type: SoundType): void {
  const out = master || c.destination;
  const t0 = c.currentTime + 0.02;
  for (const n of SOUNDS[type]) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.w;
    const s = t0 + n.t;
    const e = s + n.d;
    osc.frequency.setValueAtTime(n.f, s);
    if (n.f2) osc.frequency.linearRampToValueAtTime(n.f2, e);
    // square waves are loud — tame them
    const peak = n.w === 'square' ? n.v * 0.45 : n.v;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(peak, s + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, e);
    osc.connect(g);
    g.connect(out);
    osc.start(s);
    osc.stop(e + 0.03);
    osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch { /* ignore */ } };
  }
}

// ---- HTMLAudio fallback: synthesize the same notes into a WAV blob ----
function renderWav(type: SoundType): string {
  const rate = 22050;
  const notes = SOUNDS[type];
  const len = Math.ceil((Math.max(...notes.map((n) => n.t + n.d)) + 0.05) * rate);
  const pcm = new Float32Array(len);
  for (const n of notes) {
    const s0 = Math.floor(n.t * rate);
    const nd = Math.floor(n.d * rate);
    let phase = 0;
    for (let i = 0; i < nd && s0 + i < len; i++) {
      const p = i / nd;
      const f = n.f2 ? n.f + (n.f2 - n.f) * p : n.f;
      phase += (2 * Math.PI * f) / rate;
      const x = phase % (2 * Math.PI);
      let y: number;
      if (n.w === 'square') y = (x < Math.PI ? 1 : -1) * 0.45;
      else if (n.w === 'triangle') y = 1 - (2 * Math.abs(x - Math.PI)) / Math.PI;
      else y = Math.sin(x);
      const att = Math.min(1, i / (0.012 * rate));
      pcm[s0 + i] += y * n.v * att * Math.pow(0.0001, p);
    }
  }
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const w = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function playFallback(type: SoundType): void {
  try {
    const url = wavUrls[type] || (wavUrls[type] = renderWav(type));
    const a = new Audio(url); // fresh element per play: never cuts a sound already playing
    a.volume = 1;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* ignore */ }
}

const lastPlayed: Partial<Record<SoundType, number>> = {};

export function playSound(type: SoundType, muted = false): void {
  if (muted || typeof window === 'undefined') return;
  initSound();
  // avoid a machine-gun of identical sounds from a double-fired handler
  const now = performance.now();
  if (now - (lastPlayed[type] || 0) < 40) return;
  lastPlayed[type] = now;

  const c = ensureCtx();
  if (!c) { playFallback(type); return; }
  try {
    if (c.state === 'running') { scheduleWebAudio(c, type); return; }
    const asked = performance.now();
    c.resume().then(() => {
      // only play if the context woke quickly — a stale sound seconds later is worse than none
      const fresh = performance.now() - asked < 600;
      if (!fresh) return;
      if (c.state === 'running') scheduleWebAudio(c, type);
      else playFallback(type);
    }).catch(() => playFallback(type));
  } catch {
    playFallback(type);
  }
}

// For diagnostics / tests
export function soundState(): string {
  return webAudioBroken ? 'fallback' : ctx ? ctx.state : 'idle';
}
if (typeof window !== 'undefined') {
  (window as unknown as { __sbSound?: unknown }).__sbSound = { playSound, soundState, unlockAudio };
}
