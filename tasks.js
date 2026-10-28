'use strict';
// Oppgaver for dørene, tilpasset 1. og 2. trinn (LK20).
// En oppgave er { q, pic, options[3], answer, speak }: `answer` er indeksen til riktig svar
// og sendes aldri til mobilen. `speak` leses opp på mobilen (mange kan ikke lese ennå).

const rand = n => Math.floor(Math.random() * n);
const between = (a, b) => a + rand(b - a + 1);
const pick = arr => arr[rand(arr.length)];
const shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) { const j = rand(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
};

// Bygger en flervalgsoppgave med riktig svar og to ulike feilsvar
function task(q, correct, wrong, { pic = null, speak = q } = {}) {
  const options = [String(correct)];
  for (const w of wrong) if (options.length < 3 && !options.includes(String(w))) options.push(String(w));
  shuffle(options);
  return { q, pic, options, answer: options.indexOf(String(correct)), speak };
}

// Tall rundt n (innenfor min..max), brukt som feilsvar
const nearby = (n, min, max) => shuffle([n - 1, n + 1, n - 2, n + 2, n - 3, n + 3].filter(v => v >= min && v <= max));

// ─── Matte ──────────────────────────────────────────────────────────────
const THINGS = [['🍎', 'epler'], ['⭐', 'stjerner'], ['🐟', 'fisker'], ['🎈', 'ballonger'],
  ['🐞', 'marihøner'], ['🌸', 'blomster'], ['⚽', 'baller'], ['🦆', 'ender']];

const MATTE = {
  count(g) {
    const n = g === 1 ? between(2, 10) : between(8, 20);
    const [icon, name] = pick(THINGS);
    const rows = [];
    for (let i = 0; i < n; i += 5) rows.push(icon.repeat(Math.min(5, n - i))); // femmere er lettere å telle
    return task(`Hvor mange ${name}?`, n, nearby(n, 1, 25), { pic: rows.join('\n') });
  },
  plus(g) {
    const max = g === 1 ? 10 : 20;
    const a = between(g === 1 ? 0 : 2, max - 2), b = between(g === 1 ? 1 : 2, max - a);
    return task(`${a} + ${b} = ?`, a + b, nearby(a + b, 0, max + 3), { speak: `Hva er ${a} pluss ${b}?` });
  },
  minus(g) {
    const a = g === 1 ? between(2, 10) : between(10, 20), b = between(1, g === 1 ? a : Math.min(a, 10));
    return task(`${a} − ${b} = ?`, a - b, nearby(a - b, 0, 20), { speak: `Hva er ${a} minus ${b}?` });
  },
  biggest(g) {
    const max = g === 1 ? 20 : 99, nums = new Set();
    while (nums.size < 3) nums.add(between(g === 1 ? 0 : 10, max));
    const [a, b, c] = [...nums], top = Math.max(a, b, c);
    return task('Hvilket tall er størst?', top, [a, b, c].filter(v => v !== top));
  },
  after(g) {
    const n = g === 1 ? between(1, 19) : between(10, 98);
    if (g === 2 && Math.random() < 0.5)
      return task(`Hvilket tall kommer før ${n}?`, n - 1, [n + 1, n - 2, n + 2]);
    return task(`Hvilket tall kommer etter ${n}?`, n + 1, [n - 1, n + 2, n]);
  },
  tenFriends() { // tiervenner
    const a = between(1, 9);
    return task(`${a} + ? = 10`, 10 - a, nearby(10 - a, 0, 10), { speak: `${a} pluss hva blir 10?` });
  },
  double() {
    const n = between(1, 10);
    return task(`Hva er det dobbelte av ${n}?`, n * 2, [n * 2 - 1, n * 2 + 1, n + 1, n * 2 + 2]);
  },
  sequence() { // tallrekker
    const step = pick([2, 5, 10]), start = step === 2 ? between(0, 10) : step * between(0, 5);
    const seq = [0, 1, 2].map(i => start + i * step), next = start + 3 * step;
    return task(`Hva kommer så?\n${seq.join(', ')}, ?`, next, [next + 1, next - 1, next + step, next + 2 * step],
      { speak: `Hvilket tall kommer så? ${seq.join(', ')}` });
  },
};
const MATTE_BY_GRADE = {
  1: ['count', 'plus', 'minus', 'biggest', 'after'],
  2: ['count', 'plus', 'minus', 'biggest', 'after', 'tenFriends', 'double', 'sequence'],
};

// ─── Norsk ──────────────────────────────────────────────────────────────
// [ord, bilde, antall stavelser]. Bare ord der første bokstav er lyden man hører først.
const WORDS = [
  ['fisk', '🐟', 1], ['katt', '🐱', 1], ['hund', '🐶', 1], ['hest', '🐴', 1], ['ku', '🐮', 1],
  ['gris', '🐷', 1], ['sau', '🐑', 1], ['mus', '🐭', 1], ['bil', '🚗', 1], ['sol', '☀️', 1],
  ['måne', '🌙', 2], ['hus', '🏠', 1], ['eple', '🍎', 2], ['banan', '🍌', 2], ['is', '🍦', 1],
  ['ball', '⚽', 1], ['bok', '📖', 1], ['tog', '🚂', 1], ['båt', '⛵', 1], ['fly', '✈️', 1],
  ['ugle', '🦉', 2], ['and', '🦆', 1], ['rev', '🦊', 1], ['bjørn', '🐻', 1], ['løve', '🦁', 2],
  ['tre', '🌳', 1], ['nøkkel', '🔑', 2], ['egg', '🥚', 1], ['ost', '🧀', 1], ['pære', '🍐', 2],
  ['sko', '👟', 1], ['elefant', '🐘', 3], ['sebra', '🦓', 2], ['ape', '🐒', 2], ['frosk', '🐸', 1],
  ['kake', '🎂', 2], ['gave', '🎁', 2], ['rakett', '🚀', 2], ['sykkel', '🚲', 2], ['buss', '🚌', 1],
  ['hatt', '🎩', 1], ['bie', '🐝', 2], ['sopp', '🍄', 1], ['tomat', '🍅', 2], ['melk', '🥛', 1],
  ['jordbær', '🍓', 2], ['gulrot', '🥕', 2], ['paraply', '☂️', 3], ['pingvin', '🐧', 2],
  ['hval', '🐋', 1], ['kanin', '🐰', 2], ['sommerfugl', '🦋', 3], ['ananas', '🍍', 3],
  ['telefon', '📱', 3], ['krokodille', '🐊', 4],
];
const RHYMES = [['sol', 'stol', 'fiol'], ['bil', 'pil', 'smil'], ['hus', 'mus', 'lus', 'krus'],
  ['katt', 'hatt', 'natt'], ['ball', 'hall', 'fall'], ['is', 'gris', 'ris', 'pris'], ['hest', 'fest', 'vest'],
  ['fisk', 'disk'], ['ost', 'frost', 'kost'], ['mann', 'vann', 'spann'], ['bok', 'krok'], ['sko', 'to', 'ro'],
  ['kake', 'bake'], ['båt', 'gråt']];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ';
const FIRST_LETTERS = 'ABDEFGHIKLMNOPRSTU'; // feilsvar for «hvilken bokstav begynner …»
const VOWELS = 'AEIOUYÆØÅ';
const up = s => s.toUpperCase();
const others = (pool, not, n = 2) => shuffle([...pool].filter(c => c !== not)).slice(0, n);

const NORSK = {
  firstLetter() {
    const [w, pic] = pick(WORDS), c = up(w[0]);
    return task('Hvilken bokstav begynner ordet med?', c, others(FIRST_LETTERS, c), { pic, speak: `Hvilken bokstav begynner ${w} med?` });
  },
  whatIsThis(g) {
    const [w, pic] = pick(g === 1 ? WORDS.filter(x => x[0].length <= 5) : WORDS);
    const wrong = shuffle(WORDS.filter(x => x[0] !== w && x[0][0] !== w[0])).map(x => up(x[0]));
    return task('Hva er dette?', up(w), wrong, { pic, speak: 'Hva er dette? Finn ordet.' });
  },
  smallLetter() {
    const c = pick(ALPHABET);
    return task(`Finn den lille bokstaven til ${c}`, c.toLowerCase(), others(ALPHABET.toLowerCase(), c.toLowerCase()),
      { pic: c, speak: `Finn den lille bokstaven til ${c}.` });
  },
  nextLetter() {
    const i = rand(ALPHABET.length - 1), c = ALPHABET[i];
    return task(`Hvilken bokstav kommer etter ${c}?`, ALPHABET[i + 1], others(ALPHABET, ALPHABET[i + 1], 4));
  },
  missingLetter() {
    const [w, pic] = pick(WORDS.filter(x => x[0].length <= 5 && [...x[0]].some(ch => VOWELS.includes(up(ch)))));
    const W = up(w), i = [...W].findIndex(ch => VOWELS.includes(ch));
    const shown = [...W].map((ch, j) => j === i ? '_' : ch).join(' ');
    return task(`Hvilken bokstav mangler?\n${shown}`, W[i], others('AEIOU', W[i]), { pic, speak: `Hvilken bokstav mangler i ${w}?` });
  },
  rhyme() {
    const group = pick(RHYMES), [w, match] = shuffle([...group]);
    const wrong = shuffle(RHYMES.filter(r => r !== group).flat()).map(up);
    return task(`Hva rimer på ${up(w)}?`, up(match), wrong, { speak: `Hva rimer på ${w}?` });
  },
  syllables() {
    const [w, pic, s] = pick(WORDS);
    return task(`Hvor mange stavelser har ${up(w)}?`, s, nearby(s, 1, 4), { pic, speak: `Hvor mange stavelser har ${w}? Klapp og tell!` });
  },
};
const NORSK_BY_GRADE = {
  1: ['firstLetter', 'whatIsThis', 'smallLetter', 'nextLetter'],
  2: ['firstLetter', 'whatIsThis', 'missingLetter', 'rhyme', 'syllables', 'nextLetter'],
};

function makeTask(grade, subject) {
  const g = grade === 2 ? 2 : 1;
  const s = subject === 'matte' || subject === 'norsk' ? subject : pick(['matte', 'norsk']);
  return s === 'matte' ? MATTE[pick(MATTE_BY_GRADE[g])](g) : NORSK[pick(NORSK_BY_GRADE[g])](g);
}

module.exports = { makeTask, GRADES: [1, 2], SUBJECTS: ['matte', 'norsk', 'begge'] };
