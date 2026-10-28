'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { makeTask, GRADES, SUBJECTS } = require('./tasks');

const PORT = process.env.PORT || 3000;
const HOST_KEY = process.env.HOST_KEY || ''; // hvis satt må storskjermen åpnes med /?key=<HOST_KEY>

// ─── Justerbare innstillinger ───────────────────────────────────────────
const CONFIG = {
  playerSpeed: 2.4,       // ruter per sekund (samme verdi står i play.html)
  pickupDist: 0.55,       // hvor nær egget man må være
  pointsPerStep: 1,       // poeng for hver ny rute man går på (ikke for å gå fram og tilbake)
  pointsPerTask: 10,      // poeng for en løst oppgave
  pointsForEgg: 25,       // ekstra poeng til den som finner egget
  foxTaskPoints: 5,       // poeng for å svare riktig og komme fri fra reven (mindre enn en dør)
  foxHitDist: 0.5,        // hvor nær en rev må være for å ta deg
  invulnMs: 5000,         // trygg-tid etter at man har kommet fri fra reven
  foxRetreatCells: 10,    // reven løper så mange ruter unna (langs gangene) når man har kommet fri
  foxFleeSpeed: 2.6,      // revens fart når den løper unna (litt raskere enn spilleren)
  foxFleeMaxMs: 6000,     // ... men aldri lenger enn dette
  foxes: 1,               // antall rever
  pathDoors: { liten: 6, middels: 9, stor: 12 }, // dører jevnt fordelt på veien fra start til egget
  sideDoorShare: 0.04,    // andel av de andre gangene som også får en dør
  doorReach: 1.4,         // hvor nær døra man må være for å få en oppgave
  wrongWaitMs: 3000,      // ventetid etter feil svar før man får en ny oppgave
  safeWhileSolving: true, // true: reven kan ikke ta deg mens du løser en oppgave
  foxWanderSpeed: 1.3,    // revens fart når den leter
  foxChaseSpeed: 2.0,     // revens fart når den jager (litt tregere enn spilleren)
  foxSightCells: 7,       // hvor langt en rev ser langs en korridor
  foxCanWin: true,        // true: revene vinner hvis en rev finner egget først
  foxEggDelaySec: 60,     // revene begynner å lete etter egget først etter så mange sekunder
  extraOpenings: 0.08,    // ekstra åpninger (sløyfer å rømme rundt), men aldri forbi en dør på veien til egget
  emptyLobbyMs: 60000,    // tilbake til lobbyen hvis ingen spillere er tilkoblet så lenge
  maxCustomTasks: 300,    // maks antall egne oppgaver i et sett
  tickHz: 20,
};
const STANDARD = [...SUBJECTS, 'ingen']; // 'ingen' = bare egne oppgaver
const SIZES = { liten: 8, middels: 12, stor: 16 };
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#911eb4', '#42d4f4', '#f032e6',
  '#bfef45', '#fabed4', '#469990', '#dcbeff', '#ffe119', '#aaffc3', '#ffffff', '#a9a9ff'];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ─── Web og sanntid ─────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/play', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/veiledning', (req, res) => res.sendFile(path.join(__dirname, 'public', 'veiledning.html')));
app.get('/health', (req, res) => res.send('ok'));
app.get('/qr.png', async (req, res) => {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  const url = `${proto}://${req.headers.host}/play`;
  res.type('png').set('Cache-Control', 'no-store');
  res.send(await QRCode.toBuffer(url, { width: 600, margin: 1 }));
});

// ─── Spilltilstand ──────────────────────────────────────────────────────
const players = new Map(); // nøkkel -> spiller
const game = {
  phase: 'lobby', // lobby | playing | ended
  settings: { size: 'middels', grade: 1, subject: 'begge', customName: '', customCount: 0 },
  customTasks: [], // egne oppgaver fra storskjermen; sendes aldri ut med fasit
  grid: null, start: null, egg: null, foxes: [], doors: [], doorAt: new Map(), result: null,
  round: 0, startedAt: 0, endedAt: 0, emptySince: 0,
};

const rand = n => Math.floor(Math.random() * n);
const pick = arr => arr[rand(arr.length)];
const r3 = v => Math.round(v * 1000) / 1000;

function generateMaze(cols, rows) {
  const W = cols * 2 + 1, H = rows * 2 + 1;
  const g = Array.from({ length: H }, () => Array(W).fill(1));
  const seen = new Set(['0,0']);
  const stack = [[0, 0]];
  g[1][1] = 0;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = DIRS.filter(([dx, dy]) => {
      const nx = cx + dx, ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen.has(nx + ',' + ny);
    });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = pick(opts);
    const nx = cx + dx, ny = cy + dy;
    g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
    g[ny * 2 + 1][nx * 2 + 1] = 0;
    seen.add(nx + ',' + ny);
    stack.push([nx, ny]);
  }
  return g; // perfekt labyrint: nøyaktig én vei mellom to ruter
}

// Ekstra åpninger gir sløyfer å rømme rundt, men bare der de ikke lager en vei rundt
// noen av dørene på veien til egget (hver av dem må fortsatt være eneste vei fram).
function addLoops(g, pathDoors, egg, count) {
  const W = g[0].length, H = g.length;
  const doorsNeeded = () => pathDoors.every(d => {
    g[d.z][d.x] = 1;
    const reach = bfs(g, 1, 1)[egg.z][egg.x] >= 0;
    g[d.z][d.x] = 0;
    return !reach;
  });
  for (let i = 0, tries = 0; i < count && tries < 400; tries++) {
    const x = 1 + rand(W - 2), z = 1 + rand(H - 2);
    if ((x % 2) === (z % 2) || g[z][x] !== 1) continue; // bare vegger mellom to celler
    g[z][x] = 0;
    if (doorsNeeded()) i++; else g[z][x] = 1;
  }
}

// Korteste vei fra start til (x, z), gitt avstandene fra bfs()
function pathTo(dist, x, z) {
  const path = [[x, z]];
  while (dist[z][x] > 0) {
    const [dx, dz] = DIRS.find(([dx, dz]) => dist[z + dz][x + dx] === dist[z][x] - 1);
    x += dx; z += dz;
    path.push([x, z]);
  }
  return path.reverse();
}

function bfs(grid, sx, sz) {
  const dist = grid.map(row => row.map(() => -1));
  const q = [[sx, sz]];
  dist[sz][sx] = 0;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i];
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (grid[nz][nx] === 0 && dist[nz][nx] < 0) { dist[nz][nx] = dist[z][x] + 1; q.push([nx, nz]); }
    }
  }
  return dist;
}

function isWallAt(x, z) {
  const row = game.grid && game.grid[Math.floor(z)];
  return !row || row[Math.floor(x)] !== 0;
}

// Dørene er personlige: en dør er bare åpen for den som har løst oppgaven
function closedDoorAt(p, x, z) {
  const id = game.doorAt.get(Math.floor(x) + ',' + Math.floor(z));
  return id !== undefined && !p.opened.has(id);
}
const isSafe = p => CONFIG.safeWhileSolving && !!p.task;

// Neste oppgave til en spiller: egne oppgaver (halvparten av gangene hvis standard også er valgt)
// trekkes fra en stokket bunke per spiller, så alle oppgavene kommer før noen gjentas.
function nextTask(p) {
  const custom = game.customTasks, std = game.settings.subject;
  if (custom.length && (std === 'ingen' || Math.random() < 0.5)) {
    if (!p.bag || !p.bag.length) p.bag = custom.map((_, i) => i).sort(() => Math.random() - 0.5);
    const t = custom[p.bag.pop()];
    const options = [t.right, ...t.wrong].sort(() => Math.random() - 0.5);
    return { q: t.q, pic: t.pic || null, options, answer: options.indexOf(t.right), speak: t.q };
  }
  return makeTask(game.settings.grade, std === 'ingen' ? 'begge' : std);
}

function nextColor() {
  const used = new Set([...players.values()].map(p => p.color));
  return COLORS.find(c => !used.has(c)) || COLORS[rand(COLORS.length)];
}

function publicPlayer(p) {
  return { id: p.pid, name: p.name, color: p.color, x: r3(p.x), z: r3(p.z), a: r3(p.a),
    score: p.score, inv: Date.now() < p.invulnUntil, doors: p.solved, task: !!p.task, caught: !!p.caughtBy };
}

const scoreboard = () => [...players.values()]
  .map(p => ({ id: p.pid, name: p.name, color: p.color, score: p.score, doors: p.solved }))
  .sort((a, b) => b.score - a.score);

function lobbyPayload() {
  return { phase: game.phase, settings: game.settings,
    players: [...players.values()].map(p => ({ id: p.pid, name: p.name, color: p.color, online: p.connected })) };
}
const broadcastLobby = () => io.emit('lobby', lobbyPayload());
const addEvent = text => io.to('hosts').emit('event', { text, t: Date.now() });

function baseGame() {
  return { phase: game.phase, grid: game.grid, start: game.start,
    egg: game.egg && { x: game.egg.x, z: game.egg.z }, result: game.result,
    doors: game.doors,
    round: game.round, elapsed: (game.endedAt || Date.now()) - game.startedAt };
}

function sendGameTo(p) {
  if (!p.connected) return;
  io.to(p.socketId).emit('game', { ...baseGame(),
    you: { x: p.x, z: p.z, a: p.a, s: p.spawnId, score: p.score, opened: [...p.opened] } });
}

function resetPlayer(p) {
  p.x = game.start.x; p.z = game.start.z; p.a = game.start.a; p.spawnId++;
  p.score = 0; p.visited = new Set([Math.floor(p.x) + ',' + Math.floor(p.z)]);
  p.opened = new Set(); p.solved = 0; p.task = null; p.cooldownUntil = 0; p.bag = null; p.caughtBy = null;
  p.invulnUntil = Date.now() + 1500; p.lastPosT = Date.now();
}

function startGame() {
  const n = SIZES[game.settings.size] || 12;
  const grid = generateMaze(n, n);
  let dist = bfs(grid, 1, 1);
  let max = 0;
  for (let z = 1; z < grid.length; z += 2) for (let x = 1; x < grid[0].length; x += 2) max = Math.max(max, dist[z][x]);
  const farCells = [];
  for (let z = 1; z < grid.length; z += 2)
    for (let x = 1; x < grid[0].length; x += 2) if (dist[z][x] >= max * 0.6) farCells.push({ x, z });
  const eggCell = pick(farCells);

  // Dørene settes jevnt fordelt langs den eneste veien til egget, så man må gjennom alle.
  // Gangene ligger på oddetallsplassene i veien (rute, gang, rute, …).
  const route = pathTo(dist, eggCell.x, eggCell.z), L = route.length - 1;
  const count = Math.max(1, Math.min(CONFIG.pathDoors[game.settings.size] || 9, Math.floor(L / 4)));
  const onPath = new Set();
  for (let k = 1; k <= count; k++) {
    let i = Math.round(k * L / (count + 1));
    if (i % 2 === 0) i++;
    if (i < L) onPath.add(route[i].join(','));
  }
  const pathDoors = [...onPath].map(s => { const [x, z] = s.split(',').map(Number); return { x, z }; });
  addLoops(grid, pathDoors, eggCell, Math.floor(n * n * CONFIG.extraOpenings));

  // Noen dører i sidegangene også
  const passages = [];
  for (let z = 1; z < grid.length - 1; z++)
    for (let x = 1; x < grid[0].length - 1; x++)
      if (grid[z][x] === 0 && (x % 2) !== (z % 2) && !onPath.has(x + ',' + z)) passages.push({ x, z });
  passages.sort(() => Math.random() - 0.5);
  const sideDoors = passages.slice(0, Math.round(passages.length * CONFIG.sideDoorShare));
  game.doors = [...pathDoors, ...sideDoors].map((c, id) => ({ id, x: c.x, z: c.z }));
  game.doorAt = new Map(game.doors.map(d => [d.x + ',' + d.z, d.id]));

  // Reven plasseres langt fra både start og egg (i den ferdige labyrinten)
  dist = bfs(grid, 1, 1);
  const cells = [];
  for (let z = 1; z < grid.length; z += 2) for (let x = 1; x < grid[0].length; x += 2) cells.push({ x, z, d: dist[z][x] });
  max = Math.max(...cells.map(c => c.d));
  const eggDist = bfs(grid, eggCell.x, eggCell.z);
  let maxEgg = 0;
  for (const c of cells) maxEgg = Math.max(maxEgg, eggDist[c.z][c.x]);
  const foxCells = cells.filter(c => c.d >= max * 0.35 && eggDist[c.z][c.x] >= maxEgg * 0.35)
    .sort(() => Math.random() - 0.5);
  const chosen = [];
  for (const c of foxCells) {
    if (chosen.length >= CONFIG.foxes) break;
    if (chosen.every(o => Math.abs(o.x - c.x) + Math.abs(o.z - c.z) > 6)) chosen.push(c);
  }
  for (const c of foxCells) { if (chosen.length >= CONFIG.foxes) break; if (!chosen.includes(c)) chosen.push(c); }

  game.grid = grid;
  game.start = { x: 1.5, z: 1.5, a: grid[1][2] === 0 ? 0 : Math.PI / 2 };
  game.egg = { x: eggCell.x + 0.5, z: eggCell.z + 0.5, cx: eggCell.x, cz: eggCell.z };
  game.foxes = chosen.map(c => ({ x: c.x + 0.5, z: c.z + 0.5, a: 0, cx: c.x, cz: c.z, tx: c.x, tz: c.z,
    px: -1, pz: -1, chasing: false, flee: null }));
  game.phase = 'playing';
  game.result = null;
  game.round++;
  game.startedAt = Date.now(); game.endedAt = 0; game.emptySince = 0;

  for (const [key, p] of players) { if (!p.connected) players.delete(key); else resetPlayer(p); }
  io.to('hosts').emit('game', baseGame());
  for (const p of players.values()) sendGameTo(p);
  broadcastLobby();
  addEvent('Runden har startet. Finn gull-egget!');
}

function endGame(result) {
  game.phase = 'ended';
  game.result = result;
  game.endedAt = Date.now();
  result.scores = scoreboard();
  io.emit('end', result);
  broadcastLobby();
  if (result.type === 'player') addEvent(`🏆 ${result.name} fant gull-egget!`);
  else addEvent('🦊 Reven fant gull-egget først!');
}

function toLobby() {
  game.phase = 'lobby';
  game.grid = null; game.egg = null; game.foxes = []; game.doors = []; game.doorAt = new Map(); game.result = null;
  for (const [key, p] of players) if (!p.connected) players.delete(key);
  broadcastLobby();
}

// ─── Revene ─────────────────────────────────────────────────────────────
function lookAlong(f, dx, dz, maxCells, targets) {
  let x = f.cx, z = f.cz;
  for (let i = 1; i <= maxCells; i++) {
    x += dx; z += dz;
    if (game.grid[z][x] !== 0) return null;
    if (targets.some(t => t.cx === x && t.cz === z)) return i;
  }
  return null;
}

function chooseNext(f, now) {
  const g = game.grid;
  const open = DIRS.filter(([dx, dz]) => g[f.cz + dz][f.cx + dx] === 0);
  if (f.flee) { // løper mot fluktmålet (se releasePlayer), ett steg nærmere hver gang
    const here = f.flee.to[f.cz][f.cx];
    const next = open.find(([dx, dz]) => f.flee.to[f.cz + dz][f.cx + dx] === here - 1);
    if (here > 0 && next && now < f.flee.until) {
      f.tx = f.cx + next[0]; f.tz = f.cz + next[1];
      return;
    }
    f.flee = null;
  }
  const prey = [...players.values()]
    .filter(p => p.connected && now >= p.invulnUntil && !isSafe(p))
    .map(p => ({ cx: Math.floor(p.x), cz: Math.floor(p.z) }));

  let dir = null, best = Infinity;
  for (const d of open) {
    const i = lookAlong(f, d[0], d[1], CONFIG.foxSightCells, prey);
    if (i !== null && i < best) { best = i; dir = d; }
  }
  f.chasing = !!dir;
  const eggHunt = now - game.startedAt > CONFIG.foxEggDelaySec * 1000;
  if (!dir && eggHunt) { // ser reven egget? da går den mot det
    const egg = [{ cx: game.egg.cx, cz: game.egg.cz }];
    dir = open.find(d => lookAlong(f, d[0], d[1], CONFIG.foxSightCells, egg) !== null) || null;
  }
  if (!dir) { // ellers: let videre, helst uten å snu
    let opts = open.filter(([dx, dz]) => !(f.cx + dx === f.px && f.cz + dz === f.pz));
    if (!opts.length) opts = open;
    dir = opts.length ? pick(opts) : null;
  }
  if (!dir) { f.tx = f.cx; f.tz = f.cz; return; }
  f.tx = f.cx + dir[0]; f.tz = f.cz + dir[1];
}

function updateFox(f, dt, now) {
  if (f.holding) return; // holder noen fast
  let step = (f.flee ? CONFIG.foxFleeSpeed : f.chasing ? CONFIG.foxChaseSpeed : CONFIG.foxWanderSpeed) * dt;
  for (let guard = 0; guard < 4 && step > 0; guard++) {
    const tx = f.tx + 0.5, tz = f.tz + 0.5;
    const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
    if (d > 1e-6) f.a = Math.atan2(dz, dx);
    if (d <= step) {
      f.x = tx; f.z = tz; step -= d;
      if (f.tx !== f.cx || f.tz !== f.cz) { f.px = f.cx; f.pz = f.cz; f.cx = f.tx; f.cz = f.tz; }
      chooseNext(f, now);
      if (f.tx === f.cx && f.tz === f.cz) break;
    } else {
      f.x += dx / d * step; f.z += dz / d * step; step = 0;
    }
  }
}

function sendTask(p) {
  if (!p.connected || !p.task || p.task.answer === undefined) return;
  const { answer, ...t } = p.task; // fasiten blir på serveren
  io.to(p.socketId).emit('task', t);
}

// Reven tar verken liv eller poeng: den holder spilleren fast til hen svarer riktig på et revespørsmål
function catchPlayer(p, f) {
  p.caughtBy = f; f.holding = p; f.chasing = false;
  p.task = { kind: 'fox', ...nextTask(p) };
  sendTask(p);
  addEvent(`🦊 Reven fanget ${p.name}`);
}

// Fri igjen: spilleren er trygg en stund, og reven løper et godt stykke unna før den leter videre
function releasePlayer(p, now) {
  const f = p.caughtBy;
  p.caughtBy = null; p.task = null;
  p.invulnUntil = now + CONFIG.invulnMs;
  if (!f) return;
  f.holding = null; f.chasing = false;
  // Fluktmål ca. foxRetreatCells ruter unna langs gangene. Bare mål der reven ligger på korteste vei
  // fra spilleren dit, så hele flukten går bort fra spilleren (aldri forbi). Finnes ingen så langt unna
  // (reven står i en sidegang), løper den så langt den kommer.
  const g = game.grid, fromP = bfs(g, Math.floor(p.x), Math.floor(p.z)), fromF = bfs(g, f.cx, f.cz);
  const df = fromP[f.cz][f.cx], R = CONFIG.foxRetreatCells, near = [];
  let deepest = null;
  for (let z = 1; z < g.length - 1; z++) for (let x = 1; x < g[0].length - 1; x++) {
    if (g[z][x] !== 0 || fromF[z][x] !== fromP[z][x] - df) continue;
    if (fromP[z][x] >= R && fromP[z][x] <= R + 4) near.push({ x, z });
    if (!deepest || fromP[z][x] > fromP[deepest.z][deepest.x]) deepest = { x, z };
  }
  const goal = near.length ? pick(near) : deepest;
  f.flee = { to: bfs(g, goal.x, goal.z), until: now + CONFIG.foxFleeMaxMs };
  if (f.flee.to[f.tz][f.tx] >= f.flee.to[f.cz][f.cx]) { f.tx = f.cx; f.tz = f.cz; } // ikke fortsett mot spilleren
}

let lastTick = Date.now();
function tick() {
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 0.2);
  lastTick = now;
  if (game.phase !== 'playing') return;

  for (const f of game.foxes) updateFox(f, dt, now);

  const online = [...players.values()].filter(p => p.connected);
  for (const p of online) {
    if (Math.hypot(p.x - game.egg.x, p.z - game.egg.z) < CONFIG.pickupDist) {
      p.score += CONFIG.pointsForEgg;
      return endGame({ type: 'player', id: p.pid, name: p.name, color: p.color });
    }
    if (now < p.invulnUntil || isSafe(p)) continue;
    const f = game.foxes.find(f => !f.holding && !f.flee && Math.hypot(p.x - f.x, p.z - f.z) < CONFIG.foxHitDist);
    if (f) catchPlayer(p, f);
  }
  if (CONFIG.foxCanWin && now - game.startedAt > CONFIG.foxEggDelaySec * 1000 && game.foxes.some(f => f.cx === game.egg.cx && f.cz === game.egg.cz))
    return endGame({ type: 'fox' });
  if (!online.length) { // alle har koblet fra: ikke la runden gå i det uendelige
    if (!game.emptySince) game.emptySince = now;
    else if (now - game.emptySince > CONFIG.emptyLobbyMs) {
      addEvent('Ingen spillere igjen, tilbake til lobbyen');
      return toLobby();
    }
  } else game.emptySince = 0;

  io.emit('state', {
    players: online.map(publicPlayer),
    foxes: game.foxes.map(f => ({ x: r3(f.x), z: r3(f.z), a: r3(f.a), c: f.chasing ? 1 : 0 })),
  });
}
setInterval(tick, 1000 / CONFIG.tickHz);

// ─── Tilkoblinger ───────────────────────────────────────────────────────
io.on('connection', socket => {
  let me = null;
  const isHost = () => socket.rooms.has('hosts');

  socket.on('host', d => {
    if (HOST_KEY && d?.key !== HOST_KEY) return socket.emit('hostDenied');
    socket.join('hosts');
    socket.emit('lobby', lobbyPayload());
    if (game.grid) socket.emit('game', baseGame());
  });

  socket.on('join', (d = {}) => {
    const key = typeof d.key === 'string' && d.key.length >= 8 && d.key.length <= 64 ? d.key : crypto.randomUUID();
    const name = String(d.name || '').trim().slice(0, 14) || 'Spiller';
    let p = players.get(key);
    if (!p) {
      p = { key, pid: crypto.randomBytes(4).toString('hex'), name, color: nextColor(),
        x: 0, z: 0, a: 0, spawnId: 0, invulnUntil: 0, lastPosT: 0, score: 0, visited: new Set(),
        opened: new Set(), solved: 0, task: null, cooldownUntil: 0 };
      players.set(key, p);
      if (game.grid) { resetPlayer(p); if (game.phase === 'playing') addEvent(`${name} ble med`); }
    } else {
      p.name = name;
    }
    p.connected = true;
    p.socketId = socket.id;
    me = p;
    socket.emit('joined', { id: p.pid, key, name: p.name, color: p.color });
    if (game.grid) sendGameTo(p);
    broadcastLobby();
  });

  socket.on('pos', d => {
    if (!me || game.phase !== 'playing' || !d || d.s !== me.spawnId || me.caughtBy) return; // fanget: står stille
    const x = +d.x, z = +d.z, a = +d.a;
    if (![x, z, a].every(Number.isFinite) || isWallAt(x, z)) return;
    const now = Date.now();
    const maxD = CONFIG.playerSpeed * Math.max((now - me.lastPosT) / 1000, 0.05) * 1.6 + 0.3;
    const dist = Math.hypot(x - me.x, z - me.z);
    if (dist > maxD) return; // for raskt: ignoreres
    for (let t = 0.2; t < dist; t += 0.2) // ikke gjennom lukkede dører
      if (closedDoorAt(me, me.x + (x - me.x) * t / dist, me.z + (z - me.z) * t / dist)) return;
    if (closedDoorAt(me, x, z)) return;
    me.x = x; me.z = z; me.a = a; me.lastPosT = now;
    const cell = Math.floor(x) + ',' + Math.floor(z);
    if (!me.visited.has(cell)) { me.visited.add(cell); me.score += CONFIG.pointsPerStep; }
  });

  // Spilleren står ved en lukket dør og ber om en oppgave
  socket.on('door', id => {
    const door = Number.isInteger(id) && game.doors[id];
    if (!me || game.phase !== 'playing' || !door || me.opened.has(id) || me.caughtBy) return;
    if (Math.hypot(me.x - door.x - 0.5, me.z - door.z - 0.5) > CONFIG.doorReach) return;
    if (Date.now() < me.cooldownUntil) return;
    // Samme oppgave igjen hvis den ikke er besvart, så man ikke kan bytte til en lettere
    if (!me.task || me.task.door !== id || me.task.answer === undefined)
      me.task = { kind: 'door', door: id, ...nextTask(me) };
    sendTask(me);
  });

  socket.on('answer', i => {
    const t = me && me.task;
    if (!t || t.answer === undefined || game.phase !== 'playing') return;
    const p = me;
    if (i === t.answer && t.kind === 'fox') {
      releasePlayer(p, Date.now()); p.score += CONFIG.foxTaskPoints;
      socket.emit('answerResult', { ok: true, kind: 'fox', correct: t.answer, points: CONFIG.foxTaskPoints });
      addEvent(`🏃 ${p.name} svarte riktig og slapp fri fra reven`);
    } else if (i === t.answer) {
      p.task = null;
      p.opened.add(t.door); p.solved++; p.score += CONFIG.pointsPerTask;
      socket.emit('answerResult', { ok: true, kind: 'door', correct: t.answer, door: t.door, points: CONFIG.pointsPerTask });
      addEvent(`🚪 ${p.name} åpnet en dør`);
    } else {
      p.task = { kind: t.kind, door: t.door }; // fortsatt trygg (og fanget) mens man venter på neste oppgave
      if (t.kind === 'fox') { // reven gir et nytt spørsmål selv etter ventetiden
        setTimeout(() => {
          if (p.caughtBy && p.task && p.task.answer === undefined && game.phase === 'playing') {
            p.task = { kind: 'fox', ...nextTask(p) };
            sendTask(p);
          }
        }, CONFIG.wrongWaitMs);
      } else p.cooldownUntil = Date.now() + CONFIG.wrongWaitMs;
      socket.emit('answerResult', { ok: false, kind: t.kind, correct: t.answer, door: t.door, wait: CONFIG.wrongWaitMs });
    }
  });

  socket.on('cancelTask', () => { if (me && !me.caughtBy) me.task = null; }); // man kan ikke gå fra reven

  socket.on('settings', (s = {}) => {
    if (!isHost() || game.phase === 'playing') return;
    if (SIZES[s.size]) game.settings.size = s.size;
    const g = parseInt(s.grade, 10);
    if (GRADES.includes(g)) game.settings.grade = g;
    if (STANDARD.includes(s.subject)) game.settings.subject = s.subject;
    broadcastLobby();
  });

  // Egne oppgaver fra storskjermen: { name, tasks: [{ q, pic, right, wrong: [..] }] }
  socket.on('customTasks', d => {
    if (!isHost() || game.phase === 'playing') return;
    const str = (v, n) => String(v ?? '').trim().slice(0, n);
    game.customTasks = (Array.isArray(d?.tasks) ? d.tasks : []).slice(0, CONFIG.maxCustomTasks).map(t => {
      const right = str(t?.right, 40);
      const wrong = [...new Set((Array.isArray(t?.wrong) ? t.wrong : []).map(w => str(w, 40)))]
        .filter(w => w && w !== right).slice(0, 2);
      return { q: str(t?.q, 200), pic: str(t?.pic, 24), right, wrong };
    }).filter(t => t.q && t.right && t.wrong.length);
    game.settings.customName = game.customTasks.length ? str(d?.name, 40) || 'Egne oppgaver' : '';
    game.settings.customCount = game.customTasks.length;
    broadcastLobby();
  });

  socket.on('start', () => { if (isHost() && game.phase !== 'playing') startGame(); });
  socket.on('toLobby', () => { if (isHost()) toLobby(); });

  socket.on('disconnect', () => {
    if (!me || me.socketId !== socket.id) return;
    me.connected = false;
    if (me.caughtBy) releasePlayer(me, Date.now()); // ellers står reven fast
    if (game.phase === 'lobby') players.delete(me.key);
    broadcastLobby();
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Gull-egget kjører på port ${PORT}`));
