// Små hjelpere for skjermene.

// Knapp som må holdes inne i `ms` for å utløses (voksenmeny, avslutt spill): vanskelig å treffe ved et uhell.
// Fremdriften settes i CSS-variabelen --p (0–1), så knappen kan vise en ring som fylles.
export function holdButton(el, ms, onDone) {
  let t0 = 0, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); t0 = 0; el.style.setProperty('--p', 0); };
  const tick = t => {
    const p = Math.min((t - t0) / ms, 1);
    el.style.setProperty('--p', p);
    if (p >= 1) { stop(); onDone(); } else raf = requestAnimationFrame(tick);
  };
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); t0 = performance.now(); raf = requestAnimationFrame(tick); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, stop);
  el.addEventListener('contextmenu', e => e.preventDefault());
}

// Holder skjermen på mens et spill pågår (der nettleseren støtter det)
export async function keepAwake() {
  try { return await navigator.wakeLock?.request('screen'); } catch { return null; }
}
