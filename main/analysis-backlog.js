// Cola de análisis de listas: guarda en disco las pistas pendientes y se las va dando al Analyzer de a una,
// solo cuando este está libre (lo pedido a mano pasa primero) y mientras yt-dlp no esté bloqueado por la comprobación de bot.
'use strict';
const fs = require('fs');
const path = require('path');

const STATES = { QUEUED: 'queued', RUNNING: 'running', DONE: 'done', ERROR: 'error' };
const BOT_RETRY_MS = 15000;

class Backlog {
  constructor({ analyzer, file, emit = () => {}, botBlocked = () => false, botError = '', saveMs = 500, notifyMs = 250 } = {}) {
    this.analyzer = analyzer;
    this.file = file;
    this.emit = emit;
    this.botBlocked = botBlocked;
    this.botError = botError;
    this.saveMs = saveMs;
    this.notifyMs = notifyMs;
    this.priority = new Set();
    this.paused = false;
    this.lists = [];
    this.items = [];
    this.timers = { save: null, notify: null, bot: null };
    this.load();
  }

  load() {
    try {
      const s = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.paused = !!s.paused;
      this.lists = Array.isArray(s.lists) ? s.lists : [];
      this.items = (Array.isArray(s.items) ? s.items : []).map((i) => (i.state === STATES.RUNNING ? { ...i, state: STATES.QUEUED, progress: undefined } : i));
    } catch {
      this.paused = false;
      this.lists = [];
      this.items = [];
    }
  }

  // ---- estado ----
  state() {
    const lists = this.lists.map((l) => {
      const mine = this.items.filter((i) => i.listId === l.id);
      const count = (st) => mine.filter((i) => i.state === st).length;
      return { ...l, total: mine.length, done: count(STATES.DONE), error: count(STATES.ERROR), queued: count(STATES.QUEUED), running: count(STATES.RUNNING) };
    });
    const pending = this.items.filter((i) => i.state === STATES.QUEUED || i.state === STATES.RUNNING).length;
    return { paused: this.paused, botBlocked: !!this.botBlocked(), pending, lists, items: this.items };
  }

  // ---- persistencia y avisos (con retardo para no escribir ni avisar en cada porcentaje) ----
  changed() {
    this.scheduleSave();
    this.scheduleNotify();
  }

  scheduleSave() {
    if (this.timers.save) return;
    this.timers.save = setTimeout(() => ((this.timers.save = null), this.flush()), this.saveMs);
    this.timers.save.unref?.();
  }

  scheduleNotify() {
    if (this.timers.notify) return;
    this.timers.notify = setTimeout(() => ((this.timers.notify = null), this.emit(this.state())), this.notifyMs);
    this.timers.notify.unref?.();
  }

  // Escritura atómica: archivo temporal y renombrar, para no dejar la cola a medias si se cierra la app.
  flush() {
    if (this.timers.save) (clearTimeout(this.timers.save), (this.timers.save = null));
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ paused: this.paused, lists: this.lists, items: this.items }));
      fs.renameSync(tmp, this.file);
    } catch {}
  }

  // ---- operaciones ----
  addList({ name, tracks }) {
    if (!Array.isArray(tracks)) throw new Error('La lista no tiene pistas');
    const listId = `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const live = new Set(this.items.filter((i) => i.state === STATES.QUEUED || i.state === STATES.RUNNING).map((i) => i.id));
    let added = 0;
    let skipped = 0;
    for (const t of tracks) {
      const id = t?.videoId;
      if (!id || live.has(id) || this.analyzer.get(id)) { skipped++; continue; }
      live.add(id);
      this.items = this.items.filter((i) => i.id !== id); // un error o resultado viejo de otra lista se reemplaza
      this.items.push({ id, listId, title: t.title || id, artist: t.artist || '', thumb: t.thumb || '', duration: t.duration || 0, file: t.local ? t.path : undefined, state: STATES.QUEUED });
      added++;
    }
    if (!added) return { listId: null, added, skipped };
    this.lists.push({ id: listId, name: String(name || 'Lista').slice(0, 120), addedAt: Date.now() });
    this.changed();
    this.pump();
    return { listId, added, skipped };
  }

  setPriority(ids) {
    this.priority = new Set(ids || []);
  }

  pause() {
    this.paused = true;
    this.changed();
  }

  resume() {
    this.paused = false;
    this.changed();
    this.pump();
  }

  cancelList(listId) {
    const running = this.items.find((i) => i.listId === listId && i.state === STATES.RUNNING);
    this.items = this.items.filter((i) => i.listId !== listId);
    this.lists = this.lists.filter((l) => l.id !== listId);
    if (running) this.analyzer.cancel(running.id);
    this.changed();
  }

  retry(listId) {
    for (const i of this.items) if (i.listId === listId && i.state === STATES.ERROR) Object.assign(i, { state: STATES.QUEUED, error: undefined, progress: undefined });
    this.changed();
    this.pump();
  }

  clearDone() {
    this.items = this.items.filter((i) => i.state !== STATES.DONE);
    const used = new Set(this.items.map((i) => i.listId));
    this.lists = this.lists.filter((l) => used.has(l.id));
    this.changed();
  }

  // ---- avance ----
  idle() {
    return !this.analyzer.running && !(this.analyzer.queue && this.analyzer.queue.length);
  }

  pump() {
    if (this.paused) return;
    if (this.botBlocked()) {
      if (!this.timers.bot && this.items.some((i) => i.state === STATES.QUEUED)) {
        this.timers.bot = setTimeout(() => ((this.timers.bot = null), this.pump()), BOT_RETRY_MS);
        this.timers.bot.unref?.();
      }
      return;
    }
    if (this.items.some((i) => i.state === STATES.RUNNING) || !this.idle()) return;
    const queued = this.items.filter((i) => i.state === STATES.QUEUED);
    const next = queued.find((i) => this.priority.has(i.id)) || queued[0];
    if (!next) return;
    if (this.analyzer.get(next.id)) {
      // ya se analizó por otro camino mientras esperaba
      next.state = STATES.DONE;
      this.changed();
      return this.pump();
    }
    next.state = STATES.RUNNING;
    next.progress = 0;
    this.changed();
    this.analyzer.request(next.id, { meta: { title: next.title, artist: next.artist, thumb: next.thumb, trackDuration: next.duration }, file: next.file });
  }

  // Eventos del Analyzer ({ id, stage, progress?, error? }).
  onAnalyzerEvent(ev) {
    const mine = this.items.filter((i) => i.id === ev.id && (i.state === STATES.RUNNING || i.state === STATES.QUEUED));
    if (!mine.length) {
      // algo pedido a mano terminó: el analizador quedó libre para la cola
      if (['done', 'error', 'cancelled'].includes(ev.stage)) setImmediate(() => this.pump());
      return;
    }
    const it = mine[0];
    if (ev.stage === 'download' || ev.stage === 'analyze') {
      if (it.state !== STATES.RUNNING) return;
      it.progress = ev.stage === 'download' ? ev.progress || 0 : 1;
      it.stage = ev.stage;
      return this.changed();
    }
    if (ev.stage === 'done') {
      for (const i of mine) Object.assign(i, { state: STATES.DONE, progress: undefined, stage: undefined, error: undefined });
    } else if (ev.stage === 'error') {
      if (it.state !== STATES.RUNNING) return;
      if (this.botError && ev.error === this.botError) Object.assign(it, { state: STATES.QUEUED, progress: undefined, stage: undefined }); // el bloqueo no es culpa de la pista
      else Object.assign(it, { state: STATES.ERROR, error: String(ev.error || 'Error').slice(0, 300), progress: undefined, stage: undefined });
    } else if (ev.stage === 'cancelled') {
      if (it.state === STATES.RUNNING) Object.assign(it, { state: STATES.QUEUED, progress: undefined, stage: undefined });
    } else return;
    this.changed();
    setImmediate(() => this.pump());
  }

  // Arranque: retomar lo que quedó pendiente.
  start() {
    this.pump();
  }
}

module.exports = { Backlog, STATES };
