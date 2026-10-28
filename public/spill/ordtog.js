// Ordtoget: hør setningen og legg ordene i riktig rekkefølge (motoren er i brikker.js).
// Setninger er et eget fag («setning») i læringsmotoren, med fem nivåer fra tre ord (med hjelpetekst i rutene)
// til fem ord med et ekstra ord å velge bort. En runde er 8 setninger.
// Lastes inn i rommet (index.html), som deler ut egget når runden er ferdig.

import { chooseSkill } from '../kjerne/laering.js';
import { makeTask } from '../kjerne/oppgaver.js';
import { T } from '../kjerne/tale.js';
import { startBrikkespill } from './brikker.js';

export const ROUND = 8;

export default function start({ root, profile, store, onExit }) {
  startBrikkespill({
    root, profile, store, onExit, game: 'ordtog', round: ROUND, theme: 'ord',
    startSpeech: T.sentenceStart(),
    tileSpeech: w => T.word(w.replace('.', '')),
    makePuzzle: () => {
      const t = makeTask(chooseSkill(profile.learning, 'setning').id);
      return { skill: t.skill, key: t.sentence, pic: t.pic, q: null, tiles: t.tiles,
        parts: t.words.map(w => ({ slot: w, ghost: t.ghost })), speak: T.task(t), done: T.sentence(t.sentence) };
    },
  });
}
