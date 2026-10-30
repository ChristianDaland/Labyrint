// Bokstavmaling: en stor hul bokstav (doble streker) som barnet maler med fingeren. Fargen holder seg inni bokstaven,
// så det blir pent selv om man maler utenfor. Når det meste er farget, kan barnet trykke ✔, og bokstaven lagres
// (et lite bilde) og vises på alfabetplakaten i rommet. Bokstavene tas i alfabetisk rekkefølge, og stemmen sier
// «A som i ape». Gir ikke egg: belønningen er plakaten.
// Lastes inn i rommet (index.html).

import { ALPHABET, LETTER_WORDS } from '../kjerne/oppgaver.js';
import { holdButton, keepAwake } from '../kjerne/ui.js';
import { T } from '../kjerne/tale.js';
import * as lyd from '../kjerne/lyd.js';

export const READY_AT = 0.6;  // så stor del av bokstaven må være farget før ✔ kan trykkes
const THUMB = 160;            // størrelsen på bildet som lagres (px)
const PALETTE = ['#e8505b', '#f28c28', '#f7c948', '#4cc46a', '#3aa0e8', '#7b5fd8', '#e86fb0', '#8a5a3c'];
const INK = '#3b2414', PAPER = '#fffaf0';

const CSS = `
  .ml { position: fixed; inset: 0; z-index: 5; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
    background: radial-gradient(circle at 50% 35%, #fff6e0, #f0d9b0 75%); display: flex; flex-direction: column; font-family: 'Nunito', system-ui, sans-serif; }
  .ml-top { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
    padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
    padding-top: max(8px, env(safe-area-inset-top)); background: rgba(94,56,32,.92); color: #fff4dc; }
  .ml-btn { width: 52px; height: 52px; border-radius: 50%; border: 0; font-size: 26px; background: rgba(255,244,220,.18);
    color: #fff4dc; display: grid; place-items: center; position: relative; touch-action: none; }
  .ml-btn.hold::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
    background: conic-gradient(#f2c14e calc(var(--p, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px)); }
  .ml-word { text-align: center; font: 400 clamp(22px, 6vw, 34px) 'Lilita One', sans-serif; border: 0; background: none; color: inherit; }
  .ml-stage { flex: 1; min-height: 0; position: relative; }
  .ml-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .ml-bar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px;
    padding: 12px max(12px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); }
  .ml-col { width: 46px; height: 46px; border-radius: 50%; border: 4px solid #fff; box-shadow: 0 3px 0 rgba(0,0,0,.2); }
  .ml-col.on { outline: 4px solid ${INK}; outline-offset: 2px; transform: scale(1.1); }
  .ml-act { min-width: 58px; height: 58px; border-radius: 18px; border: 0; font-size: 28px; background: #fff4dc; box-shadow: 0 5px 0 #b07a45; }
  .ml-act.ok { background: #4cc46a; color: #fff; box-shadow: 0 5px 0 #2d7f42; }
  .ml-act.ok:disabled { background: #cfc6b4; box-shadow: 0 5px 0 #a99f8c; color: #f5efe3; }
  .ml-act.ok.ready { animation: ml-pulse 1s ease-in-out infinite; }
  @keyframes ml-pulse { 50% { transform: scale(1.12); } }
  .ml-msg { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); z-index: 3; pointer-events: none; width: 90%;
    font: 400 clamp(34px, 9vmin, 68px) 'Lilita One', sans-serif; color: #fff; text-align: center;
    text-shadow: 0 3px 0 rgba(0,0,0,.35), 0 0 20px rgba(0,0,0,.35); transition: opacity .3s; }
  .ml-msg.hidden { opacity: 0; }
`;

// Neste bokstav å male: den første i alfabetet som ikke er malt ennå (alle malt: en tilfeldig)
export function nextLetter(letters) {
  const todo = [...ALPHABET].filter(L => !letters[L]);
  return todo.length ? todo[0] : ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

export default async function start({ root, profile, store, onExit }) {
  if (!document.getElementById('maling-css')) {
    const s = document.createElement('style'); s.id = 'maling-css'; s.textContent = CSS; document.head.append(s);
  }
  root.className = 'ml';
  root.innerHTML = `
    <div class="ml-top">
      <button class="ml-btn hold" data-exit aria-label="Tilbake til rommet (hold inne)">✕</button>
      <button class="ml-word" aria-label="Hør bokstaven"></button>
      <button class="ml-btn" data-speak aria-label="Les opp igjen">🔊</button>
    </div>
    <div class="ml-stage"><canvas></canvas><div class="ml-msg hidden"></div></div>
    <div class="ml-bar">
      ${PALETTE.map((c, i) => `<button class="ml-col${i === 0 ? ' on' : ''}" style="background:${c}" data-c="${c}" aria-label="Farge"></button>`).join('')}
      <button class="ml-act" data-clear aria-label="Begynn på nytt">🔄</button>
      <button class="ml-act ok" data-done aria-label="Ferdig" disabled>✔</button>
    </div>`;
  const $ = s => root.querySelector(s);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const paint = document.createElement('canvas'), pctx = paint.getContext('2d');
  const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
  const test = /(?:^|[#&])test(?:=(\w+))?/.exec(location.hash); // autopilot for automatiske tester: #test
  profile.rewards.letters ||= {};
  const st = { L: null, color: PALETTE[0], size: 0, dpr: 1, ready: false, busy: false, cover: 0 };
  if (test) window.__maling = st;
  try { await document.fonts.load("400 100px 'Lilita One'"); } catch { /* reserve-skrift */ }

  // Bokstavens form: tegnes stort midt på (fyll = maske, kant = doble streker)
  const font = px => `400 ${px}px 'Lilita One', sans-serif`;
  function glyph(c, size, mode) {
    const px = size * 0.86;
    c.font = font(px); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const m = c.measureText(st.L), h = (m.actualBoundingBoxAscent || px * 0.7) - (m.actualBoundingBoxDescent || 0);
    const y = size / 2 + h / 2;
    if (mode === 'fill') { c.fillText(st.L, size / 2, y); return; }
    c.lineJoin = 'round';
    c.lineWidth = size * 0.035; c.strokeStyle = INK; c.strokeText(st.L, size / 2, y);          // ytterste strek
    c.lineWidth = size * 0.035 - Math.max(4, size * 0.012); c.strokeStyle = PAPER; c.strokeText(st.L, size / 2, y); // rom mellom strekene
  }

  function layout() {
    const stage = $('.ml-stage'), w = stage.clientWidth, h = stage.clientHeight;
    st.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * st.dpr; canvas.height = h * st.dpr;
    const size = Math.floor(Math.min(w - 20, h - 10, 700) * st.dpr);
    if (size !== st.size && st.L) { // ny størrelse: skaler malingen med
      const old = document.createElement('canvas'); old.width = paint.width; old.height = paint.height; old.getContext('2d').drawImage(paint, 0, 0);
      st.size = size; paint.width = mask.width = size; paint.height = mask.height = size;
      pctx.drawImage(old, 0, 0, size, size); drawMask();
    }
    draw();
  }
  function drawMask() { mctx.clearRect(0, 0, st.size, st.size); mctx.fillStyle = '#000'; glyph(mctx, st.size, 'fill'); }
  const origin = () => [(canvas.width - st.size) / 2, (canvas.height - st.size) / 2];

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!st.L) return;
    const [ox, oy] = origin();
    ctx.save(); ctx.translate(ox, oy);
    ctx.fillStyle = PAPER; glyph(ctx, st.size, 'fill');   // hvit bokstav å male i
    ctx.drawImage(paint, 0, 0);
    glyph(ctx, st.size, 'outline');
    ctx.restore();
  }

  function newLetter() {
    st.L = nextLetter(profile.rewards.letters); st.ready = false; st.busy = false; st.cover = 0;
    const [word, pic] = LETTER_WORDS[st.L];
    $('.ml-word').textContent = `${pic} ${st.L} som i ${word}`;
    $('[data-done]').disabled = true; $('[data-done]').classList.remove('ready');
    $('.ml-msg').classList.add('hidden');
    st.size = 0; layout();
    pctx.clearRect(0, 0, paint.width, paint.height);
    draw();
    lyd.say(T.paint(st.L));
  }

  // Maling: streker med rund pensel, og alt utenfor bokstaven fjernes (destination-in med masken)
  let last = null, id = null;
  const toPaint = e => { const r = canvas.getBoundingClientRect(), [ox, oy] = origin();
    return [(e.clientX - r.left) * st.dpr - ox, (e.clientY - r.top) * st.dpr - oy]; };
  function stroke(a, b) {
    pctx.globalCompositeOperation = 'source-over';
    pctx.strokeStyle = st.color; pctx.lineWidth = st.size * 0.09; pctx.lineCap = 'round';
    pctx.beginPath(); pctx.moveTo(...a); pctx.lineTo(...b); pctx.stroke();
    pctx.globalCompositeOperation = 'destination-in'; pctx.drawImage(mask, 0, 0);
    pctx.globalCompositeOperation = 'source-over';
    draw();
  }
  canvas.addEventListener('pointerdown', e => {
    if (st.busy) return;
    e.preventDefault(); lyd.audio();
    id = e.pointerId; canvas.setPointerCapture(id); last = toPaint(e); stroke(last, last);
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const p = toPaint(e); stroke(last, p); last = p; });
  const end = e => { if (e.pointerId !== id) return; id = null; checkCover(); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  // Hvor mye av bokstaven som er farget (målt i lav oppløsning)
  const probe = document.createElement('canvas'); probe.width = probe.height = 64;
  const qctx = probe.getContext('2d', { willReadFrequently: true });
  function coverage() {
    qctx.clearRect(0, 0, 64, 64); qctx.drawImage(mask, 0, 0, 64, 64);
    const m = qctx.getImageData(0, 0, 64, 64).data;
    qctx.clearRect(0, 0, 64, 64); qctx.drawImage(paint, 0, 0, 64, 64);
    const p = qctx.getImageData(0, 0, 64, 64).data;
    let inside = 0, painted = 0;
    for (let i = 3; i < m.length; i += 4) if (m[i] > 128) { inside++; if (p[i] > 64) painted++; }
    return inside ? painted / inside : 0;
  }
  function checkCover() {
    st.cover = coverage();
    if (!st.ready && st.cover >= READY_AT) {
      st.ready = true;
      $('[data-done]').disabled = false; $('[data-done]').classList.add('ready');
      lyd.pling(); lyd.say(T.paintReady());
    }
  }

  // Ferdig: lagre et lite bilde av bokstaven (malingen og kanten, gjennomsiktig bakgrunn) til plakaten
  async function done() {
    if (!st.ready || st.busy) return;
    st.busy = true;
    const t = document.createElement('canvas'); t.width = t.height = THUMB;
    const tc = t.getContext('2d');
    tc.fillStyle = PAPER; glyph(tc, THUMB, 'fill');
    tc.drawImage(paint, 0, 0, THUMB, THUMB);
    glyph(tc, THUMB, 'outline');
    profile.rewards.letters[st.L] = t.toDataURL('image/png');
    store.save();
    const n = Object.keys(profile.rewards.letters).length;
    $('.ml-msg').textContent = 'Så fint! 🎉'; $('.ml-msg').classList.remove('hidden');
    lyd.fanfare();
    await Promise.all([lyd.say(T.paintDone(n)), new Promise(r => setTimeout(r, 2500))]);
    if (!closed) newLetter();
  }

  $('.ml-bar').addEventListener('click', e => {
    const c = e.target.dataset?.c;
    if (c) { st.color = c; root.querySelectorAll('.ml-col').forEach(b => b.classList.toggle('on', b === e.target)); }
  });
  $('[data-clear]').onclick = () => { if (st.busy) return; pctx.clearRect(0, 0, paint.width, paint.height); checkCover(); draw();
    st.ready = false; $('[data-done]').disabled = true; $('[data-done]').classList.remove('ready'); };
  $('[data-done]').onclick = done;
  const repeat = () => st.L && lyd.say(T.letterWord(st.L));
  $('[data-speak]').onclick = repeat; $('.ml-word').onclick = repeat;
  holdButton($('[data-exit]'), 1000, () => close(null));
  const ro = new ResizeObserver(layout);
  ro.observe($('.ml-stage'));

  // Autopilot for tester: maler hele bokstaven med noen streker og trykker ✔
  if (test) window.__malingAuto = () => { for (let y = 0; y < st.size; y += st.size * 0.06) stroke([0, y], [st.size, y]); checkCover(); return st.cover; };

  let wake = null;
  keepAwake().then(w => { wake = w; });
  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    ro.disconnect(); wake?.release?.(); lyd.stopSpeaking();
    root.innerHTML = ''; root.className = '';
    if (test) { delete window.__maling; delete window.__malingAuto; }
    onExit(result); // ingen egg for maling; plakaten i rommet viser bokstavene
  }

  newLetter();
}
