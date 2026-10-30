// Alt spillet sier, samlet ett sted. Hver funksjon gir en liste med biter som spilles etter hverandre
// (lyd.say). Bitene er laget som lydfiler på forhånd med verktoy/lag-tale.py; allPhrases() lister
// alle bitene som trengs. Nye setninger legges inn her, så de kommer med neste gang lydfilene lages.

import { ANIMALS, COLORS, profileName } from './lagring.js';
import { SKILLS, SPELL_SKILLS, SENTENCE_SKILLS, ALPHA_SKILLS, LETTER_WORDS, ALL_SPELL_WORDS, ALL_SENTENCES, EXTRA_WORDS, sentenceWords, ALPHABET, skillsOf, skillLabel, makeTask, makeMathPuzzle } from './oppgaver.js';
import { MILESTONES, EGG_KINDS, EGG_NAMES, eggKind } from './belonning.js';

export const GAME_NAMES = { flakse: 'Flakse-fuglen', labyrint: 'Labyrinten', slange: 'Slangen', ordbygger: 'Ordbyggeren', tallbygger: 'Tallbyggeren', ordtog: 'Ordtoget',
  bokstavrekka: 'Bokstavrekka', prikk: 'Prikk til prikk', maling: 'Bokstavmaling' };
const MAX_NUMBER = 1000; // tall som finnes som lydfil (større tall leses av enhetens stemme)
const stars = n => (n === 1 ? 'stjerne.' : 'stjerner.');
const cap = s => s[0].toUpperCase() + s.slice(1);
const GROUP_NAMES = { matte: 'Matte-diplomer', norsk: 'Norsk-diplomer', stave: 'Stave-diplomer', ekstra: 'Stjerne-diplomer' };
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
  emptyEgg: () => ['Her kommer neste egg.', 'Ti egg blir til en diamant!'],
  diamond: () => ['En diamant.', 'Den er laget av ti egg.'],
  crown: () => ['En krone.', 'Den er laget av ti diamanter.'],
  newDiamond: () => ['Ti egg ble til en diamant!'],
  newCrown: () => ['Ti diamanter ble til en krone!'],
  diplomaGroup: (group, n) => [`${GROUP_NAMES[group]}.`, ...(n ? ['Du har', String(n), n === 1 ? 'diplom.' : 'diplomer.'] : ['Spill for å få det første!'])],
  subject: (subject, level) => {
    const list = skillsOf(subject);
    if (level >= list.length) return [`Du kan alt i ${subject}! Fantastisk!`];
    return [subject === 'matte' ? 'Matte.' : 'Norsk.', 'Nå øver du på', skillLabel(list[level].id) + '.'];
  },
  gameName: id => [`${GAME_NAMES[id]}.`, 'Trykk en gang til for å spille.'],
  comingSoon: id => [`${GAME_NAMES[id]} kommer snart!`],

  // Oppgaver
  task: t => [].concat(t.speak), // én setning, eller biter («Hva er», «7», «ganger», «8»)
  right: () => [RIGHT[Math.floor(Math.random() * RIGHT.length)]],
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

  // Tallbyggeren
  mathStart: () => ['Dra tallene på plass, eller trykk på dem.'],

  // Bokstavrekka, Prikk til prikk og Bokstavmaling
  alphaRowStart: () => ['Finn bokstavene som mangler.', 'Dra dem på plass, eller trykk på dem.'],
  dotsStart: first => ['Trykk på bokstavene i rekkefølge.', 'Begynn på', first + '.'],
  dotsDone: name => [`Se, ${name}!`],
  paint: L => ['Fargelegg bokstaven', L + '.', `${L} som i ${LETTER_WORDS[L][0]}.`],
  letterWord: L => [`${L} som i ${LETTER_WORDS[L][0]}.`],
  paintReady: () => ['Trykk på haken når du er ferdig.'],
  paintDone: n => ['Så fint!', 'Du har fargelagt', String(n), n === 1 ? 'bokstav.' : 'bokstaver.'],
  poster: n => ['Alfabetplakaten.', 'Du har fargelagt', String(n), n === 1 ? 'bokstav.' : 'bokstaver.'],

  // Ordtoget
  sentenceStart: () => ['Lag setningen med ordene.', 'Dra dem på plass, eller trykk på dem.'],
  sentence: s => [s],

  // Labyrinten
  mazeStart: () => ['Finn gull-egget!', 'Trykk på pilene for å gå.'],
  foxCaught: () => ['Reven har fanget deg!', 'Svar riktig for å komme fri.'],
  foxFree: () => ['Riktig!', 'Du er fri. Løp!'],
  foundEgg: kind => [FOUND[kind]],

  // Telefon/pad holdt på tvers
  rotate: () => ['Snu skjermen, så den står på høykant.'],
};
const RIGHT = ['Riktig!', 'Flott!', 'Supert!', 'Bra!'];
// Bildene i Prikk til prikk (spill/prikk.js har formene), som «Se, en fisk!»
export const DOT_PICTURE_NAMES = ['en stjerne', 'et hjerte', 'en fisk', 'et hus', 'en rakett', 'et tre', 'et egg', 'en diamant', 'en båt', 'en krone'];

// Alle oppgavesetningene og svarene en ferdighet kan gi. Oppgavene lages tilfeldig fra små tallområder og
// ordlister, så mange trekk finner alle (testen i test/kjerne.test.mjs sjekker at ingen mangler).
export function taskPhrases(samples = 4000) {
  const out = new Set();
  for (const s of SKILLS) for (let i = 0; i < samples; i++) {
    const t = makeTask(s.id);
    for (const p of T.task(t)) out.add(p);
  }
  return out;
}

export function allPhrases(samples) {
  const out = new Set(taskPhrases(samples));
  const add = parts => parts.forEach(p => out.add(p));
  for (const f of [T.whoAreYou, T.pickAnimalFirst, T.pickAnimalNew, T.emptyFrame, T.emptyEgg, T.diamond, T.crown, T.newDiamond, T.newCrown, T.flapStart, T.snakeStart, T.rotate, T.mazeStart, T.foxCaught, T.foxFree]) add(f());
  for (let n = 1; n <= 3; n++) { add(T.foundEgg(EGG_KINDS[n])); add(T.newEggs([{ stars: n }])); }
  for (let mask = 0; mask < 8; mask++) add(T.eggsHave({ gull: mask & 1, solv: mask & 2, bronse: mask & 4 }));
  for (const a of ANIMALS) {
    add(T.animalPicked(a));
    for (const c of COLORS) { const p = { animal: a.id, color: c.id }; add(T.figure(p)); add(T.welcome(p)); }
  }
  for (let n = 0; n <= MAX_NUMBER; n++) { add(T.starsHave(n)); add(T.newEggs(Array(n).fill({ stars: 3 }))); add(T.roundDone(n)); }
  for (const m of MILESTONES) add(T.newDiploma(m.text));
  for (const s of [...SKILLS, ...SPELL_SKILLS, ...SENTENCE_SKILLS, ...ALPHA_SKILLS]) add(T.newDiploma(s.diploma));
  for (const L of ALPHABET) { add(T.letter(L.toLowerCase())); add(T.paint(L)); add(T.dotsStart(L)); add(T.dotsStart(L.toLowerCase())); }
  for (let n = 0; n <= 29; n++) { add(T.paintDone(n)); add(T.poster(n)); }
  for (const name of DOT_PICTURE_NAMES) add(T.dotsDone(name));
  add(T.alphaRowStart()); add(T.paintReady()); add(['Hvilken bokstav mangler?', 'Hvilke bokstaver mangler?']);
  for (const s of ALL_SENTENCES) { out.add(`Lag setningen: ${s}`); add(T.sentence(s)); for (const w of sentenceWords(s)) add(T.word(w)); }
  for (const w of EXTRA_WORDS) add(T.word(w));
  add(T.sentenceStart());
  for (const w of ALL_SPELL_WORDS) { out.add(`Stav ordet ${w}.`); add(T.word(w)); }
  for (const L of ALPHABET) add(T.letter(L));
  add(T.spellStart()); add(T.mathStart());
  for (const g of Object.keys(GROUP_NAMES)) for (let n = 0; n <= 2; n++) add(T.diplomaGroup(g, n));
  for (const s of skillsOf('matte')) for (let i = 0; i < (samples ?? 4000); i++) for (const p of [].concat(makeMathPuzzle(s.id).speak)) out.add(p);
  for (const id of Object.keys(GAME_NAMES)) {
    add(T.gameName(id)); add(T.comingSoon(id));
    for (let n = 1; n <= 3; n++) add(T.egg({ game: id, stars: n }));
  }
  for (const subject of ['matte', 'norsk']) for (let l = 0; l <= skillsOf(subject).length; l++) add(T.subject(subject, l));
  RIGHT.forEach(r => out.add(r));
  add(['Ikke helt.', 'Riktig svar er']); add(T.tryAgain());
  return out;
}
