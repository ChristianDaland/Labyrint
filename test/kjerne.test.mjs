// Tester for kjernen i public/kjerne/. Kjør med: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS, SKILL_BY_ID, skillsOf, makeTask } from '../public/kjerne/oppgaver.js';
import { newLearning, newStats, chooseSkill, recordAnswer, nextTask, progress, today, WINDOW } from '../public/kjerne/laering.js';
import { starsFor, finishRound, awardSkills, newRewards } from '../public/kjerne/belonning.js';
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
  assert.deepEqual(p.stats.right, { matte: 1, norsk: 1 });
  assert.deepEqual(p.stats.wrong, { matte: 0, norsk: 1 });
  assert.deepEqual(p.stats.days['2026-10-28'], { right: 2, wrong: 1 });
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

test('runde gir gullegg, stjerner og milepæl-diplomer én gang', () => {
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
  assert.deepEqual(p.stats.right, { matte: 0, norsk: 0 });
  assert.deepEqual(p.learning.level, { matte: 0, norsk: 0 });
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
  check(T.newEggs(1)); check(T.newEggs(3)); check(T.egg({ game: 'flakse', stars: 2 })); check(T.subject('norsk', 99));
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
