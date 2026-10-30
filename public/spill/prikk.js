// Prikk til prikk: bokstaver ligger som prikker rundt et skjult bilde. Barnet trykker dem i alfabetisk rekkefølge,
// en strek tegnes for hver, og til slutt fylles bildet med farge («Se, en fisk!»). Følger alfabet-nivået
// (A–J, A–T, A–Å, små bokstaver, baklengs). Hver bokstav er ett svar i læringsmotoren (riktig = uten feil trykk).
// Lastes inn i rommet (index.html), som deler ut egget når runden er ferdig.

import { chooseSkill, recordAnswer } from '../kjerne/laering.js';
import { makeTask } from '../kjerne/oppgaver.js';
import { awardSkills, starsFor } from '../kjerne/belonning.js';
import { holdButton, keepAwake } from '../kjerne/ui.js';
import { T, DOT_PICTURE_NAMES } from '../kjerne/tale.js';
import * as lyd from '../kjerne/lyd.js';

const LETTERS_PER_ROUND = 36; // runden er så mange bilder som trengs for omtrent så mange bokstaver
const HINT_AFTER = 2;         // feil trykk før riktig prikk begynner å vinke

// ─── Bildene (uten grafikk, testes i Node) ────────────────────────────────
// Omriss i et kvadrat 0–1 (y nedover), i samme rekkefølge som DOT_PICTURE_NAMES i tale.js.
// `max`: bilder med spisse tagger brukes bare til så mange bokstaver (ellers blir det trangt).
const curve = (n, f) => Array.from({ length: n }, (_, i) => f(i / n * Math.PI * 2));
export const PICTURES = [
  { emoji: '⭐', color: '#f7c948', max: 20, pts: curve(10, t => { const r = Math.round(t / (Math.PI / 5)) % 2 ? 0.2 : 0.48, a = t - Math.PI / 2; return [0.5 + r * Math.cos(a), 0.54 + r * Math.sin(a)]; }) },
  { emoji: '❤️', color: '#e8505b', pts: curve(48, t => [0.5 + 0.028 * 16 * Math.sin(t) ** 3, 0.42 - 0.028 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]) },
  // Enkle former uten smale tagger, så det er plass til 29 bokstaver rundt
  { emoji: '🐟', color: '#4aa8e8', pts: [[0.06, 0.5], [0.3, 0.27], [0.58, 0.25], [0.76, 0.4], [0.94, 0.22], [0.94, 0.78], [0.76, 0.6], [0.58, 0.75], [0.3, 0.73]] },
  { emoji: '🏠', color: '#e08a4a', pts: [[0.1, 0.48], [0.5, 0.1], [0.9, 0.48], [0.8, 0.48], [0.8, 0.92], [0.2, 0.92], [0.2, 0.48]] },
  { emoji: '🚀', color: '#9a7bd8', pts: [[0.5, 0.05], [0.7, 0.3], [0.7, 0.7], [0.84, 0.92], [0.16, 0.92], [0.3, 0.7], [0.3, 0.3]] },
  { emoji: '🌲', color: '#3e9a52', max: 20, pts: [[0.5, 0.05], [0.76, 0.42], [0.64, 0.42], [0.9, 0.8], [0.6, 0.8], [0.6, 0.95], [0.4, 0.95], [0.4, 0.8], [0.1, 0.8], [0.36, 0.42], [0.24, 0.42]] },
  { emoji: '🥚', color: '#f2c14e', pts: curve(48, t => [0.5 + 0.34 * Math.sin(t) * (1 - 0.14 * Math.cos(t)), 0.54 - 0.43 * Math.cos(t)]) },
  { emoji: '💎', color: '#5fc6e8', pts: [[0.25, 0.15], [0.75, 0.15], [0.95, 0.4], [0.5, 0.92], [0.05, 0.4]] },
  { emoji: '⛵', color: '#e8e2d0', pts: [[0.5, 0.06], [0.8, 0.6], [0.95, 0.64], [0.8, 0.9], [0.2, 0.9], [0.05, 0.64], [0.2, 0.6]] },
  { emoji: '👑', color: '#f2c14e', max: 20, pts: [[0.08, 0.85], [0.08, 0.28], [0.29, 0.55], [0.5, 0.18], [0.71, 0.55], [0.92, 0.28], [0.92, 0.85]] },
];

// Ligger punktet inni omrisset? (strålemetoden)
export function inside([x, y], pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Retning ut fra omrisset ved hver prikk (vinkelrett på streken, mot utsiden), så bokstavene havner utenfor
export function outward(ring, pts) {
  return ring.map((p, i) => {
    const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length];
    let nx = b[1] - a[1], ny = a[0] - b[0];
    const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    return inside([p[0] + nx * 0.02, p[1] + ny * 0.02], pts) ? [-nx, -ny] : [nx, ny];
  });
}

// Hvor bokstavene står: litt utenfor hver prikk, og skjøvet fra hverandre (og fra prikkene) så de ikke overlapper
export function labelSpots(ring, out, off = 0.075, gap = 0.07) {
  const L = ring.map((p, i) => [p[0] + out[i][0] * off, p[1] + out[i][1] * off]);
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) { // bokstav mot bokstav
        const dx = L[j][0] - L[i][0], dy = L[j][1] - L[i][1], d = Math.hypot(dx, dy) || 1e-6;
        if (d < gap) { const m = (gap - d) / 2; L[i][0] -= dx / d * m; L[i][1] -= dy / d * m; L[j][0] += dx / d * m; L[j][1] += dy / d * m; }
      }
      for (let j = 0; j < ring.length; j++) { // bokstav mot prikker
        const dx = L[i][0] - ring[j][0], dy = L[i][1] - ring[j][1], d = Math.hypot(dx, dy) || 1e-6, min = j === i ? off * 0.8 : 0.045;
        if (d < min) { L[i][0] += dx / d * (min - d); L[i][1] += dy / d * (min - d); }
      }
    }
  }
  return L;
}

// `n` punkter jevnt fordelt rundt et lukket omriss, med start i første hjørne
export function resample(pts, n) {
  const seg = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) }; });
  const total = seg.reduce((a, s) => a + s.len, 0), out = [];
  for (let k = 0, i = 0, acc = 0; k < n; k++) {
    const d = k * total / n;
    while (acc + seg[i].len < d) { acc += seg[i].len; i++; }
    const { p, q, len } = seg[i], f = len ? (d - acc) / len : 0;
    out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
  }
  return out;
}

// ─── Spillet ──────────────────────────────────────────────────────────────
const CSS = `
  .pk { position: fixed; inset: 0; z-index: 5; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
    background: #fdf6e4; font-family: 'Nunito', system-ui, sans-serif; }
  .pk canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .pk-top { position: absolute; top: 0; left: 0; right: 0; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
    padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
    padding-top: max(8px, env(safe-area-inset-top)); background: rgba(94,56,32,.92); color: #fff4dc; z-index: 2; }
  .pk-btn { width: 52px; height: 52px; border-radius: 50%; border: 0; font-size: 26px; background: rgba(255,244,220,.18);
    color: #fff4dc; display: grid; place-items: center; position: relative; touch-action: none; }
  .pk-btn.hold::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
    background: conic-gradient(#f2c14e calc(var(--p, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px)); }
  .pk-prog { display: flex; gap: 6px; justify-content: center; }
  .pk-prog i { width: 16px; height: 21px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: rgba(255,244,220,.25); }
  .pk-prog i.ok { background: radial-gradient(circle at 35% 30%, #fff6c9 0 10%, #f7d46a 30%, #d99a1e 80%); }
  .pk-prog i.now { outline: 2px solid #f2c14e; outline-offset: 2px; }
  .pk-msg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3; pointer-events: none; width: 90%;
    font: 400 clamp(30px, 8vmin, 64px) 'Lilita One', sans-serif; color: #fff; text-align: center;
    text-shadow: 0 3px 0 rgba(0,0,0,.35), 0 0 20px rgba(0,0,0,.35); transition: opacity .3s; }
  .pk-msg.hidden { opacity: 0; }
  .pk-msg .stars { font-size: 1.4em; letter-spacing: .1em; }
`;

export default function start({ root, profile, store, onExit }) {
  if (!document.getElementById('prikk-css')) {
    const s = document.createElement('style'); s.id = 'prikk-css'; s.textContent = CSS; document.head.append(s);
  }
  root.className = 'pk';
  root.innerHTML = `
    <canvas></canvas>
    <div class="pk-top">
      <button class="pk-btn hold" data-exit aria-label="Tilbake til rommet (hold inne)">✕</button>
      <div class="pk-prog"></div>
      <button class="pk-btn" data-speak aria-label="Les opp igjen">🔊</button>
    </div>
    <div class="pk-msg hidden"></div>`;
  const $ = s => root.querySelector(s);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const test = /(?:^|[#&])test(?:=(\w+))?/.exec(location.hash); // autopilot for automatiske tester: #test=riktig|feil

  const st = { W: 0, H: 0, x0: 0, y0: 0, size: 0, pic: null, skill: null, letters: [], dots: [], next: 0, mistakes: 0,
    doneAt: 0, pictures: 0, picIndex: 0, right: 0, total: 0, done: false, busy: false, shake: null, t: 0,
    used: new Set(), auto: test ? test[1] || 'riktig' : null };
  if (test) window.__prikk = st;

  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    st.W = root.clientWidth; st.H = root.clientHeight;
    canvas.width = st.W * dpr; canvas.height = st.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = $('.pk-top').getBoundingClientRect().bottom + 30;
    st.size = Math.max(200, Math.min(st.W - 70, st.H - top - 40, 640));
    st.x0 = (st.W - st.size) / 2; st.y0 = top + (st.H - top - st.size) / 2;
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();
  const P = ([x, y]) => [st.x0 + x * st.size, st.y0 + y * st.size];

  function renderProgress() {
    $('.pk-prog').innerHTML = Array.from({ length: st.pictures }, (_, i) =>
      `<i class="${i < st.picIndex ? 'ok' : i === st.picIndex && !st.done ? 'now' : ''}"></i>`).join('');
  }

  // Nytt bilde med bokstavene fra alfabet-nivået
  function nextPicture() {
    const t = makeTask(chooseSkill(profile.learning, 'alfabet').id);
    if (!st.pictures) st.pictures = Math.max(1, Math.round(LETTERS_PER_ROUND / t.letters.length));
    const fits = PICTURES.map((p, i) => i).filter(i => (PICTURES[i].max || 99) >= t.letters.length);
    const fresh = fits.filter(i => !st.used.has(i)), pool = fresh.length ? fresh : fits;
    const k = pool[Math.floor(Math.random() * pool.length)];
    st.used.add(k);
    st.pic = { ...PICTURES[k], name: DOT_PICTURE_NAMES[k] };
    st.skill = t.skill; st.letters = t.letters; st.next = 0; st.mistakes = 0; st.doneAt = 0; st.busy = false;
    const ring = resample(st.pic.pts, t.letters.length), labels = labelSpots(ring, outward(ring, st.pic.pts));
    st.dots = ring.map(([x, y], i) => ({ x, y, lx: labels[i][0], ly: labels[i][1], letter: t.letters[i] }));
    renderProgress();
    lyd.say(T.dotsStart(t.letters[0]));
    lyd.prefetch(T.tryAgain(), ...t.letters.map(T.letter), T.dotsDone(st.pic.name));
  }

  function tap(i) {
    if (st.busy || st.done) return;
    const dot = st.dots[i];
    if (i < st.next) return; // allerede koblet
    if (i !== st.next) {
      st.mistakes++; st.shake = { i, t: st.t };
      lyd.oops(); lyd.say(T.tryAgain());
      return;
    }
    const first = st.mistakes === 0;
    awardSkills(profile, recordAnswer(profile, st.skill, first));
    store.save();
    st.total++; if (first) st.right++;
    st.next++; st.mistakes = 0;
    lyd.say(T.letter(dot.letter));
    if (st.next >= st.dots.length) complete();
  }

  function complete() {
    st.busy = true; st.doneAt = st.t;
    lyd.pling(); setTimeout(() => lyd.fanfare(), 300);
    Promise.all([lyd.say(T.dotsDone(st.pic.name)), new Promise(r => setTimeout(r, 2600))]).then(() => {
      if (closed) return;
      st.picIndex++;
      if (st.picIndex >= st.pictures) finish(); else nextPicture();
    });
  }

  function finish() {
    st.done = true;
    renderProgress();
    const n = starsFor(st.right, Math.max(st.total, 1)), msg = $('.pk-msg');
    msg.innerHTML = `Bra jobba!<div class="stars">${'⭐'.repeat(n)}</div>`;
    msg.classList.remove('hidden');
    lyd.fanfare();
    Promise.all([lyd.say(T.roundDone(n)), new Promise(r => setTimeout(r, 3500))])
      .then(() => close({ game: 'prikk', right: st.right, total: Math.max(st.total, 1) }));
  }

  // Trykk: nærmeste prikk innenfor rekkevidde (romslig, så små fingre treffer)
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault(); lyd.audio();
    const [a, b] = st.dots, spacing = b ? Math.hypot(b.x - a.x, b.y - a.y) * st.size : 60;
    const reach = Math.max(26, Math.min(44, spacing * 0.6));
    let best = -1, bestD = reach;
    st.dots.forEach((d, i) => {
      const [x, y] = P([d.x, d.y]), [lx, ly] = P([d.lx, d.ly]); // prikken eller bokstaven ved siden av
      const dist = Math.min(Math.hypot(e.clientX - x, e.clientY - y), Math.hypot(e.clientX - lx, e.clientY - ly));
      if (dist < bestD && i >= st.next) { bestD = dist; best = i; }
    });
    if (best >= 0) tap(best);
  });
  $('[data-speak]').onclick = () => st.dots.length && lyd.say(T.dotsStart(st.letters[0]));
  holdButton($('[data-exit]'), 1000, () => close(null));

  // ─── Tegning ────────────────────────────────────────────────────────
  function shapePath() {
    ctx.beginPath();
    st.pic.pts.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  }
  function draw() {
    ctx.fillStyle = '#fdf6e4'; ctx.fillRect(0, 0, st.W, st.H);
    if (!st.pic) return;
    const fill = st.doneAt ? Math.min(1, (st.t - st.doneAt) / 0.6) : 0;
    if (fill) { // bildet kommer fram
      ctx.globalAlpha = fill; ctx.fillStyle = st.pic.color; shapePath(); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#3b2414'; ctx.stroke(); ctx.globalAlpha = 1;
      const [cx, cy] = P([0.5, 0.55]), s = st.size * 0.28 * (0.6 + 0.4 * Math.min(1, fill * 1.4)) * (1 + 0.05 * Math.sin(st.t * 6));
      ctx.font = `${s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(st.pic.emoji, cx, cy);
    }
    if (fill > 0.5) return; // ferdig: bare bildet vises
    // Strekene så langt
    ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#d9822b';
    ctx.beginPath();
    for (let i = 0; i < st.next; i++) { const [x, y] = P([st.dots[i].x, st.dots[i].y]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    if (st.next >= st.dots.length && st.dots.length) { const [x, y] = P([st.dots[0].x, st.dots[0].y]); ctx.lineTo(x, y); }
    ctx.stroke();
    // Prikkene og bokstavene
    const fs = Math.max(16, Math.min(28, st.size / 17));
    ctx.font = `400 ${fs}px 'Lilita One', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    st.dots.forEach((d, i) => {
      let [x, y] = P([d.x, d.y]);
      const shaking = st.shake && st.shake.i === i && st.t - st.shake.t < 0.4;
      if (shaking) x += Math.sin((st.t - st.shake.t) * 60) * 6;
      const hint = i === st.next && (st.mistakes >= HINT_AFTER || (i === 0 && !st.doneAt));
      if (hint) { ctx.fillStyle = `rgba(242,193,78,${0.35 + 0.25 * Math.sin(st.t * 6)})`; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.fill(); }
      ctx.fillStyle = i < st.next ? '#d9822b' : shaking ? '#e0533d' : '#3b2414';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
      const [lx, ly] = P([d.lx, d.ly]);
      ctx.fillStyle = i < st.next ? '#b9a38a' : '#3b2414'; ctx.fillText(d.letter, lx + (shaking ? Math.sin((st.t - st.shake.t) * 60) * 6 : 0), ly);
    });
  }

  // ─── Løkke, autopilot og avslutning ─────────────────────────────────
  let raf = 0, last = performance.now(), autoT = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; st.t += dt;
    if (st.auto && !st.busy && !st.done && st.dots.length && (autoT += dt) > 0.25) {
      autoT = 0;
      const wrong = st.auto === 'feil' && st.mistakes === 0 && st.next + 1 < st.dots.length;
      tap(wrong ? st.next + 1 : st.next);
    }
    draw();
  }
  let wake = null;
  keepAwake().then(w => { wake = w; });
  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf); ro.disconnect();
    wake?.release?.();
    lyd.stopSpeaking();
    root.innerHTML = ''; root.className = '';
    if (test) delete window.__prikk;
    onExit(result);
  }

  nextPicture();
  raf = requestAnimationFrame(loop);
}
