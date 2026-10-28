// Skriver alle setningene spillet kan si som JSON (brukes av lag-tale.py)
import { allPhrases } from '../public/kjerne/tale.js';

console.log(JSON.stringify([...allPhrases(6000)].sort()));
