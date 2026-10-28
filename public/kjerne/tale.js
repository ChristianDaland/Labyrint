// Alt spillet sier, samlet ett sted. Hver funksjon gir en liste med biter som spilles etter hverandre
// (lyd.say). Bitene er laget som lydfiler på forhånd med verktoy/lag-tale.py; allPhrases() lister
// alle bitene som trengs. Nye setninger legges inn her, så de kommer med neste gang lydfilene lages.

import { ANIMALS, COLORS, profileName } from './lagring.js';
import { SKILLS, SPELL_SKILLS, ALL_SPELL_WORDS, ALPHABET, skillsOf, skillLabel, makeTask } from './oppgaver.js';
import { MILESTONES, EGG_KINDS, EGG_NAMES, eggKind } from './belonning.js';

export const GAME_NAMES = { flakse: 'Flakse-fuglen', labyrint: 'Labyrinten', slange: 'Slangen', ordbygger: 'Ordbyggeren' };
const MAX_NUMBER = 300; // tall som finnes som lydfil (større tall leses av enhetens stemme)
const stars = n => (n === 1 ? 'stjerne.' : 'stjerner.');
const cap = s => s[0].toUpperCase() + s.slice(1);
const FOUND = { gull: 'Du fant gull-egget!', solv: 'Du fant sølvegget!', bronse: 'Du fant bronse-egget!' };

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
  // counts = { gull, solv, bronse } (countEggs): «Du har 2 gullegg og 1 sølvegg.»
  eggsHave: counts => {
    const kinds = Object.keys(EGG_NAMES).filter(k => counts[k] > 0);
    if (!kinds.length) return ['Du har', '0', 'egg.'];
    const out = ['Du har'];
    kinds.forEach((k, i) => {
      if (i && i === kinds.length - 1) out.push('og');
      out.push(String(counts[k]), EGG_NAMES[k] + (i === kinds.length - 1 ? '.' : ''));
    });
    return out;
  },
  newEggs: eggs => (eggs.length === 1 ? [`Du fikk et nytt ${EGG_NAMES[eggKind(eggs[0])]}!`] : ['Du fikk', String(eggs.length), 'nye egg!']),
  newDiploma: text => ['Nytt diplom!', text],
  diploma: text => [text],
  emptyFrame: () => ['Her kan det komme et nytt diplom!'],
  egg: e => [`${cap(EGG_NAMES[eggKind(e)])} fra ${GAME_NAMES[e.game] || 'et spill'}.`, String(e.stars), stars(e.stars)],
  emptyEgg: () => ['Her kommer neste egg. Spill for å vinne det!'],
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
  tryAgain: () => ['Ikke helt.', 'Prøv igjen!'],

  // Flakse-fuglen
  flapStart: () => ['Trykk for å flakse.', 'Fly gjennom riktig svar!'],

  // Slangen
  snakeStart: () => ['Trykk der slangen skal gå.', 'Spis riktig svar!'],
  roundDone: n => ['Bra jobba!', 'Du fikk', String(n), stars(n)],

  // Ordbyggeren
  spellStart: () => ['Bygg ordet med bokstavene.', 'Dra dem på plass, eller trykk på dem.'],
  letter: L => [L + '.'],            // bokstavnavnet, til bokstavlydene er spilt inn (lyd.LETTER_FILES)
  word: w => [w.toLowerCase() + '.'], // ordet leses når det er ferdig bygget

  // Labyrinten
  mazeStart: () => ['Finn gull-egget!', 'Trykk på pilene for å gå.'],
  foxCaught: () => ['Reven har fanget deg!', 'Svar riktig for å komme fri.'],
  foxFree: () => ['Riktig!', 'Du er fri. Løp!'],
  foundEgg: kind => [FOUND[kind]],

  // Telefon/pad holdt på tvers
  rotate: () => ['Snu skjermen, så den står på høykant.'],
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
  for (const f of [T.whoAreYou, T.pickAnimalFirst, T.pickAnimalNew, T.emptyFrame, T.emptyEgg, T.flapStart, T.snakeStart, T.rotate, T.mazeStart, T.foxCaught, T.foxFree]) add(f());
  for (let n = 1; n <= 3; n++) { add(T.foundEgg(EGG_KINDS[n])); add(T.newEggs([{ stars: n }])); }
  for (let mask = 0; mask < 8; mask++) add(T.eggsHave({ gull: mask & 1, solv: mask & 2, bronse: mask & 4 }));
  for (const a of ANIMALS) {
    add(T.animalPicked(a));
    for (const c of COLORS) { const p = { animal: a.id, color: c.id }; add(T.figure(p)); add(T.welcome(p)); }
  }
  for (let n = 0; n <= MAX_NUMBER; n++) { add(T.starsHave(n)); add(T.newEggs(Array(n).fill({ stars: 3 }))); add(T.roundDone(n)); }
  for (const m of MILESTONES) add(T.newDiploma(m.text));
  for (const s of [...SKILLS, ...SPELL_SKILLS]) add(T.newDiploma(s.diploma));
  for (const w of ALL_SPELL_WORDS) { out.add(`Stav ordet ${w}.`); add(T.word(w)); }
  for (const L of ALPHABET) add(T.letter(L));
  add(T.spellStart());
  for (const id of Object.keys(GAME_NAMES)) {
    add(T.gameName(id)); add(T.comingSoon(id));
    for (let n = 1; n <= 3; n++) add(T.egg({ game: id, stars: n }));
  }
  for (const subject of ['matte', 'norsk']) for (let l = 0; l <= skillsOf(subject).length; l++) add(T.subject(subject, l));
  RIGHT.forEach(r => out.add(r));
  add(['Ikke helt.', 'Riktig svar er']); add(T.tryAgain());
  return out;
}
