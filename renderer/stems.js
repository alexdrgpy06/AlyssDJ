// Stems manuales en la interfaz: estado compartido de las separaciones y textos. Sin DOM: lo usan el deck y la Librería.
// Orden de los botones: voz, batería, bajo, resto. `ch` es el stem en el archivo de 8 canales (batería 0, bajo 1, resto 2, voz 3).
export const STEM_UI = [
  { key: 'voz', label: 'Voz', ch: 3 },
  { key: 'bateria', label: 'Batería', ch: 0 },
  { key: 'bajo', label: 'Bajo', ch: 1 },
  { key: 'resto', label: 'Resto', ch: 2 },
];

export const fmtEta = (s) => {
  if (!(s >= 0) || !isFinite(s)) return '';
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export const fmtSize = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round((bytes || 0) / 1e6))} MB`);

// Texto de un trabajo en curso: «Preparando… 37 %, ≈ 1:20».
export function jobText(job) {
  if (!job) return '';
  if (job.stage === 'queued') return 'En cola…';
  if (job.stage === 'model') return `Descargando el modelo… ${Math.round((job.progress || 0) * 100)} %`;
  const eta = fmtEta(job.etaS);
  return `Separando… ${Math.round((job.progress || 0) * 100)} %${eta ? `, ≈ ${eta}` : ''}`;
}

// Qué mostrar para una pista: 'off' (no disponible), 'none', 'work', 'ready', 'active', 'error'.
export function trackView({ available = true, why = '', hasFile = true, done = false, job = null, active = false, error = null }) {
  if (!available) return { mode: 'off', why };
  if (job) return { mode: 'work', text: jobText(job) };
  if (done) return { mode: active ? 'active' : 'ready' };
  if (error) return { mode: 'error', text: error };
  if (!hasFile) return { mode: 'off', why: 'Guarda la pista (o usa un archivo local) para poder separarla' };
  return { mode: 'none' };
}

const CAUSE = { archivo: 'No se pudo leer el archivo', larga: 'La pista es demasiado larga', memoria: 'Faltó memoria', modelo: 'Falló el modelo', runtime: 'Falló el motor de separación', salida: 'No se pudo guardar (¿sin espacio?)' };
export const errorText = (ev) => `${CAUSE[ev.code] ? `${CAUSE[ev.code]}: ` : ''}${ev.error || 'error desconocido'}`;

// Estado compartido: lista de stems hechos, trabajos y errores por pista.
export class StemsStore {
  constructor(api, onChange = () => {}) {
    this.api = api;
    this.onChange = onChange;
    this.done = {};
    this.jobs = {};
    this.errors = {};
    this.status = { available: false, why: 'Cargando…', usedBytes: 0, count: 0 };
  }

  async init() {
    try {
      this.done = (await this.api.list()) || {};
      this.status = await this.api.status();
    } catch (e) {
      this.status = { available: false, why: `Stems no está disponible: ${e.message}`, usedBytes: 0, count: 0 };
    }
    this.api.onEvent?.((ev) => this.onEvent(ev));
    this.onChange();
  }

  onEvent(ev) {
    const id = ev.id;
    if (ev.stage === 'model') {
      // la descarga del modelo afecta a la pista que espera
      for (const k of Object.keys(this.jobs)) this.jobs[k] = { ...this.jobs[k], stage: 'model', progress: ev.progress };
    } else if (ev.stage === 'queued') {
      delete this.errors[id];
      this.jobs[id] = { stage: 'queued' };
    } else if (ev.stage === 'progress') this.jobs[id] = { stage: 'progress', progress: ev.progress, etaS: ev.etaS };
    else if (ev.stage === 'done') {
      delete this.jobs[id];
      this.done[id] = { bytes: ev.bytes, at: Date.now() };
      this.refreshStatus();
    } else if (ev.stage === 'error') {
      delete this.jobs[id];
      this.errors[id] = errorText(ev);
    } else if (ev.stage === 'cancelled') delete this.jobs[id];
    this.onChange(id, ev);
  }

  async refreshStatus() {
    try { this.status = await this.api.status(); this.onChange(); } catch { /* sin cambios */ }
  }

  has(id) { return !!this.done[id]; }
  view(id, extra = {}) {
    return trackView({ available: this.status.available, why: this.status.why, done: this.has(id), job: this.jobs[id], error: this.errors[id], ...extra });
  }

  async request(id) {
    delete this.errors[id];
    const r = await this.api.request(id);
    if (r && r.ok === false) { this.errors[id] = r.error; this.onChange(id); }
    return r;
  }

  async cancel(id) { return this.api.cancel(id); }
  async remove(id) {
    const r = await this.api.remove(id);
    delete this.done[id];
    await this.refreshStatus();
    this.onChange(id);
    return r;
  }

  async removeAll() {
    await this.api.removeAll();
    this.done = {};
    await this.refreshStatus();
    this.onChange();
  }

  summary() {
    const n = Object.keys(this.done).length;
    return n ? `Stems: ${n} ${n === 1 ? 'pista' : 'pistas'}, ${fmtSize(this.status.usedBytes)}` : 'Stems: ninguna pista';
  }
}
