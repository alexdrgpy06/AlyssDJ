// Perfiles de AutoMix: un clic fija duración, estilo, orden y nivel de efectos. «Personalizado» no cambia nada.
export const PROFILES = {
  soft: { label: 'Suave', cfg: { len: 24, style: 'crossfade', smartOrder: true, fxLevel: 'off' } },
  club: { label: 'Club', cfg: { len: 12, style: 'auto', smartOrder: true, fxLevel: 'subtle' } },
  radio: { label: 'Radio', cfg: { len: 32, style: 'crossfade', smartOrder: false, fxLevel: 'off' } },
  custom: { label: 'Personalizado', cfg: null },
};
const KEYS = ['len', 'style', 'smartOrder', 'fxLevel'];
const LS = 'automix-profile';

export function applyProfile(am, id) {
  const p = PROFILES[id];
  if (!p) return false;
  if (p.cfg) am.setCfg({ ...p.cfg });
  try { localStorage.setItem(LS, id); } catch {}
  return true;
}

// Perfil que describe la configuración actual: el que coincide en todas las claves, o `custom`.
export function detect(cfg) {
  for (const [id, p] of Object.entries(PROFILES)) if (p.cfg && KEYS.every((k) => (cfg?.[k] ?? (k === 'fxLevel' ? 'subtle' : undefined)) === p.cfg[k])) return id;
  return 'custom';
}

export function lastProfile() {
  try { const v = localStorage.getItem(LS); return PROFILES[v] ? v : null; } catch { return null; }
}
