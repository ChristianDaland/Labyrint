// Bokstavrekka: fem bokstaver på rad der én eller to mangler (F G ☐ I ☐), og bokstavbrikker dras på plass
// (motoren er i brikker.js). Følger alfabet-nivået, som Prikk til prikk. En runde er 8 rekker.
// Lastes inn i rommet (index.html), som deler ut egget når runden er ferdig.

import { chooseSkill } from '../kjerne/laering.js';
import { makeAlphaRow } from '../kjerne/oppgaver.js';
import { T } from '../kjerne/tale.js';
import { startBrikkespill } from './brikker.js';

export const ROUND = 8;

export default function start({ root, profile, store, onExit }) {
  startBrikkespill({
    root, profile, store, onExit, game: 'bokstavrekka', round: ROUND, theme: 'alfa',
    startSpeech: T.alphaRowStart(),
    tileSpeech: T.letter,
    makePuzzle: () => {
      const t = makeAlphaRow(chooseSkill(profile.learning, 'alfabet').id);
      return { skill: t.skill, key: t.row.join(''), pic: null, q: null, tiles: t.tiles, parts: t.parts,
        speak: [t.speak], done: t.row.flatMap(T.letter) };
    },
  });
}
