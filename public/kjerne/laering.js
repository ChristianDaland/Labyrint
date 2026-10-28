// Læringsmotoren: velger neste oppgave, husker svarene og flytter spilleren opp og ned
// mellom ferdighetene. Felles for alle spillene, så fremgangen henger sammen.
//
// Per fag finnes et «nivå» = indeksen til ferdigheten spilleren øver på nå (se SKILLS i oppgaver.js).
// For hver ferdighet huskes de siste WINDOW svarene. Opp et hakk ved UP riktige av WINDOW,
// ned et hakk ved under DOWN. Oppgavene fordeles omtrent 70 % nå, 20 % repetisjon, 10 % smakebit.

import { SKILL_BY_ID, skillsOf, makeTask } from './oppgaver.js';

export const WINDOW = 10, UP = 8, DOWN = 5;
export const SUBJECTS = ['matte', 'norsk'];

export const newLearning = () => ({ level: { matte: 0, norsk: 0 }, recent: {} });
export const newStats = () => ({ days: {}, right: { matte: 0, norsk: 0 }, wrong: { matte: 0, norsk: 0 } });

const errorRate = arr => arr && arr.length ? 1 - arr.reduce((a, b) => a + b, 0) / arr.length : 0.5;

// Ferdigheten neste oppgave skal øve på. `subject` er 'matte', 'norsk' eller 'begge'.
export function chooseSkill(learning, subject = 'begge', rnd = Math.random) {
  const s = SUBJECTS.includes(subject) ? subject : rnd() < 0.5 ? 'matte' : 'norsk';
  const list = skillsOf(s), cur = Math.min(learning.level[s], list.length - 1);
  const r = rnd();
  if (r < 0.1 && cur + 1 < list.length) return list[cur + 1]; // smakebit på det neste
  if (r < 0.3 && cur > 0) { // repetisjon: ferdigheter han ofte bommer på, kommer oftere
    const done = list.slice(0, cur), weights = done.map(k => 1 + 4 * errorRate(learning.recent[k.id]));
    let x = rnd() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < done.length; i++) if ((x -= weights[i]) <= 0) return done[i];
    return done[done.length - 1];
  }
  return list[cur];
}

export const nextTask = (profile, rnd) => makeTask(chooseSkill(profile.learning, profile.settings.subject, rnd).id);

export const today = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Registrerer et svar. Returnerer hendelser: { type: 'mastered' | 'stepDown', skill }.
export function recordAnswer(profile, skillId, correct, now = new Date()) {
  const skill = SKILL_BY_ID[skillId];
  if (!skill) return [];
  const { learning, stats } = profile, s = skill.subject;
  const recent = (learning.recent[skillId] ||= []);
  recent.push(correct ? 1 : 0);
  if (recent.length > WINDOW) recent.shift();

  (correct ? stats.right : stats.wrong)[s]++;
  const day = (stats.days[today(now)] ||= { right: 0, wrong: 0 });
  correct ? day.right++ : day.wrong++;

  // Bare ferdigheten han øver på nå kan flytte ham opp eller ned
  const list = skillsOf(s), cur = learning.level[s];
  if (list[cur]?.id !== skillId || recent.length < WINDOW) return [];
  const right = recent.reduce((a, b) => a + b, 0);
  if (right >= UP) {
    learning.level[s] = cur + 1;
    return [{ type: 'mastered', skill: skillId }];
  }
  if (right < DOWN && cur > 0) {
    // Tilbake til forrige ferdighet med blanke ark på begge, så det må øves ordentlig før han går opp igjen
    learning.level[s] = cur - 1;
    learning.recent[list[cur - 1].id] = [];
    learning.recent[skillId] = [];
    return [{ type: 'stepDown', skill: skillId }];
  }
  return [];
}

// Hvor langt spilleren er kommet i et fag (0–1), for rommet og senere oversikter
export const progress = (learning, subject) => Math.min(learning.level[subject], skillsOf(subject).length) / skillsOf(subject).length;
