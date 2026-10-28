// Alt spillet sier, samlet ett sted. Hver funksjon gir en liste med biter som spilles etter hverandre
// (lyd.say). Bitene er laget som lydfiler på forhånd med verktoy/lag-tale.py; allPhrases() lister
// alle bitene som trengs. Nye setninger legges inn her, så de kommer med neste gang lydfilene lages.

import { ANIMALS, COLORS, profileName } from './lagring.js';
import { SKILLS, skillsOf, skillLabel, makeTask } from './oppgaver.js';
import { MILESTONES } from './belonning.js';

export const GAME_NAMES = { flakse: 'Flakse-fuglen', labyrint: 'Labyrinten' };
const MAX_NUMBER = 300; // tall som finnes som lydfil (større tall leses av enhetens stemme)
const stars = n => (n === 1 ? 'stjerne.' : 'stjerner.');

// Svaralternativer slik de skal uttales: «KATT» → «katt» (store bokstaver kan bli stavet), enkeltbokstaver som de er
export const spoken = option => /^[A-ZÆØÅ]{2,}$/.test(option) ? option.toLowerCase() : option;

export const T = {
  // Rommet
  whoAreYou: () => ['Hvem er du? Trykk på figuren din.'],
  pickAnimalFirst: () => ['Hei! Velg et dyr som skal være deg.'],
  pickAnimalNew: () => ['Lag en ny figur. Velg et dyr.'],
  animalPicked: a => [a.name + '.', 'Velg en farge.'],
  figure: p => [profileName(p) + '.'],
  hello: p => [`Hei, ${profileName(p)}!`],
  welcome: p => [`Hei, ${profileName(p)}!`, 'Dette er rommet ditt.'],
  starsHave: n => ['Du har', String(n), stars(n)],
  eggsHave: n => ['Du har', String(n), 'gullegg.'],
  newEggs: n => (n === 1 ? ['Du fikk et nytt gullegg!'] : ['Du fikk', String(n), 'nye gullegg!']),
  newDiploma: text => ['Nytt diplom!', text],
  diploma: text => [text],
  emptyFrame: () => ['Her kan det komme et nytt diplom!'],
  egg: e => [`Gullegg fra ${GAME_NAMES[e.game] || 'et spill'}.`, String(e.stars), stars(e.stars)],
  emptyEgg: () => ['Her kommer neste gullegg. Spill for å vinne det!'],
  subject: (subject, level) => {
    const list = skillsOf(subject);
    if (level >= list.length) return [`Du kan alt i ${subject}! Fantastisk!`];
    return [subject === 'matte' ? 'Matte.' : 'Norsk.', 'Nå øver du på', skillLabel(list[level].id) + '.'];
  },
  gameName: id => [`${GAME_NAMES[id]}.`, 'Trykk en gang til for å spille.'],
  comingSoon: id => [`${GAME_NAMES[id]} kommer snart!`],

  // Oppgaver
  task: t => [t.speak],
  right: () => [RIGHT[Math.floor(Math.random() * RIGHT.length)]],
  wrong: t => ['Ikke helt.', 'Riktig svar er', spoken(t.options[t.answer]) + '.'],

  // Flakse-fuglen
  flapStart: () => ['Trykk for å flakse.', 'Fly gjennom riktig svar!'],
  roundDone: n => ['Bra jobba!', 'Du fikk', String(n), stars(n)],
};
const RIGHT = ['Riktig!', 'Flott!', 'Supert!', 'Bra!'];

// Alle oppgavesetningene og svarene en ferdighet kan gi. Oppgavene lages tilfeldig fra små tallområder og
// ordlister, så mange trekk finner alle (testen i test/kjerne.test.mjs sjekker at ingen mangler).
export function taskPhrases(samples = 4000) {
  const out = new Set();
  for (const s of SKILLS) for (let i = 0; i < samples; i++) {
    const t = makeTask(s.id);
    out.add(t.speak);
    for (const o of t.options) out.add(spoken(o) + '.');
  }
  return out;
}

export function allPhrases(samples) {
  const out = new Set(taskPhrases(samples));
  const add = parts => parts.forEach(p => out.add(p));
  for (const f of [T.whoAreYou, T.pickAnimalFirst, T.pickAnimalNew, T.emptyFrame, T.emptyEgg, T.flapStart]) add(f());
  for (const a of ANIMALS) {
    add(T.animalPicked(a));
    for (const c of COLORS) { const p = { animal: a.id, color: c.id }; add(T.figure(p)); add(T.welcome(p)); }
  }
  for (let n = 0; n <= MAX_NUMBER; n++) { add(T.starsHave(n)); add(T.eggsHave(n)); add(T.newEggs(n)); add(T.roundDone(n)); }
  for (const m of MILESTONES) add(T.newDiploma(m.text));
  for (const s of SKILLS) add(T.newDiploma(s.diploma));
  for (const id of Object.keys(GAME_NAMES)) {
    add(T.gameName(id)); add(T.comingSoon(id));
    for (let n = 1; n <= 3; n++) add(T.egg({ game: id, stars: n }));
  }
  for (const subject of ['matte', 'norsk']) for (let l = 0; l <= skillsOf(subject).length; l++) add(T.subject(subject, l));
  RIGHT.forEach(r => out.add(r));
  add(['Ikke helt.', 'Riktig svar er']);
  return out;
}
