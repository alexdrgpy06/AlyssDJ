// Perfiles de diseño según el tamaño de la ventana: compacto (portátiles pequeños), normal y amplio (2K/4K, proyectores).
export const MODES = ['auto', 'compact', 'normal', 'wide'];

export function profileFor(w, h) {
  if (w < 1280 || h < 780) return 'compact';
  if (w >= 1920) return 'wide';
  return 'normal';
}

// Escala de la interfaz en el perfil amplio: crece con la pantalla sin pasarse (1.15 – 1.6).
export function scaleFor(w, h) {
  const s = Math.min(w / 1600, h / 960);
  return Math.max(1.15, Math.min(1.6, Math.round(s * 20) / 20));
}

export function resolve(mode, w, h) {
  const profile = MODES.includes(mode) && mode !== 'auto' ? mode : profileFor(w, h);
  return { profile, scale: profile === 'wide' ? scaleFor(w, h) : 1 };
}

export function applyLayout(mode, w = innerWidth, h = innerHeight) {
  const { profile, scale } = resolve(mode, w, h);
  document.body.dataset.layout = profile;
  document.body.style.setProperty('--ui-scale', String(scale));
  return profile;
}

export function watchLayout(getMode) {
  let raf = 0;
  const run = () => (raf = 0, applyLayout(getMode()));
  addEventListener('resize', () => raf || (raf = requestAnimationFrame(run)));
  run();
  return run;
}
