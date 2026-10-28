// Flakse-fuglen: trykk for å flakse, og fly gjennom åpningen med riktig svar. Fuglen kan ikke krasje:
// nær veggen glir den inn i åpningen den er nærmest. Feil svar gir samme spørsmål på en ny vegg der
// den feile åpningen er murt igjen, helt til fuglen flyr gjennom riktig. En runde er 10 oppgaver.
// Lastes inn i rommet (index.html), som deler ut gullegget når runden er ferdig.

import { nextTask, recordAnswer } from '../kjerne/laering.js';
import { awardSkills, starsFor } from '../kjerne/belonning.js';
import { profileColor } from '../kjerne/lagring.js';
import { holdButton, keepAwake } from '../kjerne/ui.js';
import { T } from '../kjerne/tale.js';
import * as lyd from '../kjerne/lyd.js';

export const ROUND = 10;

// Alle mål er relative til spillfeltet, så spillet føles likt på iPhone, iPad og PC
const TRAVEL = 10;       // sekunder fra en vegg dukker opp til den når fuglen: tid til å høre og forstå spørsmålet
const FASTEST = 0.75;    // ... ned til 75 % av tiden etter mange riktige på rad
const GRAVITY = 1.5;     // feltets høyde per s²
const FLAP = -0.55;      // fart oppover etter et trykk
const MAX_FALL = 0.65;
const GAP = 0.24;        // hver åpning er 24 % av feltets høyde
const ASSIST = 1.8;      // så mange veggbredder før veggen begynner fuglen å gli mot nærmeste åpning

const CSS = `
  .fl { position: fixed; inset: 0; z-index: 5; background: #8fd3ff; overflow: hidden; touch-action: none;
    user-select: none; -webkit-user-select: none; font-family: 'Nunito', system-ui, sans-serif; }
  .fl canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .fl-top { position: absolute; top: 0; left: 0; right: 0; display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    gap: 10px; padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
    padding-top: max(8px, env(safe-area-inset-top)); background: rgba(94,56,32,.88); color: #fff4dc; z-index: 2; }
  .fl-q { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 56px; text-align: center; }
  .fl-pic { font-size: clamp(56px, 15vmin, 120px); line-height: 1.05; white-space: pre-line; } /* ett bilde: stort */
  .fl-pic.rows { font-size: clamp(30px, 7vmin, 60px); }
  .fl-pic.small { font-size: clamp(20px, 4.2vmin, 34px); }
  .fl-pic.letter { font: 400 clamp(44px, 10vmin, 80px) 'Lilita One', sans-serif; color: #f2c14e; }
  .fl-text { font: 800 clamp(20px, 4.6vmin, 34px)/1.15 'Nunito', sans-serif; white-space: pre-line; }
  .fl-btn { width: 52px; height: 52px; border-radius: 50%; border: 0; font-size: 26px; background: rgba(255,244,220,.18);
    color: #fff4dc; display: grid; place-items: center; position: relative; touch-action: none; }
  .fl-btn.hold::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
    background: conic-gradient(#f2c14e calc(var(--p, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px)); }
  .fl-prog { display: flex; gap: 6px; justify-content: center; padding: 6px 0 2px; grid-column: 1 / -1; }
  .fl-prog i { width: 14px; height: 18px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: rgba(255,244,220,.25); }
  .fl-prog i.ok { background: radial-gradient(circle at 35% 30%, #fff6c9 0 10%, #f7d46a 30%, #d99a1e 80%); }
  .fl-prog i.no { background: rgba(255,244,220,.55); }
  .fl-prog i.now { outline: 2px solid #f2c14e; outline-offset: 2px; }
  .fl-msg { position: absolute; left: 50%; top: 55%; transform: translate(-50%, -50%); z-index: 3; pointer-events: none;
    font: 400 clamp(30px, 8vmin, 64px) 'Lilita One', sans-serif; color: #fff; text-align: center;
    text-shadow: 0 3px 0 rgba(0,0,0,.25), 0 0 20px rgba(0,0,0,.25); transition: opacity .3s; }
  .fl-msg.hidden { opacity: 0; }
  .fl-msg .stars { font-size: 1.4em; letter-spacing: .1em; }
`;

export default function start({ root, profile, store, onExit }) {
  if (!document.getElementById('flakse-css')) {
    const s = document.createElement('style'); s.id = 'flakse-css'; s.textContent = CSS; document.head.append(s);
  }
  root.className = 'fl';
  root.innerHTML = `
    <canvas></canvas>
    <div class="fl-top">
      <button class="fl-btn hold" data-exit aria-label="Tilbake til rommet (hold inne)">✕</button>
      <div class="fl-q"><div class="fl-pic"></div><div class="fl-text"></div></div>
      <button class="fl-btn" data-speak aria-label="Les opp igjen">🔊</button>
      <div class="fl-prog">${'<i></i>'.repeat(ROUND)}</div>
    </div>
    <div class="fl-msg"></div>`;
  const $ = s => root.querySelector(s);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const color = profileColor(profile);
  const test = /(?:^|[#&])test(?:=(\w+))?/.exec(location.hash); // autopilot for automatiske tester: #test=riktig|slurv|feil

  const st = {
    W: 0, H: 0, top: 0, ground: 0, B: 0, r: 0, wallW: 0, birdX: 0,
    y: 0, vy: 0, flapT: 0, started: false, done: false, t: 0, scroll: 0,
    walls: [], nextSpawn: null, retry: null,
    answered: 0, right: 0, streak: 0, task: null, particles: [], results: [],
    auto: test ? test[1] || 'riktig' : null,
  };
  if (test) window.__flakse = st;

  // ─── Oppsett og størrelse ───────────────────────────────────────────
  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    st.W = root.clientWidth; st.H = root.clientHeight;
    canvas.width = st.W * dpr; canvas.height = st.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    st.top = $('.fl-top').getBoundingClientRect().bottom + 8;
    st.ground = st.H - Math.max(28, st.H * 0.07);
    st.B = Math.max(120, st.ground - 8 - st.top);
    st.r = Math.max(12, Math.min(34, st.B * 0.055));
    st.wallW = Math.max(46, Math.min(90, Math.min(st.W, st.H) * 0.09));
    st.birdX = st.W * (st.W > st.H ? 0.25 : 0.22);
    if (!st.started) st.y = st.top + st.B / 2;
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();

  // Åpning i: fra y0 til y1, jevnt fordelt i feltet
  function gap(i) {
    const g = st.B * GAP, s = (st.B - 3 * g) / 4, y0 = st.top + s * (i + 1) + g * i;
    return { y0, y1: y0 + g, cy: y0 + g / 2 };
  }
  const speed = () => (st.W - st.birdX + st.wallW) / (TRAVEL * Math.max(FASTEST, 1 - 0.05 * st.streak));
  // Nærmeste åpne åpning til en høyde
  const nearestOpen = (w, y) => [0, 1, 2].filter(i => w.open[i]).reduce((a, b) => Math.abs(gap(a).cy - y) <= Math.abs(gap(b).cy - y) ? a : b);

  // ─── Oppgaver ───────────────────────────────────────────────────────
  function showTask(t) {
    const pic = $('.fl-pic');
    pic.textContent = t.pic || '';
    pic.classList.toggle('letter', /^[A-ZÆØÅ]$/.test(t.pic || ''));
    const rows = (t.pic || '').split('\n').length, many = [...(t.pic || '')].length > 3; // telleoppgaver har mange bilder
    pic.classList.toggle('rows', many);
    pic.classList.toggle('small', rows > 2);
    pic.hidden = !t.pic;
    $('.fl-text').textContent = t.q;
    renderProgress();
    layout(); // spørsmålet kan endre høyden på toppfeltet
    lyd.say(T.task(t));
    lyd.prefetch(T.tryAgain(), T.right());
  }

  function renderProgress() {
    [...root.querySelectorAll('.fl-prog i')].forEach((el, i) => {
      el.className = i < st.answered ? (st.results[i] ? 'ok' : 'no') : i === st.answered && !st.done ? 'now' : '';
    });
  }

  // Ny vegg: et nytt spørsmål, eller samme spørsmål igjen (med de feile åpningene murt igjen) etter feil svar
  function spawn() {
    const r = st.retry;
    st.task = r ? r.task : nextTask(profile);
    st.walls.push({ x: st.W + st.wallW, task: st.task, chosen: -1, open: r ? r.open : [true, true, true], attempt: r ? r.attempt : 0 });
    st.retry = null;
    st.nextSpawn = null;
    showTask(st.task);
  }

  // Bare første forsøk teller i læringsmotoren og for stjernene
  function answer(w, i) {
    const correct = i === w.task.answer, first = w.attempt === 0;
    w.chosen = i;
    if (first) {
      awardSkills(profile, recordAnswer(profile, w.task.skill, correct));
      store.save();
    }
    if (correct) {
      if (first) { st.right++; st.streak++; }
      st.results.push(first);
      st.answered++;
      lyd.pling(); lyd.say(T.right());
      burst();
      renderProgress();
      if (st.answered >= ROUND) setTimeout(finish, 1500);
      else st.nextSpawn = st.t + 1.4;
    } else {
      st.streak = 0;
      lyd.oops(); lyd.say(T.tryAgain());
      st.retry = { task: w.task, open: w.open.map((o, j) => o && j !== i), attempt: w.attempt + 1 };
      st.nextSpawn = st.t + 2.4; // tid til å høre «Ikke helt. Prøv igjen!»
    }
  }

  function finish() {
    st.done = true;
    renderProgress();
    const n = starsFor(st.right, ROUND), msg = $('.fl-msg');
    msg.innerHTML = `Bra jobba!<div class="stars">${'⭐'.repeat(n)}</div>`;
    msg.classList.remove('hidden');
    lyd.fanfare();
    lyd.say(T.roundDone(n));
    setTimeout(() => close({ game: 'flakse', right: st.right, total: ROUND }), 3500);
  }

  // ─── Styring ────────────────────────────────────────────────────────
  function flap() {
    if (st.done) return;
    if (!st.started) {
      st.started = true;
      st.nextSpawn = st.t + 0.8;
      $('.fl-msg').classList.add('hidden');
    }
    st.vy = FLAP * st.B;
    st.flapT = st.t;
    lyd.flap();
  }
  const onPointer = e => { if (!e.target.closest('button')) { e.preventDefault(); lyd.audio(); flap(); } };
  const onKey = e => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); flap(); } };
  root.addEventListener('pointerdown', onPointer);
  addEventListener('keydown', onKey);
  $('[data-speak]').onclick = () => st.task && lyd.say(T.task(st.task));
  holdButton($('[data-exit]'), 1000, () => close(null));

  // ─── Oppdatering ────────────────────────────────────────────────────
  function update(dt) {
    st.t += dt;
    if (!st.started) { // svever og venter på første trykk
      st.y = st.top + st.B / 2 + Math.sin(st.t * 3) * st.B * 0.04;
      if (st.auto) flap();
      return;
    }
    if (st.nextSpawn !== null && st.t >= st.nextSpawn && !st.done) spawn();

    st.vy = Math.min(st.vy + GRAVITY * st.B * dt, MAX_FALL * st.B);
    st.y += st.vy * dt;
    if (st.y < st.top + st.r) { st.y = st.top + st.r; st.vy = Math.max(st.vy, 0); }
    if (st.y > st.ground - st.r) { st.y = st.ground - st.r; st.vy = FLAP * st.B * 0.45; } // sprett fra bakken

    const v = speed();
    st.scroll += v * dt;
    for (const w of st.walls) w.x -= v * dt;
    st.walls = st.walls.filter(w => w.x + st.wallW > -st.W * 0.6);

    const w = st.walls.find(w => w.chosen < 0);
    if (w) {
      // Nær veggen glir fuglen inn i nærmeste åpne åpning, så den aldri treffer murstein
      const dist = w.x - st.birdX;
      if (dist < st.wallW * ASSIST && dist > -st.wallW) {
        const k = Math.min(1, dt * 7), cy = gap(nearestOpen(w, st.y)).cy;
        st.y += (cy - st.y) * k;
        st.vy *= 1 - k;
      }
      if (st.birdX > w.x + st.wallW / 2) answer(w, nearestOpen(w, st.y));
      if (st.auto) { // autopilot for tester: styr mot riktig (eller feil, så lenge det finnes en) åpning
        const wrong = [0, 1, 2].find(i => w.open[i] && i !== w.task.answer);
        const edge = st.auto === 'slurv' ? st.B * GAP * 0.48 : 0; // «slurv»: sikter mot kanten, nesten i mursteinen
        const target = gap(st.auto === 'feil' && wrong !== undefined ? wrong : w.task.answer).cy + edge;
        if (st.y > target + st.B * 0.02 && st.vy > -st.B * 0.1) flap();
      }
    } else if (st.auto && st.y > st.top + st.B * 0.55 && st.vy > 0) flap();

    for (const p of st.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += st.B * dt; p.life -= dt; }
    st.particles = st.particles.filter(p => p.life > 0);
  }

  function burst() {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, s = st.B * (0.3 + Math.random() * 0.4);
      st.particles.push({ x: st.birdX, y: st.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - st.B * 0.3, life: 0.9 });
    }
  }

  // ─── Tegning ────────────────────────────────────────────────────────
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i / 6 + Math.random() * 0.1, y: 0.15 + Math.random() * 0.35, s: 0.6 + Math.random() * 0.6 }));

  function roundRect(x, y, w, h, r) { // roundRect finnes først fra iOS 16
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function draw() {
    const { W, H, top, ground } = st;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#6cc4f5'); sky.addColorStop(1, '#d6f1ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // Klosseskyer som glir sakte (dybde)
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const cs = Math.min(W, H) * 0.05;
    for (const c of clouds) {
      const x = ((c.x * (W + 6 * cs) - st.scroll * 0.15) % (W + 6 * cs) + (W + 6 * cs)) % (W + 6 * cs) - 3 * cs;
      const y = top + c.y * (ground - top), s = cs * c.s;
      ctx.fillRect(x, y, s * 4, s); ctx.fillRect(x + s, y - s, s * 2, s);
    }

    // Bakke: gress og jordklosser
    const bs = Math.max(20, (H - ground) * 0.5), off = -(st.scroll % bs);
    ctx.fillStyle = '#7a4b2a'; ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#5ab552'; ctx.fillRect(0, ground, W, bs * 0.45);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let x = off; x < W; x += bs) ctx.fillRect(x, ground, 2, H - ground);

    for (const w of st.walls) drawWall(w);
    drawBird();

    for (const p of st.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = `${st.r}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⭐', p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function bricks(x, y, w, h) {
    if (h <= 0) return;
    ctx.fillStyle = '#b5652d'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(70,30,10,.45)';
    const bh = 16;
    for (let yy = y + bh; yy < y + h; yy += bh) ctx.fillRect(x, yy, w, 2);
    for (let yy = y, row = 0; yy < y + h; yy += bh, row++)
      for (let xx = x + (row % 2 ? w / 4 : w / 2); xx < x + w; xx += w / 2) ctx.fillRect(xx, yy, 2, Math.min(bh, y + h - yy));
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x, y, 4, h);
  }

  function drawWall(w) {
    const g = [0, 1, 2].map(gap);
    bricks(w.x, st.top - 8, st.wallW, g[0].y0 - st.top + 8);
    bricks(w.x, g[0].y1, st.wallW, g[1].y0 - g[0].y1);
    bricks(w.x, g[1].y1, st.wallW, g[2].y0 - g[1].y1);
    bricks(w.x, g[2].y1, st.wallW, st.ground - g[2].y1);
    g.forEach((gg, i) => { if (!w.open[i]) bricks(w.x, gg.y0, st.wallW, gg.y1 - gg.y0); }); // murt igjen etter feil svar
    w.task.options.forEach((label, i) => {
      if (!w.open[i]) return;
      const { y0, y1, cy } = g[i];
      // Den valgte åpningen blir grønn (riktig) eller rød (feil). Riktig svar avsløres ikke ved feil, for barnet skal prøve igjen.
      const picked = i === w.chosen, ok = picked && i === w.task.answer;
      if (picked) {
        ctx.fillStyle = ok ? 'rgba(60,179,113,.35)' : 'rgba(217,83,79,.3)';
        ctx.fillRect(w.x - 6, y0, st.wallW + 12, y1 - y0);
      }
      let size = Math.min((y1 - y0) * 0.42, 54);
      ctx.font = `400 ${size}px 'Lilita One', sans-serif`;
      let tw = ctx.measureText(label).width;
      const maxW = Math.min(st.W * 0.42, 320);
      if (tw > maxW - 24) { size *= (maxW - 24) / tw; ctx.font = `400 ${size}px 'Lilita One', sans-serif`; tw = ctx.measureText(label).width; }
      const sw = Math.max(st.wallW * 1.2, tw + 26), sh = size * 1.35;
      const sx = w.x + st.wallW / 2 - sw / 2, sy = cy - sh / 2;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; roundRect(sx, sy + 4, sw, sh, 12); ctx.fill();
      ctx.fillStyle = picked ? (ok ? '#4cc46a' : '#e0533d') : '#fff4dc';
      roundRect(sx, sy, sw, sh, 12); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#7a4b2a'; ctx.stroke();
      ctx.fillStyle = picked ? '#fff' : '#2a2418';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, w.x + st.wallW / 2, cy + size * 0.05);
    });
  }

  function drawBird() {
    const r = st.r, x = st.birdX, y = st.y;
    const tilt = Math.max(-0.5, Math.min(0.7, st.vy / st.B * 0.9));
    const wing = Math.sin(Math.min((st.t - st.flapT) * 18, Math.PI)) * 0.9; // vingeslag rett etter et trykk
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.1, r * 0.35, r * 0.7, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(-r * 0.2, -r * 0.05); ctx.rotate(-0.4 - wing);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, 0, r * 0.7, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.3, r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f39c2c'; ctx.beginPath();
    ctx.moveTo(r * 0.95, -r * 0.05); ctx.lineTo(r * 1.55, r * 0.12); ctx.lineTo(r * 0.95, r * 0.32); ctx.closePath(); ctx.fill();
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
    if (test) delete window.__flakse;
    onExit(result);
  }

  // Start: fuglen svever til første trykk
  const msg = $('.fl-msg');
  msg.textContent = 'Trykk for å flakse!';
  $('.fl-text').textContent = '';
  $('.fl-pic').hidden = true;
  renderProgress();
  lyd.say(T.flapStart());
  raf = requestAnimationFrame(loop);
}
