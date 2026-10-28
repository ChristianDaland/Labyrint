// Ordbyggeren: se bildet, hør ordet og bygg det med bokstavbrikker. Dra en brikke til en rute, eller trykk
// på den, så havner den i første ledige rute. Feil bokstav spretter tilbake («Prøv igjen»). Ordet regnes som
// riktig bare uten feil. Staving er et eget fag («stave») i læringsmotoren, med seks nivåer fra å kopiere
// korte ord til å stave lange ord med ekstra bokstaver å velge bort. En runde er 8 ord.
// Lastes inn i rommet (index.html), som deler ut egget når runden er ferdig.

import { chooseSkill, recordAnswer } from '../kjerne/laering.js';
import { makeTask } from '../kjerne/oppgaver.js';
import { awardSkills, starsFor } from '../kjerne/belonning.js';
import { holdButton, keepAwake } from '../kjerne/ui.js';
import { T } from '../kjerne/tale.js';
import * as lyd from '../kjerne/lyd.js';

export const ROUND = 8;
const HINT_AFTER = 2; // feil på samme rute før riktig brikke begynner å vinke

const CSS = `
  .ob { position: fixed; inset: 0; z-index: 5; overflow: auto; touch-action: manipulation; user-select: none; -webkit-user-select: none;
    background: radial-gradient(circle at 50% 30%, #fff1d6, #f2d3a2 70%); color: #3b2414; font-family: 'Nunito', system-ui, sans-serif;
    display: flex; flex-direction: column; }
  .ob-top { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
    padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
    padding-top: max(8px, env(safe-area-inset-top)); background: rgba(94,56,32,.92); color: #fff4dc; }
  .ob-btn { width: 52px; height: 52px; border-radius: 50%; border: 0; font-size: 26px; background: rgba(255,244,220,.18);
    color: #fff4dc; display: grid; place-items: center; position: relative; touch-action: none; }
  .ob-btn.hold::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
    background: conic-gradient(#f2c14e calc(var(--p, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px)); }
  .ob-prog { display: flex; gap: 6px; justify-content: center; }
  .ob-prog i { width: 16px; height: 21px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: rgba(255,244,220,.25); }
  .ob-prog i.ok { background: radial-gradient(circle at 35% 30%, #fff6c9 0 10%, #f7d46a 30%, #d99a1e 80%); }
  .ob-prog i.no { background: rgba(255,244,220,.55); }
  .ob-prog i.now { outline: 2px solid #f2c14e; outline-offset: 2px; }
  .ob-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; gap: 14px;
    padding: 12px max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)); }
  .ob-pic { font-size: clamp(90px, 26vmin, 190px); line-height: 1; border: 0; background: none; padding: 0; position: relative; }
  .ob-pic::after { content: '🔊'; position: absolute; right: -18px; bottom: -4px; font-size: 26px; opacity: .7; }
  .ob-slots, .ob-tray { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--gap); max-width: 100%; }
  .ob-slot { width: var(--s); height: calc(var(--s) * 1.15); border-radius: 14px; border: 4px dashed #b07a45; background: rgba(255,255,255,.5);
    display: grid; place-items: center; font: 400 calc(var(--s) * .62) 'Lilita One', sans-serif; color: rgba(122,75,42,.28); }
  .ob-slot.next { border-color: #e0a12c; background: rgba(255,236,170,.75); }
  .ob-slot.full { border: 0; background: none; }
  .ob-tile { width: var(--s); height: calc(var(--s) * 1.15); border-radius: 14px; border: 0; background: #fff4dc; color: #2a2418;
    box-shadow: 0 6px 0 #b07a45; font: 400 calc(var(--s) * .62) 'Lilita One', sans-serif; display: grid; place-items: center;
    touch-action: none; cursor: grab; transition: transform .25s, box-shadow .2s, background .2s; }
  .ob-tile.drag { transition: none; z-index: 10; position: relative; box-shadow: 0 14px 18px rgba(0,0,0,.25); cursor: grabbing; }
  .ob-tile.placed { background: #4cc46a; color: #fff; box-shadow: 0 6px 0 #2d7f42; cursor: default; }
  .ob-tile.used { visibility: hidden; }
  .ob-tile.shake { animation: ob-shake .4s; background: #f2b8ad; }
  .ob-tile.hint { animation: ob-hint 1s ease-in-out infinite; }
  .ob-done .ob-tile.placed { animation: ob-jump .5s calc(var(--i) * .08s); }
  @keyframes ob-shake { 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
  @keyframes ob-hint { 50% { transform: translateY(-10px) scale(1.08); box-shadow: 0 0 0 6px #f2c14e, 0 6px 0 #b07a45; } }
  @keyframes ob-jump { 50% { transform: translateY(-16px); } }
  .ob-msg { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; pointer-events: none; width: 90%;
    font: 400 clamp(30px, 8vmin, 64px) 'Lilita One', sans-serif; color: #fff; text-align: center;
    text-shadow: 0 3px 0 rgba(0,0,0,.3), 0 0 20px rgba(0,0,0,.35); transition: opacity .3s; }
  .ob-msg.hidden { opacity: 0; }
  .ob-msg .stars { font-size: 1.4em; letter-spacing: .1em; }
`;

export default function start({ root, profile, store, onExit }) {
  if (!document.getElementById('ordbygger-css')) {
    const s = document.createElement('style'); s.id = 'ordbygger-css'; s.textContent = CSS; document.head.append(s);
  }
  root.className = 'ob';
  root.innerHTML = `
    <div class="ob-top">
      <button class="ob-btn hold" data-exit aria-label="Tilbake til rommet (hold inne)">✕</button>
      <div class="ob-prog">${'<i></i>'.repeat(ROUND)}</div>
      <button class="ob-btn" data-speak aria-label="Les opp igjen">🔊</button>
    </div>
    <div class="ob-main">
      <button class="ob-pic" aria-label="Hør ordet"></button>
      <div class="ob-slots"></div>
      <div class="ob-tray"></div>
    </div>
    <div class="ob-msg hidden"></div>`;
  const $ = s => root.querySelector(s);
  const test = /(?:^|[#&])test(?:=(\w+))?/.exec(location.hash); // autopilot for automatiske tester: #test=riktig|feil

  const st = { task: null, used: new Set(), filled: [], mistakes: 0, slotMistakes: [], busy: false, done: false,
    answered: 0, right: 0, results: [], auto: test ? test[1] || 'riktig' : null };
  if (test) window.__ordbygger = st;

  // Brikkestørrelse: hele ordet (og brikkene) skal få plass i bredden
  function size() {
    const n = Math.max(st.task.word.length, Math.ceil(st.task.tiles.length / 2), 4), gap = 10;
    const w = Math.min(root.clientWidth - 28, 760);
    const s = Math.floor(Math.max(44, Math.min(92, (w - gap * (n - 1)) / n, root.clientHeight * 0.1)));
    root.style.setProperty('--s', s + 'px'); root.style.setProperty('--gap', gap + 'px');
  }

  function renderProgress() {
    root.querySelectorAll('.ob-prog i').forEach((el, i) => {
      el.className = i < st.answered ? (st.results[i] ? 'ok' : 'no') : i === st.answered && !st.done ? 'now' : '';
    });
  }

  // ─── Nytt ord ───────────────────────────────────────────────────────
  // Samme ord kommer ikke to ganger i en runde (ordlistene har 10–20 ord per nivå, en runde 8)
  function next() {
    let t;
    for (let i = 0; i < 50 && (!t || st.used.has(t.word)); i++) t = makeTask(chooseSkill(profile.learning, 'stave').id);
    st.used.add(t.word);
    st.task = t; st.filled = Array(t.word.length).fill(null); st.mistakes = 0; st.slotMistakes = Array(t.word.length).fill(0); st.busy = false;
    root.classList.remove('ob-done');
    $('.ob-pic').textContent = t.pic;
    $('.ob-slots').innerHTML = [...t.word].map((ch, i) => `<div class="ob-slot" data-i="${i}">${t.ghost ? ch : ''}</div>`).join('');
    $('.ob-tray').innerHTML = t.tiles.map((ch, i) => `<button class="ob-tile" data-t="${i}">${ch}</button>`).join('');
    root.querySelectorAll('.ob-tile').forEach(addDrag);
    size(); renderProgress(); markNext();
    lyd.say(T.task(t));
    lyd.prefetch(T.tryAgain(), T.right(), T.word(t.word), ...[...new Set(t.tiles)].map(T.letter));
  }

  const firstEmpty = () => st.filled.indexOf(null);
  function markNext() {
    root.querySelectorAll('.ob-slot').forEach((el, i) => el.classList.toggle('next', i === firstEmpty()));
  }

  // Legger brikke `tile` i rute `i`. Riktig bokstav blir liggende; feil spretter tilbake.
  function place(tile, i) {
    if (st.busy || st.filled[i] !== null || tile.classList.contains('placed')) return false;
    const ch = tile.textContent, slot = $(`.ob-slot[data-i="${i}"]`);
    root.querySelectorAll('.ob-tile.hint').forEach(el => el.classList.remove('hint'));
    if (ch !== st.task.word[i]) {
      st.mistakes++; st.slotMistakes[i]++;
      tile.classList.add('shake'); setTimeout(() => tile.classList.remove('shake'), 450);
      lyd.oops(); lyd.say(T.tryAgain());
      if (st.slotMistakes[i] >= HINT_AFTER) { // riktig brikke vinker
        const right = [...root.querySelectorAll('.ob-tray .ob-tile:not(.used)')].find(el => el.textContent === st.task.word[i]);
        right?.classList.add('hint');
      }
      return false;
    }
    st.filled[i] = ch;
    tile.classList.add('used');
    const copy = document.createElement('div');
    copy.className = 'ob-tile placed'; copy.textContent = ch; copy.style.setProperty('--i', i);
    slot.textContent = ''; slot.classList.add('full'); slot.append(copy);
    lyd.say(T.letter(ch));
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
    root.classList.add('ob-done');
    lyd.pling();
    await new Promise(r => setTimeout(r, 450));
    await lyd.say(T.right(), T.word(t.word));
    await new Promise(r => setTimeout(r, 600));
    if (closed) return;
    if (st.answered >= ROUND) finish(); else next();
  }

  function finish() {
    st.done = true;
    renderProgress();
    const n = starsFor(st.right, ROUND), msg = $('.ob-msg');
    msg.innerHTML = `Bra jobba!<div class="stars">${'⭐'.repeat(n)}</div>`;
    msg.classList.remove('hidden');
    lyd.fanfare();
    // Tilbake til rommet først når stemmen er ferdig (men tidligst etter 3,5 s), ellers kuttes setningen
    Promise.all([lyd.say(T.roundDone(n)), new Promise(r => setTimeout(r, 3500))])
      .then(() => close({ game: 'ordbygger', right: st.right, total: ROUND }));
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
    root.querySelectorAll('.ob-slot').forEach((el, i) => {
      if (st.filled[i] !== null) return;
      const r = el.getBoundingClientRect(), pad = r.width * 0.45;
      if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return;
      const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  $('[data-speak]').onclick = () => st.task && lyd.say(T.task(st.task));
  $('.ob-pic').onclick = () => st.task && lyd.say(T.task(st.task));
  holdButton($('[data-exit]'), 1000, () => close(null));
  const ro = new ResizeObserver(() => st.task && size());
  ro.observe(root);

  // Autopilot for tester: trykker på riktig brikke (ved #test=feil først én feil brikke per ord)
  let autoTimer = null;
  if (st.auto) autoTimer = setInterval(() => {
    if (st.busy || st.done || !st.task) return;
    const i = firstEmpty(), free = [...root.querySelectorAll('.ob-tray .ob-tile:not(.used)')];
    const wrong = st.auto === 'feil' && st.mistakes === 0 && free.find(el => el.textContent !== st.task.word[i]);
    const tile = wrong || free.find(el => el.textContent === st.task.word[i]);
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
    if (test) delete window.__ordbygger;
    onExit(result);
  }

  // Start: forklar én gang, så første ord
  lyd.say(T.spellStart()).then(() => { if (!closed && !st.task) next(); });
  setTimeout(() => { if (!closed && !st.task) next(); }, 6000); // i tilfelle stemmen ikke kan spilles
}
