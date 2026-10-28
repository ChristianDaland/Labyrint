// Oppgaver for læringsmotoren, delt opp i ferdigheter i den rekkefølgen de læres (1.–2. trinn).
// En oppgave er { skill, q, pic, options[], answer, speak }: `answer` er indeksen til riktig svar,
// `speak` leses opp (mange kan ikke lese ennå), `pic` er et bilde (emoji) eller null.

const rand = n => Math.floor(Math.random() * n);
const between = (a, b) => a + rand(b - a + 1);
const pick = arr => arr[rand(arr.length)];
export const shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) { const j = rand(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
};

// Flervalgsoppgave med riktig svar og to ulike feilsvar
function task(skill, q, correct, wrong, { pic = null, speak = q } = {}) {
  const options = [String(correct)];
  for (const w of wrong) if (options.length < 3 && !options.includes(String(w))) options.push(String(w));
  shuffle(options);
  return { skill, q, pic, options, answer: options.indexOf(String(correct)), speak };
}

// Tall rundt n (innenfor min..max), brukt som feilsvar
const nearby = (n, min, max) => shuffle([n - 1, n + 1, n - 2, n + 2, n - 3, n + 3].filter(v => v >= min && v <= max));

// ─── Matte ──────────────────────────────────────────────────────────────
const THINGS = [['🍎', 'epler'], ['⭐', 'stjerner'], ['🐟', 'fisker'], ['🎈', 'ballonger'],
  ['🐞', 'marihøner'], ['🌸', 'blomster'], ['⚽', 'baller'], ['🦆', 'ender']];

function count(skill, min, max) {
  const n = between(min, max), [icon, name] = pick(THINGS), rows = [];
  for (let i = 0; i < n; i += 5) rows.push(icon.repeat(Math.min(5, n - i))); // femmere er lettere å telle
  return task(skill, `Hvor mange ${name}?`, n, nearby(n, 1, max + 3), { pic: rows.join('\n') });
}

function plus(skill, max, minTerm) {
  const a = between(minTerm, max - Math.max(minTerm, 1)), b = between(Math.max(minTerm, 1), max - a);
  return task(skill, `${a} + ${b} = ?`, a + b, nearby(a + b, 0, max + 3), { speak: `Hva er ${a} pluss ${b}?` });
}

function minus(skill, minA, maxA, maxB) {
  const a = between(minA, maxA), b = between(1, Math.min(a, maxB));
  return task(skill, `${a} − ${b} = ?`, a - b, nearby(a - b, 0, maxA), { speak: `Hva er ${a} minus ${b}?` });
}

function after(skill, min, max, alsoBefore) {
  const n = between(min, max - 1);
  if (alsoBefore && n > min && Math.random() < 0.5)
    return task(skill, `Hvilket tall kommer før ${n}?`, n - 1, [n + 1, n - 2, n + 2]);
  return task(skill, `Hvilket tall kommer etter ${n}?`, n + 1, [n - 1, n + 2, n]);
}

function biggest(skill, min, max) {
  const nums = new Set();
  while (nums.size < 3) nums.add(between(min, max));
  const all = [...nums], top = Math.max(...all);
  return task(skill, 'Hvilket tall er størst?', top, all.filter(v => v !== top));
}

function tenFriends(skill) {
  const a = between(1, 9);
  return task(skill, `${a} + ? = 10`, 10 - a, nearby(10 - a, 0, 10), { speak: `${a} pluss hva blir 10?` });
}

function double(skill) {
  const n = between(1, 10);
  return task(skill, `Hva er det dobbelte av ${n}?`, n * 2, [n * 2 - 1, n * 2 + 1, n + 1, n * 2 + 2]);
}

function sequence(skill) {
  const step = pick([2, 5, 10]), start = step === 2 ? between(0, 10) : step * between(0, 5);
  const seq = [0, 1, 2].map(i => start + i * step), next = start + 3 * step;
  return task(skill, `Hva kommer så?\n${seq.join(', ')}, ?`, next, [next + 1, next - 1, next + step, next + 2 * step],
    { speak: `Hvilket tall kommer så? ${seq.join(', ')}` });
}

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
// Rekkefølgen bokstavene innføres i. Vanlig i leseopplæring: lyder som kan dras ut (S, O, L, I, M) først.
// Bytt ut med rekkefølgen i ABC-boka som brukes, hvis den er en annen.
export const LETTER_ORDER = 'SOLIMAERNTUKFBDGHPJVØÅÆYCWXZQ';
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ';
const FIRST_LETTERS = 'ABDEFGHIKLMNOPRSTU'; // feilsvar for «hvilken bokstav begynner …»
const VOWELS = 'AEIOUYÆØÅ';
const up = s => s.toUpperCase();
const others = (pool, not, n = 2) => shuffle([...pool].filter(c => c !== not)).slice(0, n);

function smallLetter(skill) {
  const c = pick(LETTER_ORDER.slice(0, 16)); // de vanligste bokstavene først
  return task(skill, `Finn den lille bokstaven til ${c}`, c.toLowerCase(), others(ALPHABET.toLowerCase(), c.toLowerCase()),
    { pic: c, speak: `Finn den lille bokstaven til ${c}.` });
}

function firstLetter(skill) {
  const [w, pic] = pick(WORDS), c = up(w[0]);
  return task(skill, 'Hvilken bokstav begynner ordet med?', c, others(FIRST_LETTERS, c), { pic, speak: `Hvilken bokstav begynner ${w} med?` });
}

function wordForPicture(skill, short) {
  const [w, pic] = pick(WORDS.filter(x => short ? x[0].length <= 4 : x[0].length >= 5));
  const wrong = shuffle(WORDS.filter(x => x[0] !== w && x[0][0] !== w[0] && (!short || x[0].length <= 5))).map(x => up(x[0]));
  // Stemmen sier hva bildet er (et lite bilde er lett å misforstå); oppgaven er å finne det skrevne ordet
  return task(skill, 'Finn ordet', up(w), wrong, { pic, speak: `Finn ordet ${w}.` });
}

function nextLetter(skill) {
  const i = rand(ALPHABET.length - 1);
  return task(skill, `Hvilken bokstav kommer etter ${ALPHABET[i]} i alfabetet?`, ALPHABET[i + 1], others(ALPHABET, ALPHABET[i + 1], 4));
}

function missingLetter(skill) {
  const [w, pic] = pick(WORDS.filter(x => x[0].length <= 5));
  const W = up(w), i = [...W].findIndex(ch => VOWELS.includes(ch));
  const shown = [...W].map((ch, j) => j === i ? '_' : ch).join(' ');
  return task(skill, `Hvilken bokstav mangler?\n${shown}`, W[i], others('AEIOU', W[i]), { pic, speak: `Hvilken bokstav mangler i ${w}?` });
}

function rhyme(skill) {
  const group = pick(RHYMES), [w, match] = shuffle([...group]);
  const wrong = shuffle(RHYMES.filter(r => r !== group).flat()).map(up);
  return task(skill, `Hva rimer på ${up(w)}?`, up(match), wrong, { speak: `Hva rimer på ${w}?` });
}

function syllables(skill) {
  const [w, pic, s] = pick(WORDS);
  return task(skill, `Hvor mange stavelser har ${up(w)}?`, s, nearby(s, 1, 4), { pic, speak: `Hvor mange stavelser har ${w}? Klapp og tell!` });
}

// ─── Staving (eget fag med eget spill, Ordbyggeren) ────────────────────
// Lydrette ord: skrives slik de høres, uten stumme bokstaver (ikke «hund», «tog»). [ord, bilde]
const SPELL_WORDS = {
  kort: [['is', '🍦'], ['ku', '🐮'], ['sol', '☀️'], ['bil', '🚗'], ['mus', '🐭'], ['hus', '🏠'], ['bok', '📖'], ['båt', '⛵'],
    ['fly', '✈️'], ['rev', '🦊'], ['tre', '🌳'], ['sko', '👟'], ['ape', '🐒'], ['ost', '🧀'], ['ris', '🍚'], ['øre', '👂'],
    ['bie', '🐝'], ['sau', '🐑'], ['snø', '❄️'], ['sel', '🦭']],
  fire: [['ugle', '🦉'], ['måne', '🌙'], ['eple', '🍎'], ['kake', '🎂'], ['gave', '🎁'], ['pære', '🍐'], ['løve', '🦁'],
    ['gris', '🐷'], ['fisk', '🐟'], ['hest', '🐴'], ['melk', '🥛'], ['nese', '👃'], ['rose', '🌹'], ['mais', '🌽'], ['lama', '🦙']],
  dobbel: [['katt', '🐱'], ['hatt', '🎩'], ['ball', '⚽'], ['buss', '🚌'], ['sopp', '🍄'], ['egg', '🥚'], ['nøtt', '🌰'],
    ['vott', '🧤'], ['rakett', '🚀'], ['nøkkel', '🔑']],
  lang: [['sebra', '🦓'], ['banan', '🍌'], ['tomat', '🍅'], ['kanin', '🐰'], ['frosk', '🐸'], ['tiger', '🐯'], ['ananas', '🍍'],
    ['elefant', '🐘'], ['gulrot', '🥕'], ['potet', '🥔'], ['sitron', '🍋'], ['robot', '🤖'], ['kamel', '🐫'], ['delfin', '🐬']],
};
export const ALL_SPELL_WORDS = Object.values(SPELL_WORDS).flat().map(([w]) => w);
const EXTRA_LETTERS = 'AEIOUSLMNRTKBDGPFH';

// Staveoppgave: { skill, kind: 'stave', q, word, pic, tiles, ghost, speak }. `tiles` er bokstavene i ordet pluss
// `extra` bokstaver som ikke er i ordet, stokket. `ghost`: bokstavene vises svakt i rutene (å kopiere).
function spell(skill, list, { ghost = false, extra = 0 } = {}) {
  const [w, pic] = pick(SPELL_WORDS[list]), W = up(w);
  const tiles = shuffle([...W, ...shuffle([...EXTRA_LETTERS].filter(c => !W.includes(c))).slice(0, extra)]);
  return { skill, kind: 'stave', q: 'Stav ordet', word: W, pic, tiles, ghost, speak: `Stav ordet ${w}.` };
}

// ─── Ferdighetene, i læringsrekkefølge per fag ─────────────────────────
// `diploma` er teksten på diplomet når ferdigheten er mestret (leses opp).
export const SKILLS = [
  { id: 'telle5', subject: 'matte', diploma: 'Du kan telle til 5!', make: s => count(s, 1, 5) },
  { id: 'telle10', subject: 'matte', diploma: 'Du kan telle til 10!', make: s => count(s, 4, 10) },
  { id: 'etter10', subject: 'matte', diploma: 'Du vet hvilket tall som kommer etter!', make: s => after(s, 1, 10, false) },
  { id: 'storst10', subject: 'matte', diploma: 'Du vet hvilket tall som er størst!', make: s => biggest(s, 0, 10) },
  { id: 'pluss5', subject: 'matte', diploma: 'Du kan pluss opp til 5!', make: s => plus(s, 5, 0) },
  { id: 'minus5', subject: 'matte', diploma: 'Du kan minus opp til 5!', make: s => minus(s, 2, 5, 5) },
  { id: 'pluss10', subject: 'matte', diploma: 'Du kan pluss opp til 10!', make: s => plus(s, 10, 1) },
  { id: 'minus10', subject: 'matte', diploma: 'Du kan minus opp til 10!', make: s => minus(s, 4, 10, 10) },
  { id: 'telle20', subject: 'matte', diploma: 'Du kan telle til 20!', make: s => count(s, 8, 20) },
  { id: 'tiervenner', subject: 'matte', diploma: 'Du kan tiervennene!', make: s => tenFriends(s) },
  { id: 'foretter20', subject: 'matte', diploma: 'Du kan tallene opp til 20!', make: s => after(s, 1, 20, true) },
  { id: 'dobbel', subject: 'matte', diploma: 'Du kan det dobbelte!', make: s => double(s) },
  { id: 'pluss20', subject: 'matte', diploma: 'Du kan pluss opp til 20!', make: s => plus(s, 20, 2) },
  { id: 'minus20', subject: 'matte', diploma: 'Du kan minus opp til 20!', make: s => minus(s, 10, 20, 10) },
  { id: 'tallrekker', subject: 'matte', diploma: 'Du kan telle med to, fem og ti!', make: s => sequence(s) },
  { id: 'storst100', subject: 'matte', diploma: 'Du kan store tall!', make: s => biggest(s, 10, 99) },

  { id: 'storliten', subject: 'norsk', diploma: 'Du kan store og små bokstaver!', make: s => smallLetter(s) },
  { id: 'forlyd', subject: 'norsk', diploma: 'Du hører hvilken bokstav ordet begynner med!', make: s => firstLetter(s) },
  { id: 'ordkort', subject: 'norsk', diploma: 'Du kan lese korte ord!', make: s => wordForPicture(s, true) },
  { id: 'alfabet', subject: 'norsk', diploma: 'Du kan alfabetet!', make: s => nextLetter(s) },
  { id: 'mangler', subject: 'norsk', diploma: 'Du finner bokstaven som mangler!', make: s => missingLetter(s) },
  { id: 'rim', subject: 'norsk', diploma: 'Du kan rim!', make: s => rhyme(s) },
  { id: 'stavelser', subject: 'norsk', diploma: 'Du kan dele ord i stavelser!', make: s => syllables(s) },
  { id: 'ordlang', subject: 'norsk', diploma: 'Du kan lese lange ord!', make: s => wordForPicture(s, false) },
];
// ─── Regnestykker med ruter (Tallbyggeren) ──────────────────────────────
// Matte-ferdighetene som regnestykker der tall dras på plass, med samme nivå som i de andre spillene.
// { skill, q, pic, parts: [{ text } | { slot }], tiles, speak }: `tiles` er svarene pluss to ekstra tall, stokket.
const X = t => ({ text: String(t) }), S = n => ({ slot: String(n) });
function puzzle(skill, parts, extras, { q = null, pic = null, speak }) {
  const answers = parts.filter(p => 'slot' in p).map(p => p.slot);
  const extra = [...new Set(extras.map(String))].filter(v => !answers.includes(v) && !v.startsWith('-')).slice(0, 2);
  return { skill, q, pic, parts, tiles: shuffle([...answers, ...extra]), speak };
}
const sum = (skill, a, b, missing) => missing
  ? puzzle(skill, [X(a), X('+'), S(b), X('='), X(a + b)], nearby(b, 0, a + b), { speak: `${a} pluss hva blir ${a + b}?` })
  : puzzle(skill, [X(a), X('+'), X(b), X('='), S(a + b)], nearby(a + b, 0, a + b + 3), { speak: `Hva er ${a} pluss ${b}?` });
const diff = (skill, a, b, missing) => missing
  ? puzzle(skill, [X(a), X('−'), S(b), X('='), X(a - b)], nearby(b, 1, a), { speak: `${a} minus hva blir ${a - b}?` })
  : puzzle(skill, [X(a), X('−'), X(b), X('='), S(a - b)], nearby(a - b, 0, a), { speak: `Hva er ${a} minus ${b}?` });

function countPuzzle(skill, min, max) {
  const n = between(min, max), [icon, name] = pick(THINGS), rows = [];
  for (let i = 0; i < n; i += 5) rows.push(icon.repeat(Math.min(5, n - i)));
  return puzzle(skill, [S(n)], nearby(n, 1, max + 3), { pic: rows.join('\n'), speak: `Hvor mange ${name}?` });
}
// Tallrekke der noen tall mangler: `blanks` = plassene som er tomme
function rowPuzzle(skill, nums, blanks, extras, speak) {
  return puzzle(skill, nums.map((n, i) => blanks.includes(i) ? S(n) : X(n)), extras, { speak });
}
function plusPuzzle(skill, max, minTerm, missingShare) {
  const a = between(minTerm, max - Math.max(minTerm, 1)), b = between(Math.max(minTerm, 1), max - a);
  return sum(skill, a, b, Math.random() < missingShare);
}
function minusPuzzle(skill, minA, maxA, maxB, missingShare) {
  const a = between(minA, maxA), b = between(1, Math.min(a, maxB));
  return diff(skill, a, b, Math.random() < missingShare);
}
function biggerPuzzle(skill, lo, hi) { // «☐ > 5»: bare én brikke er større
  const a = between(lo + 1, hi - 1), b = between(a + 1, Math.min(hi, a + 5));
  const small = shuffle(Array.from({ length: Math.min(a - lo + 1, 6) }, (_, i) => a - i));
  return puzzle(skill, [S(b), X('>'), X(a)], small, { speak: `Hvilket tall er større enn ${a}?` });
}

const MATH_PUZZLES = {
  telle5: s => countPuzzle(s, 1, 5),
  telle10: s => countPuzzle(s, 4, 10),
  etter10: s => { const n = between(1, 9); return rowPuzzle(s, [n - 1, n, n + 1], [2], [n + 2, n - 1, n + 3].filter(v => v !== n), `Hvilket tall kommer etter ${n}?`); },
  storst10: s => biggerPuzzle(s, 0, 10),
  pluss5: s => plusPuzzle(s, 5, 0, 0),
  minus5: s => minusPuzzle(s, 2, 5, 5, 0),
  pluss10: s => plusPuzzle(s, 10, 1, 0.3),
  minus10: s => minusPuzzle(s, 4, 10, 10, 0.3),
  telle20: s => countPuzzle(s, 8, 20),
  tiervenner: s => { const a = between(1, 9); return puzzle(s, [X(a), X('+'), S(10 - a), X('='), X(10)], nearby(10 - a, 0, 10), { speak: `${a} pluss hva blir 10?` }); },
  foretter20: s => {
    const a = between(1, 15), nums = [a, a + 1, a + 2, a + 3, a + 4], blanks = shuffle([1, 2, 3, 4]).slice(0, 2).sort();
    return rowPuzzle(s, nums, blanks, [a + 5, a - 1, a + 6, a + 7], 'Hvilke tall mangler?');
  },
  dobbel: s => { const n = between(1, 10); return puzzle(s, [X(n), X('+'), X(n), X('='), S(2 * n)], [2 * n - 1, 2 * n + 1, n + 1, 2 * n + 2], { speak: `Hva er ${n} pluss ${n}?` }); },
  pluss20: s => plusPuzzle(s, 20, 2, 0.4),
  minus20: s => minusPuzzle(s, 10, 20, 10, 0.4),
  tallrekker: s => {
    const step = pick([2, 5, 10]), start = step === 2 ? between(0, 10) : step * between(0, 5), nums = [0, 1, 2, 3].map(i => start + i * step);
    const two = Math.random() < 0.5, extras = [start + 4 * step, nums[3] + 1, nums[3] - 1, nums[1] + 1];
    return two ? rowPuzzle(s, nums, [1, 3], extras, 'Hvilke tall mangler?') : rowPuzzle(s, nums, [3], extras, 'Hvilket tall kommer så?');
  },
  storst100: s => biggerPuzzle(s, 10, 99),
};
export const makeMathPuzzle = skillId => MATH_PUZZLES[skillId](skillId);

// Staving: brukes bare i Ordbyggeren (oppgavene er ikke flervalg), så de står utenfor SKILLS
export const SPELL_SKILLS = [
  { id: 'stavkopi', subject: 'stave', diploma: 'Du kan bygge ord!', make: s => spell(s, 'kort', { ghost: true }) },
  { id: 'stavkort', subject: 'stave', diploma: 'Du kan stave korte ord!', make: s => spell(s, 'kort') },
  { id: 'stavvelg', subject: 'stave', diploma: 'Du finner de riktige bokstavene!', make: s => spell(s, 'kort', { extra: 2 }) },
  { id: 'stavfire', subject: 'stave', diploma: 'Du kan stave ord med fire bokstaver!', make: s => spell(s, 'fire', { extra: 2 }) },
  { id: 'stavdobbel', subject: 'stave', diploma: 'Du kan stave ord med dobbel bokstav!', make: s => spell(s, 'dobbel', { extra: 2 }) },
  { id: 'stavlang', subject: 'stave', diploma: 'Du kan stave lange ord!', make: s => spell(s, 'lang', { extra: 2 }) },
];
export const SKILL_BY_ID = Object.fromEntries([...SKILLS, ...SPELL_SKILLS].map(s => [s.id, s]));
export const skillsOf = subject => [...SKILLS, ...SPELL_SKILLS].filter(s => s.subject === subject);

export const makeTask = skillId => SKILL_BY_ID[skillId].make(skillId);

// Kort betegnelse til opplesning: «Du kan pluss opp til 10!» → «pluss opp til 10»
export const skillLabel = skillId => SKILL_BY_ID[skillId].diploma.replace(/^Du \S+ /, '').replace(/!$/, '');
