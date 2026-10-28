// Tallbyggeren: regnestykker og tallrekker med tomme ruter, der tall dras på plass (motoren er i brikker.js).
// Bruker matte-ferdighetene og matte-nivået, så fremgangen henger sammen med de andre spillene.
// En runde er 10 oppgaver.
// Lastes inn i rommet (index.html), som deler ut egget når runden er ferdig.

import { chooseSkill } from '../kjerne/laering.js';
import { makeMathPuzzle } from '../kjerne/oppgaver.js';
import { T } from '../kjerne/tale.js';
import { startBrikkespill } from './brikker.js';

export const ROUND = 10;

export default function start({ root, profile, store, onExit }) {
  startBrikkespill({
    root, profile, store, onExit, game: 'tallbygger', round: ROUND, theme: 'matte',
    startSpeech: T.mathStart(),
    tileSpeech: n => [n],
    makePuzzle: () => {
      const t = makeMathPuzzle(chooseSkill(profile.learning, 'matte').id);
      return { ...t, key: t.parts.map(p => 'slot' in p ? `[${p.slot}]` : p.text).join(' ') + (t.pic || ''), speak: T.task(t), done: [] };
    },
  });
}
