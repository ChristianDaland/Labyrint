// Labyrinten: gå rundt i 3D og finn gull-egget. Dørene på veien åpnes med oppgaver fra læringsmotoren.
// En rev leter også: fanger den barnet, må det svare riktig på et revespørsmål for å komme fri, og så løper
// reven unna. Ingen kan tape: reven tar verken liv eller poeng, og feil svar gir bare «prøv igjen».
// Lastes inn i rommet (index.html), som deler ut gullegget når egget er funnet.

import { nextTask, recordAnswer } from '../kjerne/laering.js';
import { awardSkills, starsFor } from '../kjerne/belonning.js';
import { profileColor } from '../kjerne/lagring.js';
import { holdButton, keepAwake } from '../kjerne/ui.js';
import { T } from '../kjerne/tale.js';
import * as lyd from '../kjerne/lyd.js';
import { makeLevel, newFox, updateFox, releaseFox, bfs } from './labyrint-kart.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const SPEED = 2.4, TURN = 2.4, RADIUS = 0.22, WALL_H = 1.4, EYE = 0.62;
const FOX_HIT = 0.5;     // så nær må reven være for å fange
const SAFE_MS = 5000;    // trygg-tid etter at man har kommet fri
const FOX_HEAR = 7;      // hvor langt unna (ruter) man hører reven
const EGG_DIST = 0.55;

const ARROW = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

const CSS = `
  .lb { position: fixed; inset: 0; z-index: 5; display: flex; flex-direction: column; background: #2b1d14; color: #fff4dc;
    user-select: none; -webkit-user-select: none; font-family: 'Nunito', system-ui, sans-serif; }
  .lb-view { position: relative; flex: 1; min-height: 0; overflow: hidden; background: #0c1410; }
  .lb-view > canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .lb-hud { position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; gap: 10px;
    padding: 10px 12px; padding-top: max(10px, env(safe-area-inset-top)); z-index: 3; pointer-events: none; }
  .lb-hud > * { pointer-events: auto; }
  .lb-btn { width: 52px; height: 52px; border-radius: 50%; border: 0; font-size: 24px; background: rgba(0,0,0,.45);
    color: #fff4dc; display: grid; place-items: center; position: relative; touch-action: none; }
  .lb-btn.hold::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
    background: conic-gradient(#f2c14e calc(var(--p, 0) * 1turn), transparent 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px)); }
  .lb-mapbtn { font: 800 17px 'Nunito', sans-serif; color: #fff4dc; background: rgba(0,0,0,.45); border: 2px solid rgba(255,244,220,.35);
    border-radius: 99px; padding: 10px 16px; min-height: 48px; }
  .lb-mapbtn[aria-pressed="true"] { background: #f2c14e; color: #3b2805; border-color: #f2c14e; }
  .lb-doors { font: 400 22px 'Lilita One', sans-serif; background: rgba(0,0,0,.45); padding: 6px 12px; border-radius: 99px; }
  .lb-danger { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s; z-index: 2;
    box-shadow: inset 0 0 60px 20px rgba(226,102,42,.75); }
  .lb-flash { position: absolute; inset: 0; background: rgba(200,20,20,.55); opacity: 0; pointer-events: none; z-index: 2; }
  .lb-msg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3; pointer-events: none; text-align: center;
    font: 400 clamp(30px, 8vmin, 56px) 'Lilita One', sans-serif; color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.35), 0 0 24px rgba(0,0,0,.5);
    transition: opacity .4s; }
  .lb-msg.hidden { opacity: 0; }
  .lb-msg .stars { font-size: 1.3em; }
  .lb-pad { flex: 0 0 auto; height: max(200px, 30vh); display: flex; justify-content: space-between; align-items: center; gap: 16px;
    padding: 14px max(18px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
    background: linear-gradient(#5e3820, #3b2a1e); border-top: 3px solid #2b1d14; }
  .lb-cluster { display: flex; gap: 12px; }
  .lb-cluster.vert { flex-direction: column; }
  .lb-key { width: 86px; height: 86px; border-radius: 22px; border: 0; display: grid; place-items: center; background: #7a4b2a;
    box-shadow: 0 6px 0 #2b1d14; color: #fff4dc; touch-action: none; }
  .lb-cluster.vert .lb-key { height: 74px; }
  .lb-key svg { width: 40px; height: 40px; }
  .lb-key.on { transform: translateY(4px); box-shadow: 0 2px 0 #2b1d14; background: #9a6236; color: #f2c14e; }
  .lb-task { position: absolute; inset: 0; z-index: 6; display: flex; overflow-y: auto; padding: 20px;
    padding-top: max(20px, env(safe-area-inset-top)); background: rgba(30,20,12,.95); }
  .lb-task .card { margin: auto; width: min(460px, 100%); text-align: center; }
  .lb-head { margin: 0 auto 14px; padding: 8px 16px; border-radius: 99px; width: fit-content; max-width: 100%; font-weight: 800; font-size: 17px;
    background: rgba(192,138,74,.3); color: #f0d3a8; }
  .lb-head small { display: block; font-size: 15px; font-weight: 700; opacity: .85; }
  .lb-pic { font-size: clamp(64px, 18vmin, 120px); line-height: 1.1; white-space: pre-line; margin-bottom: 6px; }
  .lb-pic.rows { font-size: clamp(32px, 8vmin, 56px); }
  .lb-pic.letter { font: 400 clamp(72px, 20vmin, 120px) 'Lilita One', sans-serif; color: #f2c14e; }
  .lb-q { font-size: 26px; font-weight: 800; line-height: 1.25; white-space: pre-line; }
  .lb-speak { margin: 12px auto 16px; display: block; font-size: 30px; width: 64px; height: 64px; border-radius: 50%; border: 0;
    background: #5e3820; box-shadow: 0 4px 0 #2b1d14; }
  .lb-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .lb-opts.words { grid-template-columns: 1fr; }
  .lb-opts button { font: 400 34px 'Lilita One', sans-serif; min-height: 76px; padding: 8px; border: 0; border-radius: 18px;
    background: #fff4dc; color: #2a2418; box-shadow: 0 6px 0 #b3a98e; overflow-wrap: anywhere; }
  .lb-opts button.right { background: #4cc46a; color: #fff; box-shadow: 0 6px 0 #2d7f42; }
  .lb-opts button.wrong { background: #8a7a6a; color: #d9cfc2; box-shadow: none; opacity: .55; }
  .lb-feedback { min-height: 34px; margin-top: 14px; font-size: 22px; font-weight: 800; }
  .lb-close { margin-top: 8px; background: none; border: 0; color: #d6c2a4; font: 800 16px 'Nunito', sans-serif; text-decoration: underline; padding: 10px; }
  /* Revespørsmål: glødende oransje/rødt, så det ikke kan forveksles med en dør */
  .lb-task.fox { background: radial-gradient(circle at 50% 30%, rgba(170,62,18,.97), rgba(52,12,6,.98) 70%); }
  .lb-task.fox .lb-head { background: #ff8a3d; color: #3a1404; font-size: 22px; border-radius: 18px; padding: 10px 18px;
    box-shadow: 0 0 30px rgba(255,138,61,.6); animation: lbPulse 1.2s ease-in-out infinite; }
  .lb-task.fox .lb-speak { background: #7a2a10; box-shadow: 0 4px 0 #3a1004; }
  .lb-task.fox .lb-opts button:not(.right):not(.wrong) { background: #ffd2a8; color: #3a1404; box-shadow: 0 6px 0 #c06a2c; }
  .lb-task.fox .lb-close { display: none; }
  @keyframes lbPulse { 50% { transform: scale(1.04); } }
  @media (prefers-reduced-motion: reduce) { .lb-task.fox .lb-head { animation: none; } }
  .lb .hidden { display: none !important; }
`;

export default async function start({ root, profile, store, onExit }) {
  if (!document.getElementById('labyrint-css')) {
    const s = document.createElement('style'); s.id = 'labyrint-css'; s.textContent = CSS; document.head.append(s);
  }
  root.className = 'lb';
  root.innerHTML = `
    <div class="lb-view">
      <canvas class="lb-map hidden"></canvas>
      <div class="lb-danger"></div><div class="lb-flash"></div>
      <div class="lb-hud">
        <button class="lb-btn hold" data-exit aria-label="Tilbake til rommet (hold inne)">✕</button>
        <button class="lb-mapbtn" data-map aria-pressed="false">🗺️ Kart</button>
        <span class="lb-doors" aria-label="Dører åpnet"></span>
      </div>
      <div class="lb-msg">Laster …</div>
      <div class="lb-task hidden"><div class="card">
        <div class="lb-head"></div><div class="lb-pic"></div><div class="lb-q"></div>
        <button class="lb-speak" aria-label="Les opp igjen">🔊</button>
        <div class="lb-opts"></div><div class="lb-feedback"></div>
        <button class="lb-close">Gå bort fra døra</button>
      </div></div>
    </div>
    <div class="lb-pad">
      <div class="lb-cluster">
        <button class="lb-key" data-k="left" aria-label="Snu til venstre">${ARROW('M15 5l-7 7 7 7')}</button>
        <button class="lb-key" data-k="right" aria-label="Snu til høyre">${ARROW('M9 5l7 7-7 7')}</button>
      </div>
      <div class="lb-cluster vert">
        <button class="lb-key" data-k="up" aria-label="Gå fram">${ARROW('M5 15l7-7 7 7')}</button>
        <button class="lb-key" data-k="down" aria-label="Gå bakover">${ARROW('M5 9l7 7 7-7')}</button>
      </div>
    </div>`;
  const $ = s => root.querySelector(s);
  const view = $('.lb-view'), mapCv = $('.lb-map'), mctx = mapCv.getContext('2d'), msg = $('.lb-msg');
  const test = /(?:^|[#&])test(?:=(\w+))?/.exec(location.hash); // autopilot for automatiske tester: #test=riktig|feil
  let closed = false, raf = 0;

  let THREE;
  try { THREE = await import(THREE_URL); } catch { // uten nett: tilbake til rommet
    msg.textContent = 'Fikk ikke lastet labyrinten. Sjekk nettet.';
    setTimeout(() => { root.innerHTML = ''; root.className = ''; onExit(null); }, 3000);
    return;
  }

  // ─── Labyrint og tilstand ───────────────────────────────────────────
  const lvl = makeLevel(), grid = lvl.grid;
  const toEgg = bfs(grid, Math.floor(lvl.egg.x), Math.floor(lvl.egg.z)); // brukes av autopiloten
  const pos = { ...lvl.start };
  const input = { up: false, down: false, left: false, right: false };
  const fox = newFox(lvl.fox);
  const pending = new Map(); // dør → oppgave som ikke er besvart (samme oppgave igjen hvis man går bort og kommer tilbake)
  const st = { pos, fox, task: null, right: 0, total: 0, foxEscapes: 0, done: false, opened: 0, auto: test ? test[1] || 'riktig' : null };
  if (test) window.__labyrint = st;
  let safeUntil = performance.now() + 3000, dismissed = null, lastAsk = 0, walkPhase = 0, showMap = false;

  // ─── 3D-scene ───────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  view.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1410);
  scene.fog = new THREE.Fog(0x0c1410, 0.5, 8.5);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 40);
  scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x2a2018, 1.1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const torch = new THREE.PointLight(0xffd9a0, 3.5, 7, 1.2);
  scene.add(torch);

  function canvasTex(size, draw, repeat) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter; // litt retro, som de gamle 3D-spillene
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const brickTex = canvasTex(64, (g, s) => {
    g.fillStyle = '#2a1f19'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < s / 8; r++) for (let x = -16; x < s; x += 16) {
      g.fillStyle = `hsl(${14 + Math.random() * 12}, ${30 + Math.random() * 15}%, ${26 + Math.random() * 12}%)`;
      g.fillRect(x + (r % 2) * 8 + 1, r * 8 + 1, 14, 6);
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(40,70,30,${Math.random() * 0.35})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  });
  const doorTex = canvasTex(64, (g, s) => {
    for (let x = 0; x < s; x += 16) { g.fillStyle = `hsl(28, 45%, ${22 + Math.random() * 10}%)`; g.fillRect(x, 0, 16, s); g.fillStyle = '#2e1c0e'; g.fillRect(x, 0, 1, s); }
    g.fillStyle = '#3a2412'; g.fillRect(0, 8, s, 5); g.fillRect(0, s - 13, s, 5);
    g.fillStyle = '#f2c14e'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', s / 2, s / 2 + 2);
  });

  const W = grid.length;
  let wallCount = 0;
  for (const row of grid) for (const c of row) if (c) wallCount++;
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_H, 1), new THREE.MeshLambertMaterial({ map: brickTex }), wallCount);
  const m4 = new THREE.Matrix4();
  for (let z = 0, i = 0; z < W; z++) for (let x = 0; x < W; x++)
    if (grid[z][x]) { m4.makeTranslation(x + 0.5, WALL_H / 2, z + 0.5); walls.setMatrixAt(i++, m4); }
  scene.add(walls);
  const floorTex = canvasTex(32, (c, s) => {
    c.fillStyle = '#3b3a2c'; c.fillRect(0, 0, s, s);
    for (let k = 0; k < 90; k++) { c.fillStyle = `hsl(${60 + Math.random() * 40}, 18%, ${16 + Math.random() * 16}%)`; c.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
    c.strokeStyle = '#2a291f'; c.strokeRect(0.5, 0.5, s - 1, s - 1);
  }, [W, W]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, W / 2); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshLambertMaterial({ color: 0x15140f }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, WALL_H, W / 2); scene.add(ceil);

  // Dører på tvers av gangene (gangen går langs x når x er partall)
  const doorMat = new THREE.MeshLambertMaterial({ map: doorTex });
  const geoX = new THREE.BoxGeometry(0.14, WALL_H, 1), geoZ = new THREE.BoxGeometry(1, WALL_H, 0.14);
  const doors = lvl.doors.map(d => {
    const mesh = new THREE.Mesh(d.x % 2 === 0 ? geoX : geoZ, doorMat);
    mesh.position.set(d.x + 0.5, WALL_H / 2, d.z + 0.5); scene.add(mesh);
    return { ...d, open: false, lifting: false, mesh };
  });
  const doorAt = new Map(doors.map(d => [d.x + ',' + d.z, d]));

  // Gull-egget
  const eggGroup = new THREE.Group();
  const eggMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.45, roughness: 0.25, emissive: 0x8a5a00, emissiveIntensity: 0.7 }));
  eggMesh.scale.y = 1.3; eggGroup.add(eggMesh);
  const glow = new THREE.PointLight(0xffc040, 2.5, 3, 1.5); glow.position.y = 0.3; eggGroup.add(glow);
  eggGroup.position.set(lvl.egg.x, 0, lvl.egg.z); scene.add(eggGroup);

  // Reven (lavpolygon, lysende øyne)
  const foxGroup = new THREE.Group();
  {
    const orange = new THREE.MeshLambertMaterial({ color: 0xd8601f }), white = new THREE.MeshLambertMaterial({ color: 0xf4efe6 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2b1a12 }), eye = new THREE.MeshBasicMaterial({ color: 0xc8ff4a });
    const add = (geo, mat, x, y, z, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.z = rz; foxGroup.add(o); return o; };
    add(new THREE.BoxGeometry(0.5, 0.2, 0.22), orange, 0, 0.27, 0);
    add(new THREE.BoxGeometry(0.2, 0.18, 0.2), orange, 0.32, 0.36, 0);
    add(new THREE.ConeGeometry(0.07, 0.16, 6), white, 0.48, 0.33, 0, -Math.PI / 2);
    add(new THREE.SphereGeometry(0.025, 6, 6), dark, 0.56, 0.33, 0);
    add(new THREE.ConeGeometry(0.045, 0.11, 4), orange, 0.3, 0.5, 0.06);
    add(new THREE.ConeGeometry(0.045, 0.11, 4), orange, 0.3, 0.5, -0.06);
    add(new THREE.SphereGeometry(0.022, 6, 6), eye, 0.42, 0.4, 0.06);
    add(new THREE.SphereGeometry(0.022, 6, 6), eye, 0.42, 0.4, -0.06);
    add(new THREE.ConeGeometry(0.08, 0.34, 6), orange, -0.4, 0.32, 0, Math.PI / 2 + 0.3);
    add(new THREE.SphereGeometry(0.05, 6, 6), white, -0.57, 0.27, 0);
    foxGroup.userData.legs = [[0.18, 0.08], [0.18, -0.08], [-0.18, 0.08], [-0.18, -0.08]]
      .map(([x, z]) => add(new THREE.BoxGeometry(0.06, 0.18, 0.06), dark, x, 0.09, z));
  }
  scene.add(foxGroup);
  const foxView = { x: fox.x, z: fox.z, a: 0 }; // jevnt fulgt posisjon for tegning

  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    mapCv.width = w * dpr; mapCv.height = h * dpr;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(view);
  resize();

  // ─── Styring ────────────────────────────────────────────────────────
  root.querySelectorAll('.lb-key').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); input[k] = true; b.classList.add('on'); b.setPointerCapture?.(e.pointerId); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { input[k] = false; b.classList.remove('on'); });
  });
  const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const onKeyDown = e => { if (KEYS[e.code]) { input[KEYS[e.code]] = true; e.preventDefault(); } if (e.code === 'KeyM') setMap(!showMap); };
  const onKeyUp = e => { if (KEYS[e.code]) input[KEYS[e.code]] = false; };
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp);
  const releaseKeys = () => { for (const k in input) input[k] = false; root.querySelectorAll('.lb-key.on').forEach(b => b.classList.remove('on')); };

  function setMap(on) {
    showMap = on;
    mapCv.classList.toggle('hidden', !on);
    $('[data-map]').textContent = on ? '🧊 3D' : '🗺️ Kart';
    $('[data-map]').setAttribute('aria-pressed', on);
  }
  $('[data-map]').onclick = () => setMap(!showMap);
  holdButton($('[data-exit]'), 1000, () => close(null));

  const isWall = (x, z) => {
    const fx = Math.floor(x), fz = Math.floor(z), row = grid[fz];
    if (!row || row[fx] !== 0) return true;
    const d = doorAt.get(fx + ',' + fz);
    return !!d && !d.open;
  };
  const blocked = (x, z) => isWall(x - RADIUS, z - RADIUS) || isWall(x + RADIUS, z - RADIUS) || isWall(x - RADIUS, z + RADIUS) || isWall(x + RADIUS, z + RADIUS);

  function moveSelf(dt) {
    pos.a += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * TURN * dt;
    const f = (input.up ? 1 : 0) - (input.down ? 0.7 : 0);
    if (!f) return;
    const dx = Math.cos(pos.a) * f * SPEED * dt, dz = Math.sin(pos.a) * f * SPEED * dt;
    if (!blocked(pos.x + dx, pos.z)) pos.x += dx;
    if (!blocked(pos.x, pos.z + dz)) pos.z += dz;
    walkPhase += dt * 11;
  }

  // Lukket dør rett foran (nær nok og omtrent i synsretningen)
  function facingDoor() {
    for (const d of doors) {
      if (d.open) continue;
      const dx = d.x + 0.5 - pos.x, dz = d.z + 0.5 - pos.z, dist = Math.hypot(dx, dz);
      if (dist < 0.95 && (dx * Math.cos(pos.a) + dz * Math.sin(pos.a)) / dist > 0.5) return d;
    }
    return null;
  }

  function renderDoors() { $('.lb-doors').textContent = `🚪 ${st.opened}`; }

  // ─── Oppgaver: ved dørene og når reven har fanget barnet ────────────
  // Bare første forsøk teller. Feil svar: det svaret blir grått, og barnet prøver igjen.
  function openTask(kind, door) {
    let entry = kind === 'door' ? pending.get(door.id) : null;
    if (!entry) {
      entry = { task: nextTask(profile), first: true, disabled: new Set() };
      if (kind === 'door') pending.set(door.id, entry);
    }
    st.task = { kind, door, entry };
    releaseKeys();
    const t = entry.task, box = $('.lb-task');
    box.classList.toggle('fox', kind === 'fox');
    const head = $('.lb-head');
    head.textContent = kind === 'fox' ? '🦊 Reven har fanget deg!' : '🚪 Løs oppgaven for å åpne døra';
    if (kind === 'fox') { const sm = document.createElement('small'); sm.textContent = 'Svar riktig for å komme fri'; head.append(sm); }
    const pic = $('.lb-pic');
    pic.textContent = t.pic || ''; pic.hidden = !t.pic;
    pic.classList.toggle('letter', /^[A-ZÆØÅ]$/.test(t.pic || ''));
    pic.classList.toggle('rows', [...(t.pic || '')].length > 3);
    $('.lb-q').textContent = t.q;
    $('.lb-feedback').textContent = '';
    const opts = $('.lb-opts'); opts.innerHTML = '';
    opts.classList.toggle('words', t.options.some(o => o.length > 3));
    t.options.forEach((o, i) => {
      const b = document.createElement('button'); b.textContent = o;
      if (entry.disabled.has(i)) { b.classList.add('wrong'); b.disabled = true; }
      b.onclick = () => answer(i);
      opts.append(b);
    });
    box.classList.remove('hidden');
    lyd.say(kind === 'fox' ? [...T.foxCaught(), ...T.task(t)] : T.task(t));
    lyd.prefetch(T.tryAgain(), T.right(), T.foxFree());
  }

  function answer(i) {
    const task = st.task;
    if (!task || task.answered) return;
    const e = task.entry, t = e.task, correct = i === t.answer, btn = $('.lb-opts').children[i];
    if (e.first) {
      e.first = false; st.total++;
      if (correct) st.right++;
      awardSkills(profile, recordAnswer(profile, t.skill, correct));
      store.save();
    }
    if (correct) {
      task.answered = true;
      btn.classList.add('right');
      for (const b of $('.lb-opts').children) b.disabled = true;
      lyd.pling();
      if (task.kind === 'door') {
        $('.lb-feedback').textContent = 'Riktig! Døra åpnes 🎉';
        lyd.say(T.right());
        pending.delete(task.door.id);
        task.door.open = true; task.door.lifting = true; st.opened++; renderDoors();
        lyd.creak();
      } else {
        $('.lb-feedback').textContent = 'Riktig! Du er fri. Løp! 🏃';
        lyd.say(T.foxFree());
        releaseFox(grid, fox, pos);
        safeUntil = performance.now() + SAFE_MS;
        st.foxEscapes++;
      }
      setTimeout(() => { if (st.task === task) closeTask(); }, 1200);
    } else {
      e.disabled.add(i);
      btn.classList.add('wrong'); btn.disabled = true;
      $('.lb-feedback').textContent = 'Ikke helt. Prøv igjen!';
      lyd.oops(); lyd.say(T.tryAgain());
    }
  }

  function closeTask() {
    st.task = null;
    $('.lb-task').classList.add('hidden');
  }
  $('.lb-close').onclick = () => { // bare ved dører: gå bort og prøv en annen vei
    if (st.task?.kind !== 'door') return;
    dismissed = st.task.door;
    lyd.stopSpeaking();
    closeTask();
  };
  $('.lb-speak').onclick = () => st.task && lyd.say(T.task(st.task.entry.task));

  function caught() {
    fox.holding = true; fox.chasing = false;
    const fl = $('.lb-flash'); fl.style.transition = 'none'; fl.style.opacity = 1;
    requestAnimationFrame(() => { fl.style.transition = 'opacity .8s'; fl.style.opacity = 0; });
    navigator.vibrate?.(300);
    lyd.bark(1);
    openTask('fox');
  }

  function foundEgg() {
    st.done = true;
    closeTask(); releaseKeys();
    const n = starsFor(st.right, Math.max(st.total, 1));
    msg.innerHTML = `Du fant gull-egget!<div class="stars">${'⭐'.repeat(n)}</div>`;
    msg.classList.remove('hidden');
    lyd.fanfare();
    lyd.say([...T.foundEgg(), ...T.roundDone(n)]);
    setTimeout(() => close({ game: 'labyrint', right: st.right, total: Math.max(st.total, 1), foxEscapes: st.foxEscapes }), 4500);
  }

  // ─── Revelyd: knurring som blir sterkere jo nærmere, fra den siden reven er på ──
  let growl = null, nextBark = 0;
  function foxSound(d, t) {
    let vol = 0, pan = 0;
    if (!st.task && !st.done && d < FOX_HEAR && !fox.holding) {
      vol = (1 - d / FOX_HEAR) ** 1.5 * (fox.chasing ? 1 : 0.4);
      pan = Math.sin(Math.atan2(fox.z - pos.z, fox.x - pos.x) - pos.a) * 0.8;
    }
    if (!growl && vol > 0) growl = lyd.makeGrowl();
    growl?.set(vol, pan);
    if (fox.chasing && vol > 0.15 && t > nextBark) { lyd.bark(vol, pan); nextBark = t + 1800 + Math.random() * 1800; }
  }

  // ─── Kart ovenfra ───────────────────────────────────────────────────
  const color = profileColor(profile);
  function drawMap(t) {
    const dpr = mapCv.width / Math.max(view.clientWidth, 1), top = 76 * dpr, side = 10 * dpr;
    const cell = Math.min((mapCv.width - 2 * side) / W, (mapCv.height - top - side) / W);
    const ox = (mapCv.width - cell * W) / 2, oy = top + (mapCv.height - top - side - cell * W) / 2;
    const P = (x, z) => [ox + x * cell, oy + z * cell];
    mctx.fillStyle = '#2b1d14'; mctx.fillRect(0, 0, mapCv.width, mapCv.height);
    mctx.fillStyle = '#2a3a2e'; mctx.fillRect(ox, oy, cell * W, cell * W);
    mctx.fillStyle = '#5a3d2c';
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) if (grid[z][x]) mctx.fillRect(ox + x * cell - 0.5, oy + z * cell - 0.5, cell + 1, cell + 1);
    mctx.fillStyle = '#c08a4a';
    const th = Math.max(2, cell * 0.25);
    for (const d of doors) {
      if (d.open) continue;
      const [x, z] = P(d.x, d.z);
      if (d.x % 2 === 0) mctx.fillRect(x + (cell - th) / 2, z, th, cell); else mctx.fillRect(x, z + (cell - th) / 2, cell, th);
    }
    const [ex, ez] = P(lvl.egg.x, lvl.egg.z), r = cell * (1.2 + Math.sin(t / 300) * 0.15);
    const gr = mctx.createRadialGradient(ex, ez, 0, ex, ez, r);
    gr.addColorStop(0, 'rgba(242,193,78,.7)'); gr.addColorStop(1, 'rgba(242,193,78,0)');
    mctx.fillStyle = gr; mctx.beginPath(); mctx.arc(ex, ez, r, 0, 7); mctx.fill();
    mctx.fillStyle = '#ffd24a'; mctx.beginPath(); mctx.ellipse(ex, ez, cell * .22, cell * .3, 0, 0, 7); mctx.fill();
    const [fx, fz] = P(foxView.x, foxView.z);
    if (fox.chasing) {
      mctx.strokeStyle = 'rgba(255,70,40,.9)'; mctx.lineWidth = Math.max(2, cell * .1);
      mctx.beginPath(); mctx.arc(fx, fz, cell * (.6 + Math.sin(t / 120) * .08), 0, 7); mctx.stroke();
    }
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.font = `${cell * 0.95}px sans-serif`; mctx.fillText('🦊', fx, fz);
    const [px, pz] = P(pos.x, pos.z);
    mctx.save(); mctx.translate(px, pz); mctx.rotate(pos.a);
    mctx.fillStyle = color; mctx.strokeStyle = '#fff'; mctx.lineWidth = Math.max(1.5, cell * .08);
    mctx.beginPath(); mctx.moveTo(cell * .5, 0); mctx.lineTo(-cell * .3, cell * .3); mctx.lineTo(-cell * .15, 0);
    mctx.lineTo(-cell * .3, -cell * .3); mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  // ─── Autopilot for automatiske tester (#test=riktig|feil) ───────────
  let autoWait = false;
  function autopilot() {
    if (st.task) {
      if (autoWait || st.task.answered) return;
      autoWait = true;
      setTimeout(() => {
        autoWait = false;
        if (!st.task) return;
        const t = st.task.entry.task, wrong = [0, 1, 2].find(i => i !== t.answer && !st.task.entry.disabled.has(i));
        answer(st.auto === 'feil' && wrong !== undefined ? wrong : t.answer);
      }, 500);
      return;
    }
    const cx = Math.floor(pos.x), cz = Math.floor(pos.z), here = toEgg[cz][cx];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => toEgg[cz + dz]?.[cx + dx] === here - 1);
    if (!next) return;
    // Gå mot midten av ruta først hvis vi skal svinge, så vi ikke henger fast i hjørnet
    const off = next[0] ? Math.abs(pos.z - (cz + 0.5)) : Math.abs(pos.x - (cx + 0.5));
    const tx = off > 0.12 ? cx + 0.5 : cx + next[0] + 0.5, tz = off > 0.12 ? cz + 0.5 : cz + next[1] + 0.5;
    pos.a = Math.atan2(tz - pos.z, tx - pos.x);
    input.up = true;
  }

  // ─── Løkke ──────────────────────────────────────────────────────────
  const sideways = matchMedia('(orientation: landscape) and (pointer: coarse)');
  const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  let last = performance.now(), paused = false;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (paused || sideways.matches) { growl?.set(0); return; }
    if (st.auto && !st.done) autopilot();
    if (!st.task && !st.done) {
      moveSelf(dt);
      if (dismissed && Math.hypot(dismissed.x + 0.5 - pos.x, dismissed.z + 0.5 - pos.z) > 1.3) dismissed = null;
      const d = facingDoor();
      if (d && d !== dismissed && now - lastAsk > 800) { lastAsk = now; openTask('door', d); }
    }
    for (const d of doors) if (d.lifting) {
      d.mesh.position.y += dt * 1.6;
      if (d.mesh.position.y > WALL_H * 1.5) { d.lifting = false; d.mesh.visible = false; }
    }
    // Reven jager bare når barnet ikke er trygt (oppgave åpen eller nettopp sluppet fri)
    const safe = !!st.task || st.done || now < safeUntil;
    if (!st.done) updateFox(grid, fox, dt, safe ? null : { cx: Math.floor(pos.x), cz: Math.floor(pos.z) }, now);
    const fd = Math.hypot(fox.x - pos.x, fox.z - pos.z);
    if (!safe && !fox.holding && !fox.flee && fd < FOX_HIT) caught();
    if (!st.done && Math.hypot(pos.x - lvl.egg.x, pos.z - lvl.egg.z) < EGG_DIST) foundEgg();

    const k = 1 - Math.exp(-dt * 14);
    foxView.x += (fox.x - foxView.x) * k; foxView.z += (fox.z - foxView.z) * k; foxView.a = lerpAngle(foxView.a, fox.a, k);
    foxGroup.position.set(foxView.x, 0, foxView.z); foxGroup.rotation.y = -foxView.a;
    const run = fox.holding ? 0 : Math.sin(now / (fox.chasing ? 50 : 80));
    foxGroup.userData.legs.forEach((l, i) => { l.rotation.z = run * 0.6 * (i % 2 ? 1 : -1); });
    $('.lb-danger').style.opacity = fox.chasing && fd < 5 && !safe ? (1 - fd / 5).toFixed(2) : 0;
    foxSound(fd, now);

    eggMesh.position.y = 0.3 + Math.sin(now / 400) * 0.05; eggMesh.rotation.y = now / 700;
    const moving = input.up || input.down;
    camera.position.set(pos.x, EYE + (moving ? Math.sin(walkPhase) * 0.025 : 0), pos.z);
    camera.rotation.y = -pos.a - Math.PI / 2;
    torch.position.copy(camera.position);
    if (showMap) drawMap(now); else renderer.render(scene, camera);
  }
  const onVis = () => { paused = document.visibilityState === 'hidden'; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  let wake = null;
  keepAwake().then(w => { wake = w; });

  function close(result) {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp);
    document.removeEventListener('visibilitychange', onVis);
    wake?.release?.();
    growl?.stop();
    lyd.stopSpeaking();
    scene?.traverse(o => { o.geometry?.dispose(); for (const mm of [].concat(o.material || [])) { mm.map?.dispose(); mm.dispose(); } });
    renderer?.dispose();
    root.innerHTML = ''; root.className = '';
    if (test) delete window.__labyrint;
    onExit(result);
  }

  // Start
  renderDoors();
  msg.textContent = 'Finn gull-egget!';
  setTimeout(() => msg.classList.add('hidden'), 2500);
  lyd.say(T.mazeStart());
  raf = requestAnimationFrame(loop);
}
