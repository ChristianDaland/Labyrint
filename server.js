'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const HOST_KEY = process.env.HOST_KEY || ''; // hvis satt må storskjermen åpnes med /?key=<HOST_KEY>

// ─── Justerbare innstillinger ───────────────────────────────────────────
const CONFIG = {
  lives: 3,               // liv per spiller
  playerSpeed: 2.4,       // ruter per sekund (samme verdi står i play.html)
  pickupDist: 0.55,       // hvor nær egget man må være
  foxHitDist: 0.5,        // hvor nær en rev må være for å ta deg
  invulnMs: 2500,         // usårbar-tid etter å ha mistet et liv
  respawnAtStart: true,   // true: tilbake til start når reven tar deg
  foxWanderSpeed: 1.3,    // revens fart når den leter
  foxChaseSpeed: 2.0,     // revens fart når den jager (litt tregere enn spilleren)
  foxSightCells: 7,       // hvor langt en rev ser langs en korridor
  foxCanWin: true,        // true: revene vinner hvis en rev finner egget først
  foxEggDelaySec: 60,     // revene begynner å lete etter egget først etter så mange sekunder
  extraOpenings: 0.08,    // ekstra åpninger i labyrinten, så man kan rømme rundt
  eggRevealDist: 3,       // egget sendes til mobilen når man er så nær (gløden synes rundt hjørner)
  eggSightDist: 9,        // ... eller har fri sikt til det innenfor denne avstanden (tåka slutter ved 8,5)
  emptyLobbyMs: 60000,    // tilbake til lobbyen hvis ingen spillere er tilkoblet så lenge
  tickHz: 20,
};
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
  settings: { size: 'middels', foxes: 2 },
  grid: null, start: null, egg: null, foxes: [], result: null,
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
  // Noen ekstra åpninger gir sløyfer, så det finnes fluktveier fra revene
  const extra = Math.floor(cols * rows * CONFIG.extraOpenings);
  for (let i = 0, tries = 0; i < extra && tries < 1000; tries++) {
    const x = 1 + rand(W - 2), y = 1 + rand(H - 2);
    if ((x % 2) === (y % 2)) continue; // bare vegger mellom to celler
    if (g[y][x] === 1) { g[y][x] = 0; i++; }
  }
  return g;
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

function nextColor() {
  const used = new Set([...players.values()].map(p => p.color));
  return COLORS.find(c => !used.has(c)) || COLORS[rand(COLORS.length)];
}

function publicPlayer(p) {
  return { id: p.pid, name: p.name, color: p.color, x: r3(p.x), z: r3(p.z), a: r3(p.a),
    lives: p.lives, out: p.out, inv: Date.now() < p.invulnUntil };
}

function lobbyPayload() {
  return { phase: game.phase, settings: game.settings,
    players: [...players.values()].map(p => ({ id: p.pid, name: p.name, color: p.color, online: p.connected })) };
}
const broadcastLobby = () => io.emit('lobby', lobbyPayload());
const addEvent = text => io.to('hosts').emit('event', { text, t: Date.now() });

function baseGame() {
  return { phase: game.phase, grid: game.grid, start: game.start,
    egg: game.egg && { x: game.egg.x, z: game.egg.z }, result: game.result, lives: CONFIG.lives,
    round: game.round, elapsed: (game.endedAt || Date.now()) - game.startedAt };
}

function sendGameTo(p) {
  if (!p.connected) return;
  const g = baseGame();
  if (!p.eggSeen) g.egg = null; // egget sendes først når spilleren ser det (hindrer juks)
  io.to(p.socketId).emit('game', { ...g,
    you: { x: p.x, z: p.z, a: p.a, s: p.spawnId, lives: p.lives, out: p.out } });
}

function canSeeEgg(p) {
  const dx = game.egg.x - p.x, dz = game.egg.z - p.z, d = Math.hypot(dx, dz);
  if (d < CONFIG.eggRevealDist) return true;
  if (d > CONFIG.eggSightDist) return false;
  for (let t = 0.1; t < d; t += 0.1) if (isWallAt(p.x + dx / d * t, p.z + dz / d * t)) return false;
  return true;
}

function resetPlayer(p) {
  p.x = game.start.x; p.z = game.start.z; p.a = game.start.a;
  p.lives = CONFIG.lives; p.out = false; p.spawnId++; p.eggSeen = false;
  p.invulnUntil = Date.now() + 1500; p.lastPosT = Date.now();
}

function startGame() {
  const n = SIZES[game.settings.size] || 12;
  const grid = generateMaze(n, n);
  const dist = bfs(grid, 1, 1);
  const cells = [];
  let max = 0;
  for (let z = 1; z < grid.length; z += 2)
    for (let x = 1; x < grid[0].length; x += 2) { cells.push({ x, z, d: dist[z][x] }); max = Math.max(max, dist[z][x]); }

  const eggCell = pick(cells.filter(c => c.d >= max * 0.6));
  const eggDist = bfs(grid, eggCell.x, eggCell.z);
  let maxEgg = 0;
  for (const c of cells) maxEgg = Math.max(maxEgg, eggDist[c.z][c.x]);
  const foxCells = cells.filter(c => c.d >= max * 0.35 && eggDist[c.z][c.x] >= maxEgg * 0.35)
    .sort(() => Math.random() - 0.5);
  const chosen = [];
  for (const c of foxCells) {
    if (chosen.length >= game.settings.foxes) break;
    if (chosen.every(o => Math.abs(o.x - c.x) + Math.abs(o.z - c.z) > 6)) chosen.push(c);
  }
  for (const c of foxCells) { if (chosen.length >= game.settings.foxes) break; if (!chosen.includes(c)) chosen.push(c); }

  game.grid = grid;
  game.start = { x: 1.5, z: 1.5, a: grid[1][2] === 0 ? 0 : Math.PI / 2 };
  game.egg = { x: eggCell.x + 0.5, z: eggCell.z + 0.5, cx: eggCell.x, cz: eggCell.z };
  game.foxes = chosen.map(c => ({ x: c.x + 0.5, z: c.z + 0.5, a: 0, cx: c.x, cz: c.z, tx: c.x, tz: c.z,
    px: -1, pz: -1, chasing: false }));
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
  io.emit('end', result);
  broadcastLobby();
  if (result.type === 'player') addEvent(`🏆 ${result.name} fant gull-egget!`);
  else if (result.type === 'fox') addEvent('🦊 En rev fant gull-egget først!');
  else addEvent('🦊 Revene tok alle spillerne!');
}

function toLobby() {
  game.phase = 'lobby';
  game.grid = null; game.egg = null; game.foxes = []; game.result = null;
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
  const prey = [...players.values()]
    .filter(p => p.connected && !p.out && now >= p.invulnUntil)
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
  let step = (f.chasing ? CONFIG.foxChaseSpeed : CONFIG.foxWanderSpeed) * dt;
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

function hitPlayer(p, now) {
  p.lives--;
  p.invulnUntil = now + CONFIG.invulnMs;
  if (p.lives <= 0) {
    p.out = true;
    io.to(p.socketId).emit('hit', { lives: 0, out: true });
    addEvent(`🦊 ${p.name} ble tatt og er ute`);
    return;
  }
  let respawn = null;
  if (CONFIG.respawnAtStart) {
    p.spawnId++;
    p.x = game.start.x; p.z = game.start.z; p.a = game.start.a; p.lastPosT = now;
    respawn = { x: p.x, z: p.z, a: p.a, s: p.spawnId };
  }
  io.to(p.socketId).emit('hit', { lives: p.lives, respawn });
  addEvent(`🦊 Reven tok ${p.name}, ${p.lives} liv igjen`);
}

let lastTick = Date.now();
function tick() {
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 0.2);
  lastTick = now;
  if (game.phase !== 'playing') return;

  for (const f of game.foxes) updateFox(f, dt, now);

  const active = [...players.values()].filter(p => p.connected && !p.out);
  for (const p of active) {
    if (Math.hypot(p.x - game.egg.x, p.z - game.egg.z) < CONFIG.pickupDist)
      return endGame({ type: 'player', id: p.pid, name: p.name, color: p.color });
    if (!p.eggSeen && canSeeEgg(p)) {
      p.eggSeen = true;
      io.to(p.socketId).emit('egg', { x: game.egg.x, z: game.egg.z });
    }
    if (now < p.invulnUntil) continue;
    if (game.foxes.some(f => Math.hypot(p.x - f.x, p.z - f.z) < CONFIG.foxHitDist)) hitPlayer(p, now);
  }
  if (CONFIG.foxCanWin && now - game.startedAt > CONFIG.foxEggDelaySec * 1000 && game.foxes.some(f => f.cx === game.egg.cx && f.cz === game.egg.cz))
    return endGame({ type: 'fox' });
  const online = [...players.values()].filter(p => p.connected);
  if (!online.length) { // alle har koblet fra: ikke la runden gå i det uendelige
    if (!game.emptySince) game.emptySince = now;
    else if (now - game.emptySince > CONFIG.emptyLobbyMs) {
      addEvent('Ingen spillere igjen, tilbake til lobbyen');
      return toLobby();
    }
  } else game.emptySince = 0;
  if (online.length && online.every(p => p.out)) return endGame({ type: 'allOut' });

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
        x: 0, z: 0, a: 0, lives: CONFIG.lives, out: false, spawnId: 0, invulnUntil: 0, lastPosT: 0 };
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
    if (!me || game.phase !== 'playing' || me.out || !d || d.s !== me.spawnId) return;
    const x = +d.x, z = +d.z, a = +d.a;
    if (![x, z, a].every(Number.isFinite) || isWallAt(x, z)) return;
    const now = Date.now();
    const maxD = CONFIG.playerSpeed * Math.max((now - me.lastPosT) / 1000, 0.05) * 1.6 + 0.3;
    if (Math.hypot(x - me.x, z - me.z) > maxD) return; // for raskt: ignoreres
    me.x = x; me.z = z; me.a = a; me.lastPosT = now;
  });

  socket.on('settings', (s = {}) => {
    if (!isHost() || game.phase === 'playing') return;
    if (SIZES[s.size]) game.settings.size = s.size;
    const f = parseInt(s.foxes, 10);
    if (f >= 0 && f <= 6) game.settings.foxes = f;
    broadcastLobby();
  });

  socket.on('start', () => { if (isHost() && game.phase !== 'playing') startGame(); });
  socket.on('toLobby', () => { if (isHost()) toLobby(); });

  socket.on('disconnect', () => {
    if (!me || me.socketId !== socket.id) return;
    me.connected = false;
    if (game.phase === 'lobby') players.delete(me.key);
    broadcastLobby();
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Gull-egget kjører på port ${PORT}`));
