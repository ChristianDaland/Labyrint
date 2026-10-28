// Stjerner, egg (gull, sølv, bronse) og diplomer. Diplomene viser helst hva spilleren har lært («Du kan pluss opp til 10!»),
// ikke bare at hen har spilt mye.

import { SKILL_BY_ID } from './oppgaver.js';

// seenEggs/seenDiplomas: hvor mange rommet allerede har vist, så nye kan feires når man kommer tilbake
export const newRewards = () => ({ eggs: [], stars: 0, diplomas: [], foxEscapes: 0, seenEggs: 0, seenDiplomas: 0 });

// 1–3 stjerner etter andelen riktige (av 10: 0–5 → 1, 6–8 → 2, 9–10 → 3)
export function starsFor(right, total) {
  const r = total ? right / total : 0;
  return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
}

// Hver runde gir ett egg, og stjernene avgjør hvilket: 3 → gull, 2 → sølv, 1 → bronse
export const EGG_KINDS = { 3: 'gull', 2: 'solv', 1: 'bronse' };
export const EGG_NAMES = { gull: 'gullegg', solv: 'sølvegg', bronse: 'bronseegg' };
export const eggKind = e => EGG_KINDS[e.stars];
export const countEggs = eggs => {
  const n = { gull: 0, solv: 0, bronse: 0 };
  for (const e of eggs) n[eggKind(e)]++;
  return n;
};

// Milepæl-diplomer. `check(profile, round)` sjekkes når en runde er ferdig.
export const MILESTONES = [
  { id: 'egg1', text: 'Ditt første egg!', check: p => p.rewards.eggs.length >= 1 },
  { id: 'egg5', text: 'Fem egg!', check: p => p.rewards.eggs.length >= 5 },
  { id: 'egg10', text: 'Ti egg!', check: p => p.rewards.eggs.length >= 10 },
  { id: 'egg25', text: 'Tjuefem egg!', check: p => p.rewards.eggs.length >= 25 },
  { id: 'stjerner3', text: 'Ditt første gullegg! Tre stjerner på én runde!', check: (p, round) => round?.stars === 3 },
  { id: 'gull5', text: 'Fem gullegg!', check: p => countEggs(p.rewards.eggs).gull >= 5 },
  { id: 'matte50', text: '50 riktige svar i matte!', check: p => p.stats.right.matte >= 50 },
  { id: 'norsk50', text: '50 riktige svar i norsk!', check: p => p.stats.right.norsk >= 50 },
  { id: 'matte200', text: '200 riktige svar i matte!', check: p => p.stats.right.matte >= 200 },
  { id: 'norsk200', text: '200 riktige svar i norsk!', check: p => p.stats.right.norsk >= 200 },
  { id: 'rev5', text: 'Du har rømt fra reven fem ganger!', check: p => p.rewards.foxEscapes >= 5 },
];

const has = (p, id) => p.rewards.diplomas.some(d => d.id === id);
function award(p, id, text, now) {
  if (has(p, id)) return null;
  const d = { id, text, date: now.toISOString() };
  p.rewards.diplomas.push(d);
  return d;
}

// Diplomer for ferdigheter som er mestret (hendelser fra recordAnswer i laering.js)
export function awardSkills(profile, events, now = new Date()) {
  return events.filter(e => e.type === 'mastered')
    .map(e => award(profile, 'kan-' + e.skill, SKILL_BY_ID[e.skill].diploma, now)).filter(Boolean);
}

// En runde er ferdig. Gir stjerner og et egg (gull, sølv eller bronse), og returnerer nye milepæl-diplomer.
// `round` = { game: 'flakse' | 'labyrint', right, total, foxEscapes? }
export function finishRound(profile, round, now = new Date()) {
  const stars = starsFor(round.right, round.total);
  const egg = { game: round.game, stars, date: now.toISOString() };
  profile.rewards.eggs.push(egg);
  profile.rewards.stars += stars;
  profile.rewards.foxEscapes += round.foxEscapes || 0;
  const diplomas = MILESTONES.filter(m => m.check(profile, { ...round, stars }))
    .map(m => award(profile, m.id, m.text, now)).filter(Boolean);
  return { egg, stars, diplomas };
}
