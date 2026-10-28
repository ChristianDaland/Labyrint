// Tester for kjernen i public/kjerne/. Kjør med: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS, SPELL_SKILLS, SKILL_BY_ID, skillsOf, makeTask, makeMathPuzzle } from '../public/kjerne/oppgaver.js';
import { newLearning, newStats, chooseSkill, recordAnswer, nextTask, progress, today, WINDOW } from '../public/kjerne/laering.js';
import { starsFor, finishRound, awardSkills, newRewards, eggKind, countEggs } from '../public/kjerne/belonning.js';
import { createStore, newProfile, profileName, KEY, VERSION } from '../public/kjerne/lagring.js';
import * as lyd from '../public/kjerne/lyd.js';
import { T, allPhrases, spoken } from '../public/kjerne/tale.js';
import { readFileSync, existsSync } from 'node:fs';
import { ANIMALS, COLORS } from '../public/kjerne/lagring.js';

const memStorage = () => {
  const m = new Map();
  return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};
const profile = () => newProfile('ugle', 'lilla');
// Forutsigbar «tilfeldighet» for fordelingstester
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

// ─── Oppgaver ───────────────────────────────────────────────────────────
test('alle ferdigheter lager gyldige oppgaver', () => {
  for (const s of SKILLS) for (let i = 0; i < 2000; i++) {
    const t = makeTask(s.id);
    assert.equal(t.skill, s.id);
    assert.equal(t.options.length, 3, `${s.id}: ${JSON.stringify(t)}`);
    assert.equal(new Set(t.options).size, 3, `${s.id}: like svar ${JSON.stringify(t.options)}`);
    assert.ok(t.answer >= 0 && t.answer < 3, `${s.id}: svarindeks`);
    assert.ok(t.options.every(o => !/NaN|undefined|^-|\./.test(o)), `${s.id}: rart svar ${JSON.stringify(t.options)}`);
    assert.ok(t.q && t.speak, `${s.id}: mangler tekst`);
  }
});

test('staveoppgavene: ordet, bokstavbrikkene og ekstra bokstaver', () => {
  for (const s of SPELL_SKILLS) for (let i = 0; i < 500; i++) {
    const t = makeTask(s.id);
    assert.equal(t.kind, 'stave');
    assert.match(t.word, /^[A-ZÆØÅ]{2,}$/, s.id);
    const rest = [...t.tiles];
    for (const ch of t.word) rest.splice(rest.indexOf(ch), 1); // hver bokstav i ordet finnes som brikke
    assert.equal(rest.length, s.id === 'stavkopi' || s.id === 'stavkort' ? 0 : 2, s.id);
    assert.ok(rest.every(ch => !t.word.includes(ch)), `${s.id}: ekstra bokstav finnes i ordet`);
    assert.equal(t.ghost, s.id === 'stavkopi');
    assert.ok(t.pic && t.speak === `Stav ordet ${t.word.toLowerCase()}.`);
  }
  assert.deepEqual(skillsOf('stave').map(s => s.id), SPELL_SKILLS.map(s => s.id));
  assert.equal(chooseSkill({ level: { matte: 0, norsk: 0, stave: 2 }, recent: {} }, 'stave', () => 0.5).id, 'stavvelg');
});

test('Tallbyggeren: regnestykkene stemmer, og svarene finnes blant brikkene', () => {
  const val = p => Number('slot' in p ? p.slot : p.text);
  for (const s of skillsOf('matte')) for (let i = 0; i < 2000; i++) {
    const t = makeMathPuzzle(s.id), parts = t.parts, answers = parts.filter(p => 'slot' in p).map(p => p.slot);
    assert.equal(t.skill, s.id);
    assert.ok(answers.length >= 1 && t.speak, s.id);
    const rest = [...t.tiles];
    for (const a of answers) { assert.ok(rest.includes(a), `${s.id}: mangler brikke ${a}`); rest.splice(rest.indexOf(a), 1); }
    assert.equal(rest.length, 2, `${s.id}: to ekstra brikker ${JSON.stringify(t.tiles)}`);
    assert.ok(t.tiles.every(v => /^\d+$/.test(v)), `${s.id}: rart tall ${JSON.stringify(t.tiles)}`);
    const ops = parts.map(p => p.text).filter(x => x && !/^\d+$/.test(x));
    if (ops[0] === '+' || ops[0] === '−') {
      const [a, , b, , c] = parts.map(val);
      assert.equal(ops[0] === '+' ? a + b : a - b, c, `${s.id}: ${JSON.stringify(parts)}`);
    } else if (ops[0] === '>') {
      const [b, , a] = parts.map(val), bigger = t.tiles.filter(v => Number(v) > a);
      assert.ok(b > a); assert.deepEqual(bigger, [String(b)], `${s.id}: bare én brikke skal passe`);
    } else if (parts.length > 1) { // tallrekke: lik avstand
      const nums = parts.map(val), step = nums[1] - nums[0];
      assert.ok(step > 0 && nums.every((n, j) => !j || n - nums[j - 1] === step), `${s.id}: ${nums}`);
      // ekstra brikker skal ikke passe i noen tom rute
      assert.ok(rest.every(v => !answers.includes(v)));
    }
  }
});

test('regnestykkene har riktig fasit og holder seg innenfor tallområdet', () => {
  const limits = { pluss5: 5, pluss10: 10, pluss20: 20 };
  for (let i = 0; i < 3000; i++) {
    for (const [id, max] of Object.entries(limits)) {
      const t = makeTask(id), [, a, b] = t.q.match(/^(\d+) \+ (\d+) = \?$/);
      assert.equal(+t.options[t.answer], +a + +b);
      assert.ok(+a + +b <= max, `${id}: ${t.q}`);
    }
    for (const id of ['minus5', 'minus10', 'minus20']) {
      const t = makeTask(id), [, a, b] = t.q.match(/^(\d+) − (\d+) = \?$/);
      assert.equal(+t.options[t.answer], a - b);
      assert.ok(a - b >= 0, `${id}: ${t.q}`);
    }
    const c5 = makeTask('telle5');
    assert.ok(+c5.options[c5.answer] <= 5 && [...c5.pic.replace(/\n/g, '')].length >= 1);
    const tv = makeTask('tiervenner'), [, x] = tv.q.match(/^(\d+) \+ \? = 10$/);
    assert.equal(+x + +tv.options[tv.answer], 10);
    const big = makeTask('storst10');
    assert.equal(+big.options[big.answer], Math.max(...big.options.map(Number)));
  }
});

test('ferdighetene er ordnet per fag', () => {
  assert.equal(skillsOf('matte')[0].id, 'telle5');
  assert.equal(skillsOf('norsk')[0].id, 'storliten');
  assert.equal(skillsOf('matte').length + skillsOf('norsk').length, SKILLS.length);
  for (const s of SKILLS) assert.ok(s.diploma.startsWith('Du '), s.id);
});

// ─── Læringsmotoren ─────────────────────────────────────────────────────
test('på første nivå: mest første ferdighet, litt smakebit, ingen repetisjon', () => {
  const l = newLearning(), n = 10000, count = {};
  for (let i = 0; i < n; i++) { const s = chooseSkill(l, 'matte').id; count[s] = (count[s] || 0) + 1; }
  assert.deepEqual(Object.keys(count).sort(), ['telle10', 'telle5']);
  assert.ok(Math.abs(count.telle10 / n - 0.1) < 0.02, `smakebit ${count.telle10 / n}`);
});

test('midt i: ca. 70 % nå, 20 % repetisjon, 10 % neste', () => {
  const l = newLearning(); l.level.matte = 4;
  const list = skillsOf('matte'), n = 20000; let now = 0, review = 0, next = 0;
  for (let i = 0; i < n; i++) {
    const idx = list.indexOf(chooseSkill(l, 'matte'));
    if (idx === 4) now++; else if (idx === 5) next++; else if (idx < 4) review++;
  }
  assert.ok(Math.abs(now / n - 0.7) < 0.02, `nå ${now / n}`);
  assert.ok(Math.abs(review / n - 0.2) < 0.02, `repetisjon ${review / n}`);
  assert.ok(Math.abs(next / n - 0.1) < 0.02, `neste ${next / n}`);
});

test('repetisjon velger oftere det spilleren bommer på', () => {
  const l = newLearning(); l.level.matte = 2;
  l.recent.telle5 = Array(10).fill(0); // alt feil
  l.recent.telle10 = Array(10).fill(1); // alt riktig
  const c = { telle5: 0, telle10: 0 };
  for (let i = 0; i < 20000; i++) { const s = chooseSkill(l, 'matte').id; if (s in c) c[s]++; }
  assert.ok(c.telle5 > 3 * c.telle10, JSON.stringify(c));
});

test('«begge» blander matte og norsk omtrent likt', () => {
  const l = newLearning(); let m = 0;
  for (let i = 0; i < 10000; i++) if (chooseSkill(l, 'begge').subject === 'matte') m++;
  assert.ok(Math.abs(m / 10000 - 0.5) < 0.03);
  assert.ok(nextTask(profile()).skill);
});

test('opp et hakk ved 8 av 10 riktige, ikke før 10 svar', () => {
  const p = profile();
  for (let i = 0; i < 9; i++) assert.deepEqual(recordAnswer(p, 'telle5', true), []);
  assert.equal(p.learning.level.matte, 0);
  assert.deepEqual(recordAnswer(p, 'telle5', true), [{ type: 'mastered', skill: 'telle5' }]);
  assert.equal(p.learning.level.matte, 1);

  const q = profile(); // 7 av 10 er ikke nok, 8 av de 10 siste er nok
  for (const ok of [0, 0, 0, 1, 1, 1, 1, 1, 1, 1]) recordAnswer(q, 'telle5', !!ok);
  assert.equal(q.learning.level.matte, 0);
  recordAnswer(q, 'telle5', true); // siste 10: 0,0,1,1,1,1,1,1,1,1 = 8
  assert.equal(q.learning.level.matte, 1);
});

test('ned et hakk ved under 5 av 10, med blanke ark', () => {
  const p = profile(); p.learning.level.matte = 2;
  p.learning.recent.telle10 = Array(10).fill(1);
  for (let i = 0; i < 10; i++) recordAnswer(p, 'etter10', i < 4);
  assert.equal(p.learning.level.matte, 1);
  assert.deepEqual(p.learning.recent.telle10, []);
  assert.deepEqual(p.learning.recent.etter10, []);
  // ikke under null
  const q = profile();
  for (let i = 0; i < 10; i++) recordAnswer(q, 'telle5', false);
  assert.equal(q.learning.level.matte, 0);
});

test('svar på andre ferdigheter enn den spilleren øver på flytter ikke nivået', () => {
  const p = profile(); p.learning.level.matte = 3;
  for (let i = 0; i < 20; i++) recordAnswer(p, 'telle5', true);
  for (let i = 0; i < 20; i++) recordAnswer(p, 'pluss10', true);
  assert.equal(p.learning.level.matte, 3);
  assert.equal(p.learning.recent.telle5.length, WINDOW);
});

test('statistikk per fag og per dag', () => {
  const p = profile(), d = new Date(2026, 9, 28, 12);
  recordAnswer(p, 'pluss5', true, d); recordAnswer(p, 'rim', false, d); recordAnswer(p, 'rim', true, d);
  recordAnswer(p, 'stavkopi', true, d);
  assert.deepEqual(p.stats.right, { matte: 1, norsk: 1, stave: 1 });
  assert.deepEqual(p.stats.wrong, { matte: 0, norsk: 1, stave: 0 });
  assert.deepEqual(p.stats.days['2026-10-28'], { right: 3, wrong: 1 });
  assert.equal(today(d), '2026-10-28');
  assert.deepEqual(recordAnswer(p, 'finnes-ikke', true), []);
});

test('alt mestret: blir på siste ferdighet, ingen flere hendelser', () => {
  const p = profile(), list = skillsOf('norsk');
  p.learning.level.norsk = list.length - 1;
  const last = list[list.length - 1].id;
  let ev = [];
  for (let i = 0; i < 10; i++) ev = recordAnswer(p, last, true);
  assert.deepEqual(ev, [{ type: 'mastered', skill: last }]);
  assert.equal(progress(p.learning, 'norsk'), 1);
  for (let i = 0; i < 10; i++) assert.deepEqual(recordAnswer(p, last, true), []);
  assert.equal(chooseSkill(p.learning, 'norsk', seq([0.5])).id, last);
});

// ─── Belønninger ────────────────────────────────────────────────────────
test('stjerner av 10: 0–5 → 1, 6–8 → 2, 9–10 → 3', () => {
  assert.deepEqual([0, 5, 6, 8, 9, 10].map(r => starsFor(r, 10)), [1, 1, 2, 2, 3, 3]);
  assert.equal(starsFor(0, 0), 1);
});

test('runde gir egg, stjerner og milepæl-diplomer én gang', () => {
  const p = profile(), d = new Date('2026-10-28T10:00:00Z');
  let r = finishRound(p, { game: 'flakse', right: 10, total: 10 }, d);
  assert.equal(r.stars, 3);
  assert.deepEqual(r.diplomas.map(x => x.id).sort(), ['egg1', 'stjerner3']);
  assert.equal(p.rewards.eggs.length, 1);
  assert.equal(p.rewards.stars, 3);
  r = finishRound(p, { game: 'flakse', right: 10, total: 10 }, d);
  assert.deepEqual(r.diplomas, []); // allerede fått
  for (let i = 0; i < 3; i++) r = finishRound(p, { game: 'labyrint', right: 3, total: 10, foxEscapes: 2 }, d);
  assert.deepEqual(r.diplomas.map(x => x.id).sort(), ['egg5', 'rev5']);
  p.stats.right.matte = 50;
  assert.deepEqual(finishRound(p, { game: 'flakse', right: 5, total: 10 }, d).diplomas.map(x => x.id), ['matte50']);
});

test('stjernene avgjør egget: 3 gull, 2 sølv, 1 bronse', () => {
  const p = profile(), d = new Date('2026-10-28T10:00:00Z');
  assert.equal(eggKind(finishRound(p, { game: 'flakse', right: 9, total: 10 }, d).egg), 'gull');
  assert.equal(eggKind(finishRound(p, { game: 'flakse', right: 7, total: 10 }, d).egg), 'solv');
  assert.equal(eggKind(finishRound(p, { game: 'labyrint', right: 2, total: 10 }, d).egg), 'bronse');
  finishRound(p, { game: 'flakse', right: 8, total: 10 }, d);
  assert.deepEqual(countEggs(p.rewards.eggs), { gull: 1, solv: 2, bronse: 1 });
  for (let i = 0; i < 4; i++) finishRound(p, { game: 'flakse', right: 10, total: 10 }, d);
  assert.ok(p.rewards.diplomas.some(x => x.id === 'gull5'));
  assert.deepEqual(T.eggsHave({ gull: 2, solv: 0, bronse: 1 }), ['Du har', '2', 'gullegg', 'og', '1', 'bronseegg.']);
  assert.deepEqual(T.newEggs([{ stars: 2 }]), ['Du fikk et nytt sølvegg!']);
});

test('diplom for mestret ferdighet, bare én gang', () => {
  const p = profile();
  const got = awardSkills(p, [{ type: 'mastered', skill: 'pluss10' }, { type: 'stepDown', skill: 'minus5' }]);
  assert.deepEqual(got.map(d => [d.id, d.text]), [['kan-pluss10', SKILL_BY_ID.pluss10.diploma]]);
  assert.deepEqual(awardSkills(p, [{ type: 'mastered', skill: 'pluss10' }]), []);
});

// ─── Lagring ────────────────────────────────────────────────────────────
test('profiler: legg til, aktiv, unik figur, husker mellom økter, slett', () => {
  const st = memStorage(), s = createStore(st);
  assert.equal(s.active(), null);
  const p = s.addProfile('ugle', 'lilla');
  assert.equal(profileName(p), 'lilla ugle');
  assert.equal(s.active().id, p.id);
  assert.throws(() => s.addProfile('ugle', 'lilla'), /finnes allerede/);
  assert.throws(() => s.addProfile('dinosaur', 'lilla'), /ukjent/);
  const q = s.addProfile('bjorn', 'bla');
  s.setActive(p.id);
  recordAnswer(s.active(), 'pluss5', true); s.save();

  const s2 = createStore(st); // ny økt, samme enhet
  assert.equal(s2.profiles().length, 2);
  assert.equal(s2.active().id, p.id);
  assert.equal(s2.active().stats.right.matte, 1);
  s2.removeProfile(p.id);
  assert.equal(s2.active().id, q.id, 'bare én profil igjen: den blir aktiv');
});

test('ødelagt lagring krasjer ikke, og den gamle teksten tas vare på', () => {
  const st = memStorage(); st.setItem(KEY, '{ikke json');
  const s = createStore(st);
  assert.equal(s.profiles().length, 0);
  assert.equal(st.getItem(KEY + '.odelagt'), '{ikke json');
});

test('sikkerhetskopi: eksport og import gir samme fremgang', () => {
  const s = createStore(memStorage()), p = s.addProfile('frosk', 'gronn');
  recordAnswer(p, 'rim', true); finishRound(p, { game: 'flakse', right: 9, total: 10 }); s.save();
  const text = s.exportBackup();
  const s2 = createStore(memStorage());
  assert.equal(s2.importBackup(text), 1);
  assert.deepEqual(s2.profiles()[0], s.profiles()[0]);
  assert.throws(() => s2.importBackup('tull'), /JSON|Unexpected/);
  assert.throws(() => s2.importBackup('{"profiles":[]}'), /ingen profiler/);
  assert.throws(() => s2.importBackup(JSON.stringify({ version: VERSION + 1, profiles: [p] })), /nyere versjon/);
  assert.equal(s2.profiles().length, 1, 'mislykket import endrer ingenting');
});

test('eldre lagring uten nye felt fylles ut', () => {
  const st = memStorage();
  st.setItem(KEY, JSON.stringify({ version: 1, profiles: [{ id: 'x', animal: 'katt', color: 'rod', rewards: { eggs: [{}] } }] }));
  const p = createStore(st).profiles()[0];
  assert.equal(p.rewards.eggs.length, 1);
  assert.deepEqual(p.rewards.diplomas, []);
  assert.deepEqual(p.stats.right, { matte: 0, norsk: 0, stave: 0 });
  assert.deepEqual(p.learning.level, { matte: 0, norsk: 0, stave: 0 });
  assert.equal(p.settings.subject, 'begge');
});

// ─── Lyd ────────────────────────────────────────────────────────────────
test('lyd kan lastes og kalles uten nettleser (gjør da ingenting)', () => {
  assert.doesNotThrow(() => { lyd.pling(); lyd.oops(); lyd.fanfare(); lyd.creak(); lyd.bark(); lyd.speak('hei'); });
  assert.equal(lyd.makeGrowl(), null);
  lyd.setMuted(true); assert.equal(lyd.isMuted(), true); lyd.setMuted(false);
});

test('nye profiler har alle felt', () => {
  const p = profile();
  assert.deepEqual(p.learning, newLearning());
  assert.deepEqual(p.stats, newStats());
  assert.deepEqual(p.rewards, newRewards());
});

// ─── Tale ───────────────────────────────────────────────────────────────
const MANIFEST = new URL('../public/lyd/tale/manifest.json', import.meta.url);

test('alt spillet kan si, er med i listen over setninger (og dermed som lydfil)', () => {
  const all = allPhrases(3000);
  const missing = new Set();
  const check = parts => parts.forEach(p => all.has(p) || missing.add(p));
  for (let i = 0; i < 20000; i++) { // ferske, tilfeldige oppgaver: spørsmål, ros og «riktig svar er …»
    const t = makeTask(SKILLS[i % SKILLS.length].id);
    check(T.task(t)); check(T.wrong(t)); check(T.right());
  }
  const p = { animal: ANIMALS[3].id, color: COLORS[5].id };
  check(T.welcome(p)); check(T.figure(p)); check(T.hello(p)); check(T.starsHave(1)); check(T.starsHave(57));
  check(T.newEggs([{ stars: 1 }])); check(T.newEggs([{ stars: 3 }, { stars: 2 }, { stars: 1 }])); check(T.egg({ game: 'flakse', stars: 2 }));
  check(T.egg({ game: 'labyrint', stars: 1 })); check(T.eggsHave({ gull: 12, solv: 3, bronse: 1 })); check(T.foundEgg('bronse')); check(T.subject('norsk', 99));
  check(T.roundDone(3)); check(T.newDiploma(SKILL_BY_ID.rim.diploma));
  assert.deepEqual([...missing], []);
  assert.equal(spoken('KATT'), 'katt'); assert.equal(spoken('S'), 'S'); assert.equal(spoken('12'), '12');
});

test('lydfilene finnes for alle setningene', { skip: !existsSync(MANIFEST) && 'lydfilene er ikke laget (verktoy/lag-tale.py)' }, () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const missing = [...allPhrases(3000)].filter(p => !manifest[p]);
  assert.deepEqual(missing.slice(0, 10), [], `${missing.length} setninger mangler lydfil: kjør verktoy/lag-tale.py`);
  for (const f of new Set(Object.values(manifest)).values())
    assert.ok(existsSync(new URL('../public/lyd/tale/' + f, import.meta.url)), f);
});

// ─── Labyrinten ─────────────────────────────────────────────────────────
import { makeLevel, bfs, newFox, updateFox, releaseFox, CONFIG as MAZE } from '../public/spill/labyrint-kart.js';
import { placeItems, steer } from '../public/spill/slange.js';

const reachable = (grid, blocked, sx, sz) => {
  const seen = new Set([sx + ',' + sz]), q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (z + dz);
      if (grid[z + dz]?.[x + dx] !== 0 || seen.has(k) || blocked.has(k)) continue;
      seen.add(k); q.push([x + dx, z + dz]);
    }
  }
  return seen;
};

test('labyrinten: egget kan aldri nås uten dører, og de fleste dørene ligger på veien', () => {
  let req = 0, all = 0;
  for (let r = 0; r < 60; r++) {
    const l = makeLevel(), egg = Math.floor(l.egg.x) + ',' + Math.floor(l.egg.z), keys = l.doors.map(d => d.x + ',' + d.z);
    assert.ok(!reachable(l.grid, new Set(keys), 1, 1).has(egg), 'egget kan nås uten dører');
    req += keys.filter(k => !reachable(l.grid, new Set([k]), 1, 1).has(egg)).length; all += keys.length;
    assert.ok(l.doors.every(d => !(d.x <= 2 && d.z <= 2)), 'dør rett ved start');
    assert.equal(l.grid[Math.floor(l.fox.z)][Math.floor(l.fox.x)], 0);
    assert.equal(l.grid.length, MAZE.size * 2 + 1);
  }
  assert.ok(req / all > 0.6, `bare ${Math.round(100 * req / all)} % av dørene må passeres`);
  assert.ok(req / 60 >= 4, `i snitt ${req / 60} dører på veien`);
});

test('reven jager når den ser spilleren, og løper unna etter frislipp', () => {
  let fled = 0, deadEnds = 0;
  for (let r = 0; r < 40; r++) {
    const l = makeLevel(), g = l.grid, f = newFox(l.fox);
    // spilleren rett ved reven: reven skal fange (komme nær) innen kort tid
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => g[f.cz + dz][f.cx + dx] === 0 && g[f.cz + 2 * dz][f.cx + 2 * dx] === 0);
    if (!open) continue;
    const player = { x: f.cx + 2 * open[0] + 0.5, z: f.cz + 2 * open[1] + 0.5 };
    let t = 0;
    for (; t < 5000 && Math.hypot(f.x - player.x, f.z - player.z) > 0.5; t += 50)
      updateFox(g, f, 0.05, { cx: Math.floor(player.x), cz: Math.floor(player.z) }, t);
    assert.ok(t < 5000, 'reven fanget ikke spilleren den så');
    // Frislipp: reven skal løpe minst foxRetreat ruter unna, eller så langt det går uten å passere spilleren
    f.holding = true;
    const fromP = bfs(g, Math.floor(player.x), Math.floor(player.z)), fromF = bfs(g, f.cx, f.cz), df = fromP[f.cz][f.cx];
    let possible = 0;
    for (let z = 1; z < g.length - 1; z++) for (let x = 1; x < g.length - 1; x++)
      if (g[z][x] === 0 && fromF[z][x] === fromP[z][x] - df) possible = Math.max(possible, fromP[z][x]);
    releaseFox(g, f, player, t);
    for (let i = 0; i < 200 && f.flee; i++) updateFox(g, f, 0.05, null, t + i * 50);
    const d = fromP[f.cz][f.cx];
    assert.ok(d >= Math.min(MAZE.foxRetreat, possible), `reven stoppet ${d} ruter unna, kunne nådd ${possible}`);
    if (d >= MAZE.foxRetreat) fled++; else deadEnds++;
  }
  assert.ok(fled + deadEnds > 20, 'for få tilfeller testet');
});

// ─── Slangen ────────────────────────────────────────────────────────────
test('slangen: skiltene havner fritt, unna hodet og med avstand til hverandre', () => {
  for (let k = 0; k < 300; k++) {
    const cols = 9, rows = 14, snake = [[4, 7], [3, 7], [2, 7], [2, 8], [2, 9]];
    const items = [{ span: 1 }, { span: 4 }, { span: 2 }];
    const spots = placeItems(cols, rows, snake, items);
    assert.ok(spots, 'fant ikke plass');
    const cells = spots.map((s, i) => Array.from({ length: items[i].span }, (_, j) => [s.c + j, s.r]));
    for (const cs of cells) for (const [c, r] of cs) {
      assert.ok(c >= 0 && c < cols && r >= 0 && r < rows, 'utenfor brettet');
      assert.ok(!snake.some(([x, y]) => x === c && y === r), 'under slangen');
      assert.ok(Math.abs(c - 4) + Math.abs(r - 7) >= 4, 'for nær hodet');
    }
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++)
      for (const [c1, r1] of cells[a]) for (const [c2, r2] of cells[b]) assert.ok(Math.abs(r1 - r2) >= 2 || Math.abs(c1 - c2) >= 2, 'skiltene for tett');
  }
});

test('slangen: snur aldri rett bakover og svinger selv ved kanten', () => {
  const R = [1, 0], L = [-1, 0], U = [0, -1], D = [0, 1];
  assert.deepEqual(steer(9, 14, [4, 4], R, L), R);      // bakover ignoreres
  assert.deepEqual(steer(9, 14, [4, 4], R, U), U);
  assert.deepEqual(steer(9, 14, [8, 2], R, null), D);   // høyre kant, øverst: svinger ned mot midten
  assert.deepEqual(steer(9, 14, [8, 12], R, null), U);  // høyre kant, nederst: svinger opp
  assert.deepEqual(steer(9, 14, [8, 0], R, null), D);   // hjørne: eneste vei
  assert.deepEqual(steer(9, 14, [0, 13], D, null), R);
});
