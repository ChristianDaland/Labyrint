// Profiler og fremgang, lagret i nettleseren på enheten (ingenting sendes noe sted).
// Ingen navn: en profil er et dyr og en farge, f.eks. «lilla ugle».
//
// Data: { version, activeId, sound, profiles: [{ id, animal, color, created, learning, stats, rewards, settings }] }

import { newLearning, newStats } from './laering.js';
import { newRewards } from './belonning.js';

export const KEY = 'gullegget';
export const VERSION = 1;

// Alle dyrene er hankjønn/hunkjønn, så fargeordet bøyes likt («grønn frosk», «grønn ugle»)
export const ANIMALS = [
  { id: 'ugle', emoji: '🦉', name: 'ugle' }, { id: 'bjorn', emoji: '🐻', name: 'bjørn' },
  { id: 'frosk', emoji: '🐸', name: 'frosk' }, { id: 'rev', emoji: '🦊', name: 'rev' },
  { id: 'katt', emoji: '🐱', name: 'katt' }, { id: 'hund', emoji: '🐶', name: 'hund' },
  { id: 'love', emoji: '🦁', name: 'løve' }, { id: 'panda', emoji: '🐼', name: 'panda' },
  { id: 'pingvin', emoji: '🐧', name: 'pingvin' }, { id: 'drage', emoji: '🐲', name: 'drage' },
  { id: 'enhjorning', emoji: '🦄', name: 'enhjørning' }, { id: 'skilpadde', emoji: '🐢', name: 'skilpadde' },
];
export const COLORS = [
  { id: 'rod', name: 'rød', hex: '#e5484d' }, { id: 'bla', name: 'blå', hex: '#3e7bfa' },
  { id: 'gronn', name: 'grønn', hex: '#3cb371' }, { id: 'gul', name: 'gul', hex: '#f2c14e' },
  { id: 'lilla', name: 'lilla', hex: '#9b6bd6' }, { id: 'oransje', name: 'oransje', hex: '#f08a3c' },
  { id: 'rosa', name: 'rosa', hex: '#ec6fae' }, { id: 'turkis', name: 'turkis', hex: '#2bb8b0' },
];
const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map(a => [a.id, a]));
const COLOR_BY_ID = Object.fromEntries(COLORS.map(c => [c.id, c]));

// «lilla ugle», brukes i opplesning
export const profileName = p => `${COLOR_BY_ID[p.color]?.name ?? ''} ${ANIMAL_BY_ID[p.animal]?.name ?? ''}`.trim();
export const profileEmoji = p => ANIMAL_BY_ID[p.animal]?.emoji ?? '❓';
export const profileColor = p => COLOR_BY_ID[p.color]?.hex ?? '#888';

const uuid = () => globalThis.crypto?.randomUUID?.() ??
  'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const emptyData = () => ({ version: VERSION, activeId: null, sound: true, profiles: [] });

export function newProfile(animal, color, now = new Date()) {
  return { id: uuid(), animal, color, created: now.toISOString(),
    learning: newLearning(), stats: newStats(), rewards: newRewards(), settings: { subject: 'begge', grade: 1 } };
}

// Fyller inn felt som mangler (eldre lagring, sikkerhetskopi), så resten av koden kan stole på formen
function normalizeProfile(p) {
  const base = newProfile(p.animal, p.color);
  return {
    ...base, ...p,
    learning: { ...base.learning, ...p.learning, level: { ...base.learning.level, ...p.learning?.level } },
    stats: { ...base.stats, ...p.stats, right: { ...base.stats.right, ...p.stats?.right }, wrong: { ...base.stats.wrong, ...p.stats?.wrong } },
    rewards: { ...base.rewards, ...p.rewards },
    settings: { ...base.settings, ...p.settings },
  };
}

function parse(text) {
  const d = JSON.parse(text);
  if (!d || typeof d !== 'object' || !Array.isArray(d.profiles)) throw new Error('ugyldig format');
  if (d.version > VERSION) throw new Error('lagret med en nyere versjon av spillet');
  return { ...emptyData(), ...d, version: VERSION,
    profiles: d.profiles.filter(p => p && p.id && p.animal && p.color).map(normalizeProfile) };
}

// localStorage kan mangle eller kaste (privat modus, blokkert lagring): da lagres det bare i minnet
function safeStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem(KEY + '.test', '1'); s.removeItem(KEY + '.test');
    return s;
  } catch {
    const m = new Map();
    return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  }
}

export function createStore(storage = safeStorage()) {
  let data;
  try {
    const raw = storage.getItem(KEY);
    data = raw ? parse(raw) : emptyData();
  } catch {
    // Ødelagt lagring: ta vare på den gamle teksten og start på nytt i stedet for å krasje
    try { storage.setItem(KEY + '.odelagt', storage.getItem(KEY)); } catch {}
    data = emptyData();
  }

  const save = () => { try { storage.setItem(KEY, JSON.stringify(data)); } catch {} };

  return {
    get data() { return data; },
    save,
    profiles: () => data.profiles,
    active: () => data.profiles.find(p => p.id === data.activeId) ?? (data.profiles.length === 1 ? data.profiles[0] : null),
    setActive(id) { data.activeId = id; save(); },
    taken: (animal, color) => data.profiles.some(p => p.animal === animal && p.color === color),
    addProfile(animal, color) {
      if (!ANIMAL_BY_ID[animal] || !COLOR_BY_ID[color]) throw new Error('ukjent dyr eller farge');
      if (this.taken(animal, color)) throw new Error('finnes allerede');
      const p = newProfile(animal, color);
      data.profiles.push(p); data.activeId = p.id; save();
      return p;
    },
    removeProfile(id) {
      data.profiles = data.profiles.filter(p => p.id !== id);
      if (data.activeId === id) data.activeId = null;
      save();
    },
    setSound(on) { data.sound = !!on; save(); },

    // Sikkerhetskopi som tekst (lagres som fil av den som kaller)
    exportBackup: (now = new Date()) => JSON.stringify({ app: 'gullegget', exported: now.toISOString(), ...data }, null, 1),
    // Erstatter alt med innholdet i sikkerhetskopien. Kaster med en forklaring hvis fila ikke kan brukes.
    importBackup(text) {
      const d = parse(text);
      if (!d.profiles.length) throw new Error('ingen profiler i fila');
      data = d; save();
      return data.profiles.length;
    },
  };
}

// Be nettleseren om varig lagring (hindrer at den ryddes bort ved lite plass). Hjem-skjerm-appen er viktigst på iPhone/iPad.
export async function requestPersist() {
  try { return await globalThis.navigator?.storage?.persist?.() ?? false; } catch { return false; }
}

// Sikkerhetskopien som nedlastbar fil i nettleseren
export function downloadBackup(store, now = new Date()) {
  const blob = new Blob([store.exportBackup(now)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gullegget-${now.toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
