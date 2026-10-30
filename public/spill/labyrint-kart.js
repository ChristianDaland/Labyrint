// Labyrinten uten grafikk: lager labyrinten med dører på veien til egget, og styrer reven.
// Brukes av spill/labyrint.js, og testes i Node (test/kjerne.test.mjs).
//
// grid[z][x]: 1 = vegg, 0 = gulv. Størrelse (2n+1)×(2n+1). Ruter på oddetallskoordinater, ganger mellom dem.

export const CONFIG = {
  size: 7,               // ruter i hver retning (liten nok for en runde på noen minutter)
  pathDoors: 6,          // dører jevnt fordelt på den eneste veien til egget
  sideDoorShare: 0.04,   // andel av de andre gangene som også får en dør
  extraOpenings: 0.08,   // sløyfer å rømme rundt i, men aldri forbi en dør på veien
  foxWanderSpeed: 1.3,   // ruter per sekund (spilleren går 2,4)
  foxChaseSpeed: 2.0,
  foxFleeSpeed: 2.6,
  foxSight: 7,           // hvor langt reven ser langs en rett gang
  foxRetreat: 10,        // reven løper så mange ruter unna når barnet har kommet fri
  foxFleeMaxMs: 6000,
};

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const rand = n => Math.floor(Math.random() * n);
const pick = arr => arr[rand(arr.length)];

export function bfs(grid, sx, sz) {
  const dist = grid.map(row => row.map(() => -1));
  const q = [[sx, sz]];
  dist[sz][sx] = 0;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i];
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (grid[nz]?.[nx] === 0 && dist[nz][nx] < 0) { dist[nz][nx] = dist[z][x] + 1; q.push([nx, nz]); }
    }
  }
  return dist;
}

// Korteste vei fra startpunktet for `dist` til (x, z)
export function pathTo(dist, x, z) {
  const path = [[x, z]];
  while (dist[z][x] > 0) {
    const [dx, dz] = DIRS.find(([dx, dz]) => dist[z + dz]?.[x + dx] === dist[z][x] - 1);
    x += dx; z += dz;
    path.push([x, z]);
  }
  return path.reverse();
}

// Perfekt labyrint (recursive backtracker): nøyaktig én vei mellom to ruter
function generateMaze(n) {
  const W = n * 2 + 1, g = Array.from({ length: W }, () => Array(W).fill(1));
  const seen = new Set(['0,0']), stack = [[0, 0]];
  g[1][1] = 0;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = DIRS.filter(([dx, dy]) => {
      const nx = cx + dx, ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen.has(nx + ',' + ny);
    });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = pick(opts), nx = cx + dx, ny = cy + dy;
    g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
    g[ny * 2 + 1][nx * 2 + 1] = 0;
    seen.add(nx + ',' + ny);
    stack.push([nx, ny]);
  }
  return g;
}

// Ekstra åpninger gir sløyfer, men bare der hver dør på veien fortsatt er eneste vei fram.
// Veggene rundt egget står (maleriet henger på en av dem, se paintingWall).
function addLoops(g, pathDoors, egg, count) {
  const W = g.length;
  const doorsNeeded = () => pathDoors.every(d => {
    g[d.z][d.x] = 1;
    const reach = bfs(g, 1, 1)[egg.z][egg.x] >= 0;
    g[d.z][d.x] = 0;
    return !reach;
  });
  for (let i = 0, tries = 0; i < count && tries < 400; tries++) {
    const x = 1 + rand(W - 2), z = 1 + rand(W - 2);
    if ((x % 2) === (z % 2) || g[z][x] !== 1 || Math.abs(x - egg.x) + Math.abs(z - egg.z) === 1) continue;
    g[z][x] = 0;
    if (doorsNeeded()) i++; else g[z][x] = 1;
  }
}

// Veggen i eggets rute der maleriet henger: rett overfor åpningen man kommer inn fra (nærmest start),
// så det er det første man ser ved egget. Gir retningen fra ruta til veggen, {dx, dz}.
export function paintingWall(grid, ex, ez) {
  const dist = bfs(grid, 1, 1);
  const open = DIRS.filter(([dx, dz]) => grid[ez + dz][ex + dx] === 0);
  const [ix, iz] = open.sort((a, b) => dist[ez + a[1] * 2][ex + a[0] * 2] - dist[ez + b[1] * 2][ex + b[0] * 2])[0];
  const [dx, dz] = grid[ez - iz][ex - ix] ? [-ix, -iz] : DIRS.find(([dx, dz]) => grid[ez + dz][ex + dx]);
  return { dx, dz };
}

// Ny labyrint: { grid, start, egg, painting: {dx, dz}, doors: [{id, x, z}], fox: {x, z} }
export function makeLevel(cfg = CONFIG) {
  const n = cfg.size, grid = generateMaze(n);
  let dist = bfs(grid, 1, 1), max = 0;
  const cells = [];
  for (let z = 1; z < grid.length; z += 2) for (let x = 1; x < grid.length; x += 2) { cells.push({ x, z }); max = Math.max(max, dist[z][x]); }
  const walled = c => DIRS.some(([dx, dz]) => grid[c.z + dz][c.x + dx]);
  const egg = pick(cells.filter(c => dist[c.z][c.x] >= max * 0.6 && walled(c)));

  // Dørene jevnt fordelt på veien (gangene ligger på oddetallsplassene i veien: rute, gang, rute, …)
  const route = pathTo(dist, egg.x, egg.z), L = route.length - 1;
  const count = Math.max(1, Math.min(cfg.pathDoors, Math.floor(L / 4)));
  const onPath = new Set();
  for (let k = 1; k <= count; k++) {
    let i = Math.round(k * L / (count + 1));
    if (i % 2 === 0) i++;
    if (i < L) onPath.add(route[i].join(','));
  }
  const pathDoors = [...onPath].map(s => { const [x, z] = s.split(',').map(Number); return { x, z }; });
  addLoops(grid, pathDoors, egg, Math.floor(n * n * cfg.extraOpenings));

  const passages = [];
  for (let z = 1; z < grid.length - 1; z++) for (let x = 1; x < grid.length - 1; x++)
    if (grid[z][x] === 0 && (x % 2) !== (z % 2) && !onPath.has(x + ',' + z) && !(x <= 2 && z <= 2)) passages.push({ x, z });
  passages.sort(() => Math.random() - 0.5);
  const doors = [...pathDoors, ...passages.slice(0, Math.round(passages.length * cfg.sideDoorShare))]
    .map((c, id) => ({ id, x: c.x, z: c.z }));

  // Reven langt fra både start og egg
  dist = bfs(grid, 1, 1);
  const eggDist = bfs(grid, egg.x, egg.z);
  max = Math.max(...cells.map(c => dist[c.z][c.x]));
  const maxEgg = Math.max(...cells.map(c => eggDist[c.z][c.x]));
  const foxCell = pick(cells.filter(c => dist[c.z][c.x] >= max * 0.35 && eggDist[c.z][c.x] >= maxEgg * 0.35)) || cells[cells.length - 1];

  return { grid, start: { x: 1.5, z: 1.5, a: grid[1][2] === 0 ? 0 : Math.PI / 2 }, egg: { x: egg.x + 0.5, z: egg.z + 0.5 },
    painting: paintingWall(grid, egg.x, egg.z), doors, fox: { x: foxCell.x + 0.5, z: foxCell.z + 0.5 } };
}

// ─── Reven ──────────────────────────────────────────────────────────────
export const newFox = ({ x, z }) => ({ x, z, a: 0, cx: Math.floor(x), cz: Math.floor(z), tx: Math.floor(x), tz: Math.floor(z),
  px: -1, pz: -1, chasing: false, holding: false, flee: null });

function lookAlong(grid, f, dx, dz, target) {
  let x = f.cx, z = f.cz;
  for (let i = 1; i <= CONFIG.foxSight; i++) {
    x += dx; z += dz;
    if (grid[z]?.[x] !== 0) return false;
    if (x === target.cx && z === target.cz) return true;
  }
  return false;
}

// Velger neste rute. `prey` = { cx, cz } for spilleren reven kan jage, eller null (trygg).
function chooseNext(grid, f, prey, now) {
  const open = DIRS.filter(([dx, dz]) => grid[f.cz + dz]?.[f.cx + dx] === 0);
  if (f.flee) { // løper mot fluktmålet, ett steg nærmere hver gang
    const here = f.flee.to[f.cz][f.cx];
    const next = open.find(([dx, dz]) => f.flee.to[f.cz + dz][f.cx + dx] === here - 1);
    if (here > 0 && next && now < f.flee.until) { f.tx = f.cx + next[0]; f.tz = f.cz + next[1]; return; }
    f.flee = null;
  }
  const chase = prey && open.find(([dx, dz]) => lookAlong(grid, f, dx, dz, prey));
  f.chasing = !!chase;
  let dir = chase;
  if (!dir) { // vandrer, helst uten å snu
    let opts = open.filter(([dx, dz]) => !(f.cx + dx === f.px && f.cz + dz === f.pz));
    if (!opts.length) opts = open;
    dir = opts.length ? pick(opts) : null;
  }
  if (!dir) { f.tx = f.cx; f.tz = f.cz; return; }
  f.tx = f.cx + dir[0]; f.tz = f.cz + dir[1];
}

export function updateFox(grid, f, dt, prey, now = performance.now()) {
  if (f.holding) return;
  let step = (f.flee ? CONFIG.foxFleeSpeed : f.chasing ? CONFIG.foxChaseSpeed : CONFIG.foxWanderSpeed) * dt;
  for (let guard = 0; guard < 4 && step > 0; guard++) {
    const tx = f.tx + 0.5, tz = f.tz + 0.5, dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
    if (d > 1e-6) f.a = Math.atan2(dz, dx);
    if (d <= step) {
      f.x = tx; f.z = tz; step -= d;
      if (f.tx !== f.cx || f.tz !== f.cz) { f.px = f.cx; f.pz = f.cz; f.cx = f.tx; f.cz = f.tz; }
      chooseNext(grid, f, prey, now);
      if (f.tx === f.cx && f.tz === f.cz) break;
    } else {
      f.x += dx / d * step; f.z += dz / d * step; step = 0;
    }
  }
}

// Spilleren har svart riktig: reven løper til et mål ca. foxRetreat ruter unna der hele veien går bort fra spilleren
// (reven ligger på korteste vei fra spilleren dit). Står den i en sidegang, løper den så langt det går.
export function releaseFox(grid, f, player, now = performance.now()) {
  f.holding = false; f.chasing = false;
  const fromP = bfs(grid, Math.floor(player.x), Math.floor(player.z)), fromF = bfs(grid, f.cx, f.cz);
  const df = fromP[f.cz][f.cx], R = CONFIG.foxRetreat, near = [];
  let deepest = null;
  for (let z = 1; z < grid.length - 1; z++) for (let x = 1; x < grid.length - 1; x++) {
    if (grid[z][x] !== 0 || fromF[z][x] !== fromP[z][x] - df) continue;
    if (fromP[z][x] >= R && fromP[z][x] <= R + 4) near.push({ x, z });
    if (!deepest || fromP[z][x] > fromP[deepest.z][deepest.x]) deepest = { x, z };
  }
  const goal = near.length ? pick(near) : deepest;
  f.flee = { to: bfs(grid, goal.x, goal.z), until: now + CONFIG.foxFleeMaxMs };
  if (f.flee.to[f.tz][f.tx] >= f.flee.to[f.cz][f.cx]) { f.tx = f.cx; f.tz = f.cz; }
}
