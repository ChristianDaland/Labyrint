// Lyd: effekter lages i koden med Web Audio (ingen lydfiler), og tekst leses opp med enhetens norske stemme.
// Mobiler tillater lyd først etter et trykk, så unlock() kalles fra trykk (gjøres automatisk her).
// Senere: innspilte bokstavlyder i ../lyd/ (se playLetter).

let actx = null, noiseBuf = null, muted = false;

export function audio() {
  if (!actx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

// Knyttes til første og senere trykk, og pauser lyden når fanen skjules
if (typeof window !== 'undefined') {
  addEventListener('pointerdown', () => { audio(); unlockSpeech(); }, { passive: true });
  addEventListener('keydown', () => audio());
  document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    if (document.visibilityState === 'hidden') actx.suspend(); else actx.resume();
  });
}

export function setMuted(on) {
  muted = !!on;
  if (muted) globalThis.speechSynthesis?.cancel();
}
export const isMuted = () => muted;

// Effekter spilles bare når lydmotoren kjører og lyden ikke er skrudd av
const ctxForFx = () => (!muted && actx && actx.state === 'running') ? actx : null;

function noise(ctx) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  return src;
}
const panner = (ctx, v) => { if (!ctx.createStereoPanner) return null; const p = ctx.createStereoPanner(); p.pan.value = v; return p; };

// En kort tone med glidende tonehøyde og myk inn/ut
function tone(ctx, out, { type = 'sine', f0, f1 = f0, at = 0, dur, vol = 0.3 }) {
  const t = ctx.currentTime + 0.01 + at;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

// ─── Effekter. Alle tar en valgfri ctx/out, så de kan testes og tas opp uten høyttaler. ───
export function pling(ctx = ctxForFx(), out = ctx?.destination) { // riktig svar / mynt
  if (!ctx) return;
  tone(ctx, out, { type: 'triangle', f0: 988, dur: 0.09, vol: 0.25 });
  tone(ctx, out, { type: 'triangle', f0: 1319, at: 0.08, dur: 0.22, vol: 0.25 });
}

export function oops(ctx = ctxForFx(), out = ctx?.destination) { // feil svar: vennlig, ikke streng
  if (!ctx) return;
  tone(ctx, out, { type: 'sine', f0: 392, f1: 330, dur: 0.18, vol: 0.25 });
  tone(ctx, out, { type: 'sine', f0: 330, f1: 262, at: 0.16, dur: 0.28, vol: 0.25 });
}

export function fanfare(ctx = ctxForFx(), out = ctx?.destination) { // gullegg og diplomer
  if (!ctx) return;
  [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(([f, at]) =>
    tone(ctx, out, { type: 'triangle', f0: f, at, dur: at === 0.36 ? 0.6 : 0.16, vol: 0.22 }));
}

export function flap(ctx = ctxForFx(), out = ctx?.destination) { // vingeslag
  if (!ctx) return;
  const t = ctx.currentTime + 0.005, n = noise(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(500, t + 0.12); bp.Q.value = 1.5;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  n.connect(bp).connect(g).connect(out);
  n.start(t); n.stop(t + 0.15);
}

export function bump(ctx = ctxForFx(), out = ctx?.destination) { // dunk mot en vegg
  if (!ctx) return;
  tone(ctx, out, { type: 'sine', f0: 140, f1: 60, dur: 0.18, vol: 0.5 });
}

// Knirk fra et gammelt dørhengsel: sagtann som glir i tonehøyde, hakket opp av en rask av/på-puls
export function creak(ctx = ctxForFx(), out = ctx?.destination) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.02, dur = 1.1, k = 0.85 + Math.random() * 0.3;
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(170 * k, t);
  osc.frequency.linearRampToValueAtTime(430 * k, t + 0.35);
  osc.frequency.linearRampToValueAtTime(250 * k, t + 0.7);
  osc.frequency.linearRampToValueAtTime(390 * k, t + dur);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 5;
  const chop = ctx.createGain(); chop.gain.value = 0.5;
  const lfo = ctx.createOscillator(); lfo.type = 'square';
  lfo.frequency.setValueAtTime(26, t); lfo.frequency.linearRampToValueAtTime(58, t + dur);
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.5;
  lfo.connect(lfoAmt).connect(chop.gain);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1.4, t + 0.06);
  env.gain.setValueAtTime(1.4, t + dur - 0.25);
  env.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(bp).connect(chop).connect(env).connect(out);
  for (const s of [osc, lfo]) { s.start(t); s.stop(t + dur + 0.05); }
}

// To korte bjeff
export function bark(vol = 1, pan = 0, ctx = ctxForFx(), out = ctx?.destination) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  for (const [delay, f0] of [[0, 900], [0.2, 800]]) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(f0 * 0.7, t + delay);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.25, t + delay + 0.04);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + delay + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(0.05 + 0.35 * vol, t + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.15);
    const p = panner(ctx, pan);
    o.connect(g);
    if (p) g.connect(p).connect(out); else g.connect(out);
    o.start(t + delay); o.stop(t + delay + 0.17);
  }
}

// Lav knurring som går hele tiden; styres med set(volum 0–1, panorering −1–1)
export function makeGrowl(ctx = ctxForFx(), out = ctx?.destination) {
  if (!ctx) return null;
  const gain = ctx.createGain(); gain.gain.value = 0;
  const pan = panner(ctx, 0);
  const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 78;
  const wob = ctx.createOscillator(); wob.frequency.value = 0.7; // tonehøyden svinger litt
  const wobAmt = ctx.createGain(); wobAmt.gain.value = 10;
  wob.connect(wobAmt).connect(osc.frequency);
  const n = noise(ctx), nAmt = ctx.createGain(); nAmt.gain.value = 0.6;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 4;
  const rumble = ctx.createGain(); rumble.gain.value = 0.6; // «rr-rr-rr»
  const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.4;
  lfo.connect(lfoAmt).connect(rumble.gain);
  osc.connect(lp); n.connect(nAmt).connect(lp);
  lp.connect(rumble).connect(gain);
  if (pan) gain.connect(pan).connect(out); else gain.connect(out);
  for (const s of [osc, wob, n, lfo]) s.start();
  return {
    set(vol, p = 0) {
      gain.gain.setTargetAtTime(muted ? 0 : vol * 0.5, ctx.currentTime, 0.15);
      pan?.pan.setTargetAtTime(p, ctx.currentTime, 0.1);
    },
  };
}

// ─── Opplesning ─────────────────────────────────────────────────────────
const canSpeak = () => typeof globalThis.speechSynthesis !== 'undefined';
let speechUnlocked = false;

// iOS: talen må startes én gang i et trykk før den kan brukes ellers
function unlockSpeech() {
  if (speechUnlocked || !canSpeak()) return;
  speechUnlocked = true;
  speechSynthesis.speak(new SpeechSynthesisUtterance(''));
}

export function speak(text, { rate = 0.9 } = {}) {
  if (muted || !canSpeak() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'nb-NO'; u.rate = rate;
  const v = speechSynthesis.getVoices().find(v => /^(nb|no|nn)\b/i.test(v.lang));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
export const stopSpeaking = () => canSpeak() && speechSynthesis.cancel();
export const hasSpeech = canSpeak;

// Bokstavlyder (/sss/, ikke «ess»). Fylles inn når opptakene finnes i ../lyd/, f.eks. { S: 'bokstav-s.m4a' }.
// Til da leses bokstavnavnet opp.
export const LETTER_FILES = {};
const letterCache = {};

export async function playLetter(letter) {
  const L = letter.toUpperCase(), file = LETTER_FILES[L], ctx = ctxForFx();
  if (!file || !ctx) return speak(L);
  try {
    letterCache[L] ||= await fetch(new URL(`../lyd/${file}`, import.meta.url))
      .then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b));
    const src = ctx.createBufferSource(); src.buffer = letterCache[L];
    src.connect(ctx.destination); src.start();
  } catch { speak(L); }
}
