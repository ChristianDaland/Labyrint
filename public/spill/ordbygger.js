// Ordbyggeren: se bildet, hør ordet og bygg det med bokstavbrikker (motoren er i brikker.js).
// Staving er et eget fag («stave») i læringsmotoren, med seks nivåer fra å kopiere korte ord til å stave
// lange ord med ekstra bokstaver å velge bort. En runde er 8 ord.
// Lastes inn i rommet (index.html), som deler ut egget når runden er ferdig.

import { chooseSkill } from '../kjerne/laering.js';
import { makeTask } from '../kjerne/oppgaver.js';
import { T } from '../kjerne/tale.js';
import { startBrikkespill } from './brikker.js';

export const ROUND = 8;

export default function start({ root, profile, store, onExit }) {
  startBrikkespill({
    root, profile, store, onExit, game: 'ordbygger', round: ROUND,
    startSpeech: T.spellStart(),
    tileSpeech: T.letter, // bokstavnavnet, til bokstavlydene er spilt inn
    makePuzzle: () => {
      const t = makeTask(chooseSkill(profile.learning, 'stave').id);
      return { skill: t.skill, key: t.word, pic: t.pic, q: null, tiles: t.tiles,
        parts: [...t.word].map(ch => ({ slot: ch, ghost: t.ghost })), speak: T.task(t), done: T.word(t.word) };
    },
  });
}
