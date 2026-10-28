// Felles motor for brikkespillene (Ordbyggeren og Tallbyggeren): en oppgave med ruter, og brikker som dras
// til rutene, eller trykkes på, så de havner i første ledige rute. Feil brikke rister og blir liggende
// («Prøv igjen»); etter HINT_AFTER feil på samme rute vinker riktig brikke. Oppgaven regnes som riktig bare
// uten feil. Spillet som bruker motoren, lager oppgavene (puslespill) og bestemmer hva som sies.
//
// Puslespill: { skill, key, pic, q, parts: [{ text } | { slot, ghost }], tiles, speak, done }
//   key: brukes til å unngå samme oppgave to ganger i en runde (og helst fra forrige runde)
//   pic: bilde (emoji) eller null; q: kort tekst over rutene eller null
//   parts: tekst (f.eks. «+») og ruter med riktig svar (`ghost`: svaret vises svakt, å kopiere)
//   tiles: brikkene (svarene pluss eventuelle ekstra), stokket; speak/done: biter som sies (tale.js)

import { recordAnswer } from '../kjerne/laering.js';
import { awardSkills, starsFor } from '../kjerne/belonning.js';
import { holdButton, keepAwake } from '../kjerne/ui.js';
import { T } from '../kjerne/tale.js';
import * as lyd from '../kjerne/lyd.js';

const HINT_AFTER = 2; // feil på samme rute før riktig brikke begynner å vinke
const lastRounds = {}; // oppgavene fra forrige runde per spill (så lenge siden er åpen)

const CSS = `
  .bk { position: fixed; inset: 0; z-index: 5; overflow: auto; touch-action: manipulation; user-select: none; -webkit-user-select: none;
    background: radial-gradient(circle at 50% 30%, #fff1d6, #f2d3a2 70%); color: #3b2414; font-family: 'Nunito', system-ui, sans-serif;
    display: flex; flex-direction: column; }
  .bk.matte { background: radial-gradient(circle at 50% 30%, #e6f4ff, #b9dcf5 70%); }
  .bk-top { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
    padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
    padding-top: max(8px, env(safe-area-inset-top)); background: rgba(94,56,32,.92); color: #fff4dc; }
  .bk-btn { width: 52px; height: 52px; border-radius: 50%; border: 0; font-size: 26px; background: rgba(255,244,220,.18);
    color: #fff4dc; display: grid; place-items: center; position: relative; touch-action: none; }
  .bk-btn.hold::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
    background: conic-gradient(#f2c14e calc(var(--p, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px)); }
  .bk-prog { display: flex; gap: 6px; justify-content: center; }
  .bk-prog i { width: 16px; height: 21px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: rgba(255,244,220,.25); }
  .bk-prog i.ok { background: radial-gradient(circle at 35% 30%, #fff6c9 0 10%, #f7d46a 30%, #d99a1e 80%); }
  .bk-prog i.no { background: rgba(255,244,220,.55); }
  .bk-prog i.now { outline: 2px solid #f2c14e; outline-offset: 2px; }
  .bk-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; gap: 14px;
    padding: 12px max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)); }
  .bk-pic { font-size: clamp(90px, 26vmin, 190px); line-height: 1.05; border: 0; background: none; padding: 0; position: relative;
    white-space: pre-line; color: inherit; }
  .bk-pic.rows { font-size: clamp(34px, 9vmin, 70px); }
  .bk-pic::after { content: '🔊'; position: absolute; right: -18px; bottom: -4px; font-size: 26px; opacity: .7; }
  .bk-q { font: 800 clamp(20px, 4.6vmin, 30px) 'Nunito', sans-serif; text-align: center; border: 0; background: none; color: inherit; }
  .bk-slots, .bk-tray { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: var(--gap); max-width: 100%; }
  .bk-sym { font: 400 calc(var(--s) * .7) 'Lilita One', sans-serif; color: #3b2414; min-width: calc(var(--s) * .45); text-align: center; }
  .bk-slot { width: var(--s); height: calc(var(--s) * 1.15); border-radius: 14px; border: 4px dashed #b07a45; background: rgba(255,255,255,.5);
    display: grid; place-items: center; font: 400 calc(var(--s) * .62) 'Lilita One', sans-serif; color: rgba(122,75,42,.28); }
  .bk-slot.next { border-color: #e0a12c; background: rgba(255,236,170,.75); }
  .bk-slot.full { border: 0; background: none; }
  .bk-tile { min-width: var(--s); height: calc(var(--s) * 1.15); padding: 0 4px; border-radius: 14px; border: 0; background: #fff4dc; color: #2a2418;
    box-shadow: 0 6px 0 #b07a45; font: 400 calc(var(--s) * .62) 'Lilita One', sans-serif; display: grid; place-items: center;
    touch-action: none; cursor: grab; transition: transform .25s, box-shadow .2s, background .2s; }
  .bk-tile.drag { transition: none; z-index: 10; position: relative; box-shadow: 0 14px 18px rgba(0,0,0,.25); cursor: grabbing; }
  .bk-tile.placed { background: #4cc46a; color: #fff; box-shadow: 0 6px 0 #2d7f42; cursor: default; }
  .bk-tile.used { visibility: hidden; }
  .bk-tile.shake { animation: bk-shake .4s; background: #f2b8ad; }
  .bk-tile.hint { animation: bk-hint 1s ease-in-out infinite; }
  .bk-done .bk-tile.placed { animation: bk-jump .5s calc(var(--i) * .08s); }
  @keyframes bk-shake { 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
  @keyframes bk-hint { 50% { transform: translateY(-10px) scale(1.08); box-shadow: 0 0 0 6px #f2c14e, 0 6px 0 #b07a45; } }
  @keyframes bk-jump { 50% { transform: translateY(-16px); } }
  .bk-msg { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; pointer-events: none; width: 90%;
    font: 400 clamp(30px, 8vmin, 64px) 'Lilita One', sans-serif; color: #fff; text-align: center;
    text-shadow: 0 3px 0 rgba(0,0,0,.3), 0 0 20px rgba(0,0,0,.35); transition: opacity .3s; }
  .bk-msg.hidden { opacity: 0; }
  .bk-msg .stars { font-size: 1.4em; letter-spacing: .1em; }
`;

// opts: { root, profile, store, onExit, game, round, theme, makePuzzle(), startSpeech, tileSpeech(tile) }
export function startBrikkespill({ root, profile, store, onExit, game, round, theme = '', makePuzzle, startSpeech, tileSpeech }) {
  if (!document.getElementById('brikker-css')) {
    const s = document.createElement('style'); s.id = 'brikker-css'; s.textContent = CSS; document.head.append(s);
  }
  root.className = 'bk ' + theme;
  root.innerHTML = `
    <div class="bk-top">
      <button class="bk-btn hold" data-exit aria-label="Tilbake til rommet (hold inne)">✕</button>
      <div class="bk-prog">${'<i></i>'.repeat(round)}</div>
      <button class="bk-btn" data-speak aria-label="Les opp igjen">🔊</button>
    </div>
    <div class="bk-main">
      <button class="bk-pic" aria-label="Hør oppgaven"></button>
      <button class="bk-q" aria-label="Hør oppgaven"></button>
      <div class="bk-slots"></div>
      <div class="bk-tray"></div>
    </div>
    <div class="bk-msg hidden"></div>`;
  const $ = s => root.querySelector(s);
  const test = /(?:^|[#&])test(?:=(\w+))?/.exec(location.hash); // autopilot for automatiske tester: #test=riktig|feil

  const st = { task: null, answers: [], used: new Set(), filled: [], mistakes: 0, slotMistakes: [], busy: false, done: false,
    answered: 0, right: 0, results: [], auto: test ? test[1] || 'riktig' : null };
  if (test) window['__' + game] = st;

  // Brikkestørrelse: hele oppgaven (og brikkene) skal få plass i bredden
  function size() {
    const n = Math.max(st.task.parts.length, Math.ceil(st.task.tiles.length / 2), 4), gap = 10;
    const w = Math.min(root.clientWidth - 28, 760);
    const s = Math.floor(Math.max(44, Math.min(92, (w - gap * (n - 1)) / n, root.clientHeight * 0.1)));
    root.style.setProperty('--s', s + 'px'); root.style.setProperty('--gap', gap + 'px');
  }

  function renderProgress() {
    root.querySelectorAll('.bk-prog i').forEach((el, i) => {
      el.className = i < st.answered ? (st.results[i] ? 'ok' : 'no') : i === st.answered && !st.done ? 'now' : '';
    });
  }

  // ─── Ny oppgave ─────────────────────────────────────────────────────
  // Samme oppgave kommer aldri to ganger i en runde, og helst ikke fra forrige runde heller
  function next() {
    const last = lastRounds[game] || [], fresh = k => !st.used.has(k) && !last.includes(k);
    let t;
    for (let i = 0; i < 80 && (!t || !fresh(t.key)); i++) t = makePuzzle();
    for (let i = 0; i < 80 && st.used.has(t.key); i++) t = makePuzzle();
    st.used.add(t.key);
    st.task = t; st.answers = t.parts.filter(p => 'slot' in p).map(p => p.slot);
    st.filled = st.answers.map(() => null); st.mistakes = 0; st.slotMistakes = st.answers.map(() => 0); st.busy = false;
    root.classList.remove('bk-done');
    const pic = $('.bk-pic');
    pic.hidden = !t.pic; pic.textContent = t.pic || '';
    pic.classList.toggle('rows', [...(t.pic || '')].length > 3);
    $('.bk-q').hidden = !t.q; $('.bk-q').textContent = t.q || '';
    let k = 0;
    $('.bk-slots').innerHTML = t.parts.map(p => 'slot' in p
      ? `<div class="bk-slot" data-i="${k++}">${p.ghost ? p.slot : ''}</div>`
      : `<span class="bk-sym">${p.text}</span>`).join('');
    $('.bk-tray').innerHTML = t.tiles.map(ch => `<button class="bk-tile">${ch}</button>`).join('');
    root.querySelectorAll('.bk-tile').forEach(addDrag);
    size(); renderProgress(); markNext();
    lyd.say(t.speak);
    lyd.prefetch(T.tryAgain(), T.right(), t.done, ...[...new Set(t.tiles)].map(tileSpeech));
  }

  const firstEmpty = () => st.filled.indexOf(null);
  function markNext() {
    root.querySelectorAll('.bk-slot').forEach((el, i) => el.classList.toggle('next', i === firstEmpty()));
  }

  // Legger brikke `tile` i rute `i`. Riktig brikke blir liggende; feil spretter tilbake.
  function place(tile, i) {
    if (st.busy || st.filled[i] !== null || tile.classList.contains('used')) return false;
    const ch = tile.textContent, slot = $(`.bk-slot[data-i="${i}"]`);
    root.querySelectorAll('.bk-tile.hint').forEach(el => el.classList.remove('hint'));
    if (ch !== st.answers[i]) {
      st.mistakes++; st.slotMistakes[i]++;
      tile.classList.add('shake'); setTimeout(() => tile.classList.remove('shake'), 450);
      lyd.oops(); lyd.say(T.tryAgain());
      if (st.slotMistakes[i] >= HINT_AFTER) { // riktig brikke vinker
        const right = [...root.querySelectorAll('.bk-tray .bk-tile:not(.used)')].find(el => el.textContent === st.answers[i]);
        right?.classList.add('hint');
      }
      return false;
    }
    st.filled[i] = ch;
    tile.classList.add('used');
    const copy = document.createElement('div');
    copy.className = 'bk-tile placed'; copy.textContent = ch; copy.style.setProperty('--i', i);
    slot.textContent = ''; slot.classList.add('full'); slot.append(copy);
    lyd.say(tileSpeech(ch));
    markNext();
    if (firstEmpty() < 0) complete();
    return true;
  }

  async function complete() {
    st.busy = true;
    const t = st.task, correct = st.mistakes === 0;
    awardSkills(profile, recordAnswer(profile, t.skill, correct));
    store.save();
    if (correct) st.right++;
    st.results.push(correct); st.answered++;
    renderProgress();
    root.classList.add('bk-done');
    lyd.pling();
    await new Promise(r => setTimeout(r, 450));
    await lyd.say(T.right(), t.done);
    await new Promise(r => setTimeout(r, 600));
    if (closed) return;
    if (st.answered >= round) finish(); else next();
  }

  function finish() {
    st.done = true;
    lastRounds[game] = [...st.used];
    renderProgress();
    const n = starsFor(st.right, round), msg = $('.bk-msg');
    msg.innerHTML = `Bra jobba!<div class="stars">${'⭐'.repeat(n)}</div>`;
    msg.classList.remove('hidden');
    lyd.fanfare();
    // Tilbake til rommet først når stemmen er ferdig (men tidligst etter 3,5 s), ellers kuttes setningen
    Promise.all([lyd.say(T.roundDone(n)), new Promise(r => setTimeout(r, 3500))])
      .then(() => close({ game, right: st.right, total: round }));
  }

  // ─── Dra og slipp, eller trykk ──────────────────────────────────────
  // Et trykk (nesten uten bevegelse) legger brikken i første ledige rute. Et drag slipper den i ruta under fingeren.
  function addDrag(tile) {
    let sx = 0, sy = 0, moved = false, id = null;
    tile.addEventListener('pointerdown', e => {
      if (st.busy || tile.classList.contains('used')) return;
      e.preventDefault(); lyd.audio();
      id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
      tile.setPointerCapture(id);
    });
    tile.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 10) return;
      moved = true;
      tile.classList.add('drag'); tile.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
    });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null;
      tile.classList.remove('drag'); tile.style.transform = '';
      if (e.type === 'pointercancel') return;
      if (!moved) { const i = firstEmpty(); if (i >= 0) place(tile, i); return; }
      const i = slotAt(e.clientX, e.clientY);
      if (i >= 0) place(tile, i);
    };
    tile.addEventListener('pointerup', end);
    tile.addEventListener('pointercancel', end);
  }

  // Ruta under (eller nær) et punkt, litt romslig så små fingre treffer
  function slotAt(x, y) {
    let best = -1, bestD = Infinity;
    root.querySelectorAll('.bk-slot').forEach((el, i) => {
      if (st.filled[i] !== null) return;
      const r = el.getBoundingClientRect(), pad = r.width * 0.45;
      if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return;
      const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  const repeat = () => st.task && lyd.say(st.task.speak);
  $('[data-speak]').onclick = repeat; $('.bk-pic').onclick = repeat; $('.bk-q').onclick = repeat;
  holdButton($('[data-exit]'), 1000, () => close(null));
  const ro = new ResizeObserver(() => st.task && size());
  ro.observe(root);

  // Autopilot for tester: trykker på riktig brikke (ved #test=feil først én feil brikke per oppgave)
  let autoTimer = null;
  if (st.auto) autoTimer = setInterval(() => {
    if (st.busy || st.done || !st.task) return;
    const i = firstEmpty(), free = [...root.querySelectorAll('.bk-tray .bk-tile:not(.used)')];
    const wrong = st.auto === 'feil' && st.mistakes === 0 && free.find(el => el.textContent !== st.answers[i]);
    const tile = wrong || free.find(el => el.textContent === st.answers[i]);
    if (tile && i >= 0) place(tile, i);
  }, 700);

  let wake = null;
  keepAwake().then(w => { wake = w; });
  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    clearInterval(autoTimer); ro.disconnect();
    wake?.release?.();
    lyd.stopSpeaking();
    root.innerHTML = ''; root.className = ''; root.style.removeProperty('--s'); root.style.removeProperty('--gap');
    if (test) delete window['__' + game];
    onExit(result);
  }

  // Start: forklar én gang, så første oppgave
  lyd.say(startSpeech).then(() => { if (!closed && !st.task) next(); });
  setTimeout(() => { if (!closed && !st.task) next(); }, 6000); // i tilfelle stemmen ikke kan spilles
}
