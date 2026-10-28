// Slangen: trykk der slangen skal gå, og spis skiltet med riktig svar. Slangen kan ikke krasje:
// ved kanten svinger den selv, og den kan krysse seg selv. Feil skilt blir til stein og forsvinner,
// og barnet prøver igjen. En runde er 10 oppgaver.
// Lastes inn i rommet (index.html), som deler ut egget når runden er ferdig.

import { nextTask, recordAnswer } from '../kjerne/laering.js';
import { awardSkills, starsFor } from '../kjerne/belonning.js';
import { profileColor } from '../kjerne/lagring.js';
import { holdButton, keepAwake } from '../kjerne/ui.js';
import { T } from '../kjerne/tale.js';
import * as lyd from '../kjerne/lyd.js';

export const ROUND = 10;

const SPEED = 2.4;        // ruter per sekund
const FASTEST = 3.4;      // ... opp til dette etter mange riktige på rad
const GROW = 2;           // nye ledd per riktig svar
const START_LEN = 3;
const READY_AFTER = 1.2;  // sekunder før nye skilt kan spises (tid til å høre spørsmålet)
const MIN_DIST = 4;       // skiltene havner minst så mange ruter fra hodet

const DIRS = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

// ─── Uten grafikk (testes i Node) ─────────────────────────────────────────

// Plasserer skilt: items = [{ span }] (bredde i ruter). Gir [{ c, r }] for hvert, eller null hvis det ikke går.
// Ingen rute under slangen, minst MIN_DIST fra hodet, og minst én tom rute mellom skiltene.
export function placeItems(cols, rows, snake, items, rand = Math.random) {
  const body = new Set(snake.map(([c, r]) => c + ',' + r)), [hc, hr] = snake[0];
  for (let attempt = 0; attempt < 60; attempt++) {
    const placed = [];
    for (const it of items) {
      let spot = null;
      for (let tries = 0; tries < 200 && !spot; tries++) {
        const c = Math.floor(rand() * (cols - it.span + 1)), r = Math.floor(rand() * rows);
        let ok = true;
        for (let k = 0; k < it.span && ok; k++) {
          if (body.has(c + k + ',' + r) || Math.abs(c + k - hc) + Math.abs(r - hr) < MIN_DIST) ok = false;
        }
        for (const p of placed) if (ok && Math.abs(p.r - r) < 2 && c < p.c + p.span + 1 && p.c < c + it.span + 1) ok = false;
        if (ok) spot = { c, r, span: it.span };
      }
      if (!spot) break;
      placed.push(spot);
    }
    if (placed.length === items.length) return placed.map(({ c, r }) => ({ c, r }));
  }
  return null;
}

// Neste retning: den ønskede hvis den ikke snur slangen rett bakover, og svinger selv langs kanten
export function steer(cols, rows, head, dir, want) {
  if (want && !(want[0] === -dir[0] && want[1] === -dir[1])) dir = want;
  const inside = d => head[0] + d[0] >= 0 && head[0] + d[0] < cols && head[1] + d[1] >= 0 && head[1] + d[1] < rows;
  if (inside(dir)) return dir;
  // svinger mot midten av brettet, så slangen ikke kiler seg inn i et hjørne
  const toCenter = d => Math.abs(head[0] + d[0] - (cols - 1) / 2) + Math.abs(head[1] + d[1] - (rows - 1) / 2);
  const side = (dir[0] ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]).filter(inside).sort((a, b) => toCenter(a) - toCenter(b));
  return side[0] || [-dir[0], -dir[1]];
}

// ─── Spillet ──────────────────────────────────────────────────────────────

const CSS = `
  .sl { position: fixed; inset: 0; z-index: 5; background: #3f7d2c; overflow: hidden; touch-action: none;
    user-select: none; -webkit-user-select: none; font-family: 'Nunito', system-ui, sans-serif; }
  .sl canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .sl-top { position: absolute; top: 0; left: 0; right: 0; display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    gap: 10px; padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
    padding-top: max(8px, env(safe-area-inset-top)); background: rgba(94,56,32,.92); color: #fff4dc; z-index: 2; }
  .sl-q { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 56px; text-align: center; }
  .sl-pic { font-size: clamp(56px, 15vmin, 120px); line-height: 1.05; white-space: pre-line; }
  .sl-pic.rows { font-size: clamp(30px, 7vmin, 60px); }
  .sl-pic.small { font-size: clamp(20px, 4.2vmin, 34px); }
  .sl-pic.letter { font: 400 clamp(44px, 10vmin, 80px) 'Lilita One', sans-serif; color: #f2c14e; }
  .sl-text { font: 800 clamp(20px, 4.6vmin, 34px)/1.15 'Nunito', sans-serif; white-space: pre-line; }
  .sl-btn { width: 52px; height: 52px; border-radius: 50%; border: 0; font-size: 26px; background: rgba(255,244,220,.18);
    color: #fff4dc; display: grid; place-items: center; position: relative; touch-action: none; }
  .sl-btn.hold::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
    background: conic-gradient(#f2c14e calc(var(--p, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px)); }
  .sl-prog { display: flex; gap: 6px; justify-content: center; padding: 6px 0 2px; grid-column: 1 / -1; }
  .sl-prog i { width: 14px; height: 18px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: rgba(255,244,220,.25); }
  .sl-prog i.ok { background: radial-gradient(circle at 35% 30%, #fff6c9 0 10%, #f7d46a 30%, #d99a1e 80%); }
  .sl-prog i.no { background: rgba(255,244,220,.55); }
  .sl-prog i.now { outline: 2px solid #f2c14e; outline-offset: 2px; }
  .sl-msg { position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%); z-index: 3; pointer-events: none; width: 90%;
    font: 400 clamp(30px, 8vmin, 64px) 'Lilita One', sans-serif; color: #fff; text-align: center;
    text-shadow: 0 3px 0 rgba(0,0,0,.3), 0 0 20px rgba(0,0,0,.3); transition: opacity .3s; }
  .sl-msg.hidden { opacity: 0; }
  .sl-msg .stars { font-size: 1.4em; letter-spacing: .1em; }
`;

export default function start({ root, profile, store, onExit }) {
  if (!document.getElementById('slange-css')) {
    const s = document.createElement('style'); s.id = 'slange-css'; s.textContent = CSS; document.head.append(s);
  }
  root.className = 'sl';
  root.innerHTML = `
    <canvas></canvas>
    <div class="sl-top">
      <button class="sl-btn hold" data-exit aria-label="Tilbake til rommet (hold inne)">✕</button>
      <div class="sl-q"><div class="sl-pic"></div><div class="sl-text"></div></div>
      <button class="sl-btn" data-speak aria-label="Les opp igjen">🔊</button>
      <div class="sl-prog">${'<i></i>'.repeat(ROUND)}</div>
    </div>
    <div class="sl-msg"></div>`;
  const $ = s => root.querySelector(s);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const color = profileColor(profile);
  const test = /(?:^|[#&])test(?:=(\w+))?/.exec(location.hash); // autopilot for automatiske tester: #test=riktig|feil

  const st = {
    W: 0, H: 0, cell: 0, cols: 0, rows: 0, x0: 0, y0: 0,
    snake: [], prev: [], dir: DIRS.right, queue: [], grow: 0, step: 0,
    started: false, done: false, t: 0,
    task: null, attempt: 0, items: [], nextSpawn: null,
    answered: 0, right: 0, streak: 0, results: [], particles: [],
    auto: test ? test[1] || 'riktig' : null,
  };
  if (test) window.__slange = st;

  // ─── Oppsett og størrelse ───────────────────────────────────────────
  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    st.W = root.clientWidth; st.H = root.clientHeight;
    canvas.width = st.W * dpr; canvas.height = st.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Plass til spørsmålet er satt av fra start (også bilder), så brettet ikke krymper når spørsmålet endres
    const top = Math.max($('.sl-top').getBoundingClientRect().bottom, st.H * 0.24) + 10, bottom = st.H - Math.max(14, parseInt(getComputedStyle(root).paddingBottom) || 0) - 10;
    const boardH = Math.max(200, bottom - top), boardW = st.W - 20;
    // Brettet bestemmes én gang (ved start), så slangen ikke havner utenfor når toppfeltet endrer høyde
    if (!st.cols) {
      st.cell = Math.max(30, Math.min(64, Math.floor(Math.min(boardW / 8, boardH / 11))));
      st.cols = Math.floor(boardW / st.cell); st.rows = Math.floor(boardH / st.cell);
    } else {
      st.cell = Math.max(16, Math.floor(Math.min(boardW / st.cols, boardH / st.rows)));
    }
    st.x0 = Math.round((st.W - st.cols * st.cell) / 2);
    st.y0 = Math.round(top + (boardH - st.rows * st.cell) / 2);
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();
  {
    const c = Math.floor(st.cols / 2) - 1, r = Math.floor(st.rows / 2);
    st.snake = Array.from({ length: START_LEN }, (_, i) => [c - i, r]);
    st.prev = st.snake.map(p => [...p]);
  }

  // ─── Oppgaver ───────────────────────────────────────────────────────
  const labelFont = () => `400 ${Math.round(st.cell * 0.62)}px 'Lilita One', sans-serif`;
  function spanOf(label) {
    ctx.font = labelFont();
    return Math.min(st.cols - 2, Math.max(1, Math.ceil((ctx.measureText(label).width + st.cell * 0.4) / st.cell)));
  }

  function showTask(t) {
    const pic = $('.sl-pic');
    pic.textContent = t.pic || '';
    pic.classList.toggle('letter', /^[A-ZÆØÅ]$/.test(t.pic || ''));
    const rows = (t.pic || '').split('\n').length, many = [...(t.pic || '')].length > 3;
    pic.classList.toggle('rows', many);
    pic.classList.toggle('small', rows > 2);
    pic.hidden = !t.pic;
    $('.sl-text').textContent = t.q;
    renderProgress();
    layout();
    lyd.say(T.task(t));
    lyd.prefetch(T.tryAgain(), T.right());
  }

  function renderProgress() {
    [...root.querySelectorAll('.sl-prog i')].forEach((el, i) => {
      el.className = i < st.answered ? (st.results[i] ? 'ok' : 'no') : i === st.answered && !st.done ? 'now' : '';
    });
  }

  function spawn() {
    st.nextSpawn = null;
    st.task = nextTask(profile); st.attempt = 0;
    showTask(st.task);
    const items = st.task.options.map((label, i) => ({ i, label, span: spanOf(label) }));
    const spots = placeItems(st.cols, st.rows, st.snake, items) || placeItems(st.cols, st.rows, [st.snake[0]], items);
    st.items = items.map((it, k) => ({ ...it, ...(spots ? spots[k] : { c: 0, r: k * 2 }), born: st.t, state: 'ok' }));
  }

  // Bare første forsøk teller i læringsmotoren og for stjernene
  function eat(it) {
    const correct = it.i === st.task.answer, first = st.attempt === 0;
    if (first) {
      awardSkills(profile, recordAnswer(profile, st.task.skill, correct));
      store.save();
    }
    if (correct) {
      if (first) { st.right++; st.streak++; }
      st.results.push(first);
      st.answered++;
      st.grow += GROW;
      it.state = 'eaten';
      for (const o of st.items) if (o !== it) o.state = 'gone';
      lyd.pling(); lyd.say(T.right());
      burst(it);
      renderProgress();
      setTimeout(() => { st.items = []; }, 500);
      if (st.answered >= ROUND) setTimeout(finish, 1300);
      else st.nextSpawn = st.t + 1.6;
    } else {
      st.streak = 0; st.attempt++;
      it.state = 'stone'; it.stoneT = st.t;
      lyd.oops(); lyd.say(T.tryAgain());
    }
  }

  function finish() {
    st.done = true;
    renderProgress();
    const n = starsFor(st.right, ROUND), msg = $('.sl-msg');
    msg.innerHTML = `Bra jobba!<div class="stars">${'⭐'.repeat(n)}</div>`;
    msg.classList.remove('hidden');
    lyd.fanfare();
    // Tilbake til rommet først når stemmen er ferdig (men tidligst etter 3,5 s), ellers kuttes setningen
    Promise.all([lyd.say(T.roundDone(n)), new Promise(r => setTimeout(r, 3500))])
      .then(() => close({ game: 'slange', right: st.right, total: ROUND }));
  }

  // ─── Styring ────────────────────────────────────────────────────────
  function want(d) {
    if (st.done) return;
    if (!st.started) {
      st.started = true;
      st.nextSpawn = st.t + 0.4;
      $('.sl-msg').classList.add('hidden');
    }
    if (d && st.queue.length < 2) st.queue.push(d);
  }
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  // Trykk på brettet: slangen svinger mot trykket (den aksen der trykket er lengst unna hodet)
  const onPointer = e => {
    if (e.target.closest('button')) return;
    e.preventDefault(); lyd.audio();
    const [hx, hy] = headXY(), dx = e.clientX - hx, dy = e.clientY - hy;
    const last = st.queue[st.queue.length - 1] || st.dir;
    const h = dx >= 0 ? DIRS.right : DIRS.left, v = dy >= 0 ? DIRS.down : DIRS.up;
    let d = Math.abs(dx) > Math.abs(dy) ? h : v;
    // Trykk rett foran eller bak slangen: sving til siden trykket er på, eller fortsett hvis det er rett på linja
    if (same(d, last) || same(d, [-last[0], -last[1]])) d = Math.abs(d === h ? dy : dx) < st.cell * 0.5 ? null : d === h ? v : h;
    want(d);
  };
  const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const onKey = e => { if (KEYS[e.code]) { e.preventDefault(); want(DIRS[KEYS[e.code]]); } };
  root.addEventListener('pointerdown', onPointer);
  addEventListener('keydown', onKey);
  $('[data-speak]').onclick = () => st.task && lyd.say(T.task(st.task));
  holdButton($('[data-exit]'), 1000, () => close(null));

  // ─── Oppdatering ────────────────────────────────────────────────────
  function move() {
    if (st.auto) autopilot();
    const head = st.snake[0];
    st.dir = steer(st.cols, st.rows, head, st.dir, st.queue.shift());
    st.prev = st.snake.map(p => [...p]);
    st.snake.unshift([head[0] + st.dir[0], head[1] + st.dir[1]]);
    if (st.grow > 0) { st.grow--; st.prev.push([...st.prev[st.prev.length - 1]]); } else st.snake.pop();
    const [c, r] = st.snake[0];
    const hit = st.items.find(it => it.state === 'ok' && st.t - it.born >= READY_AFTER && r === it.r && c >= it.c && c < it.c + it.span);
    if (hit) eat(hit);
  }

  function update(dt) {
    st.t += dt;
    if (!st.started) { if (st.auto) want(DIRS.right); return; }
    if (st.nextSpawn !== null && st.t >= st.nextSpawn && !st.done) spawn();
    st.items = st.items.filter(it => it.state !== 'stone' || st.t - it.stoneT < 0.9);
    st.step += dt * Math.min(FASTEST, SPEED + 0.1 * st.streak);
    while (st.step >= 1) { st.step -= 1; move(); }
    for (const p of st.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += st.cell * 8 * dt; p.life -= dt; }
    st.particles = st.particles.filter(p => p.life > 0);
  }

  // Autopilot for tester: går mot riktig skilt (eller et feil skilt så lenge det finnes, ved #test=feil)
  function autopilot() {
    const ready = st.items.filter(it => it.state === 'ok');
    const target = (st.auto === 'feil' && ready.find(it => it.i !== st.task.answer)) || ready.find(it => it.i === st.task.answer);
    if (!target) return;
    const [hc, hr] = st.snake[0], tc = Math.max(target.c, Math.min(hc, target.c + target.span - 1));
    const opts = Object.values(DIRS).filter(d => !(d[0] === -st.dir[0] && d[1] === -st.dir[1]));
    const dist = d => Math.abs(hc + d[0] - tc) + Math.abs(hr + d[1] - target.r);
    st.queue = [opts.sort((a, b) => dist(a) - dist(b))[0]];
  }

  function burst(it) {
    const x = st.x0 + (it.c + it.span / 2) * st.cell, y = st.y0 + (it.r + 0.5) * st.cell;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, s = st.cell * (3 + Math.random() * 4);
      st.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - st.cell * 3, life: 0.9 });
    }
  }

  // ─── Tegning ────────────────────────────────────────────────────────
  function roundRect(x, y, w, h, r) { // roundRect finnes først fra iOS 16
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }
  // Hodets posisjon på skjermen akkurat nå (glir mellom rutene)
  function segXY(i) {
    const a = st.prev[i] || st.snake[i], b = st.snake[i], k = st.started ? st.step : 0;
    return [st.x0 + (a[0] + (b[0] - a[0]) * k + 0.5) * st.cell, st.y0 + (a[1] + (b[1] - a[1]) * k + 0.5) * st.cell];
  }
  const headXY = () => segXY(0);

  function draw() {
    const { W, H, cell, cols, rows, x0, y0 } = st;
    ctx.fillStyle = '#3f7d2c'; ctx.fillRect(0, 0, W, H);
    // Gressbrett i ruter, med jordkant
    ctx.fillStyle = '#7a4b2a'; ctx.fillRect(x0 - 8, y0 - 8, cols * cell + 16, rows * cell + 16);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#79c35a' : '#86cc66';
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
    }
    for (const it of st.items) drawItem(it);
    drawSnake();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of st.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = `${cell * 0.6}px sans-serif`;
      ctx.fillText('⭐', p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawItem(it) {
    const { cell } = st, age = st.t - it.born;
    const x = st.x0 + it.c * cell + 3, y = st.y0 + it.r * cell + 3, w = it.span * cell - 6, h = cell - 6;
    const pop = Math.min(1, age / 0.35), ready = age >= READY_AFTER;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop, pop);
    ctx.globalAlpha = it.state === 'stone' ? Math.max(0, 1 - (st.t - it.stoneT) / 0.9) : it.state === 'ok' ? (ready ? 1 : 0.6) : 0;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; roundRect(-w / 2, -h / 2 + 4, w, h, 10); ctx.fill();
    ctx.fillStyle = it.state === 'stone' ? '#8b8b8b' : '#fff4dc';
    roundRect(-w / 2, -h / 2, w, h, 10); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = it.state === 'stone' ? '#555' : '#7a4b2a'; ctx.stroke();
    ctx.fillStyle = it.state === 'stone' ? '#555' : '#2a2418';
    ctx.font = labelFont(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.label, 0, cell * 0.04);
    ctx.restore();
  }

  function drawSnake() {
    const { cell } = st, pts = st.snake.map((_, i) => segXY(i));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = cell * 0.74;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 3) : ctx.moveTo(x, y + 3)); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = cell * 0.68;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    // Prikker på ryggen
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 1; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], cell * 0.12, 0, Math.PI * 2); ctx.fill(); }
    // Hodet med øyne og tunge, vendt i fartsretningen
    const [hx, hy] = pts[0], a = Math.atan2(st.dir[1], st.dir[0]);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(cell * 0.08, 0, cell * 0.46, cell * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    if (Math.sin(st.t * 6) > 0.3) {
      ctx.strokeStyle = '#d63a3a'; ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.beginPath(); ctx.moveTo(cell * 0.5, 0); ctx.lineTo(cell * 0.72, 0); ctx.lineTo(cell * 0.82, -cell * 0.08);
      ctx.moveTo(cell * 0.72, 0); ctx.lineTo(cell * 0.82, cell * 0.08); ctx.stroke();
    }
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cell * 0.2, s * cell * 0.18, cell * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cell * 0.25, s * cell * 0.18, cell * 0.065, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ─── Løkke og avslutning ────────────────────────────────────────────
  let raf = 0, last = performance.now(), paused = false;
  const sideways = matchMedia('(orientation: landscape) and (pointer: coarse)');
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!paused && !sideways.matches) update(dt); // på tvers: rommet viser «snu skjermen», spillet står stille
    draw();
  }
  const onVis = () => { paused = document.visibilityState === 'hidden'; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  let wake = null;
  keepAwake().then(w => { wake = w; });
  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf); ro.disconnect();
    removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    wake?.release?.();
    lyd.stopSpeaking();
    root.innerHTML = ''; root.className = '';
    if (test) delete window.__slange;
    onExit(result);
  }

  // Start: slangen ligger stille til første trykk
  const msg = $('.sl-msg');
  msg.textContent = 'Trykk der slangen skal gå!';
  $('.sl-text').textContent = '';
  $('.sl-pic').hidden = true;
  renderProgress();
  lyd.say(T.snakeStart());
  raf = requestAnimationFrame(loop);
}
