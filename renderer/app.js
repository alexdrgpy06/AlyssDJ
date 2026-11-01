import { controls, register, press } from './controls.js';
import { makeKnob } from './knob.js';
import { Deck } from './deck.js';
import { Library } from './library.js';
import { Midi } from './midi.js';
import { AutoMix } from './automix.js';
import { watchLayout } from './layout.js';
import { MixEditor } from './mixeditor.js';
import { renderUpdate } from './update-ui.js';
import { AddPanel } from './automix-add.js';
import { Sampler } from './sampler.js';
import { camelotColor } from './camelot.js';

const $ = (s) => document.querySelector(s);

class App {
  async init() {
    this.settings = await window.ytdj.settings.get();
    this.masterGain = 1;
    this.learning = false;
    this.decks = {};
    this.decks.A = new Deck('A', this);
    this.decks.B = new Deck('B', this);
    document.querySelectorAll('.ch').forEach((ch) => this.decks[ch.dataset.deck].buildChannel(ch));
    const mk = makeKnob(document.querySelector('[data-knob="master"]'), {
      label: 'MASTER', min: 0, max: 1, value: 1, def: 1,
      onChange: (v) => {
        this.masterGain = v * v;
        this.eachDeck((d) => d.pushMix());
      },
    });
    register('master', { kind: 'range', setNorm: (n) => mk.setNorm(n) }, mk.el);
    this.cueVol = 0.7;
    const ck = makeKnob(document.querySelector('[data-knob="cue"]'), {
      label: 'PHONES', min: 0, max: 1, value: 0.7, def: 0.7,
      onChange: (v) => {
        this.cueVol = v;
        this.eachDeck((d) => d.pushMix());
      },
    });
    register('cueVol', { kind: 'range', setNorm: (n) => ck.setNorm(n) }, ck.el);

    this.xfader = $('#xfader');
    this.xfader.addEventListener('input', () => this.applyXf());
    this.xfader.addEventListener('dblclick', () => ((this.xfader.value = 0), this.applyXf()));
    register('xfader', { kind: 'range', setNorm: (n) => ((this.xfader.value = n * 2 - 1), this.applyXf()) }, this.xfader);
    this.applyXf();

    this.library = new Library(this);
    this.initUpdates();
    this.applyLayout = watchLayout(() => this.settings.layoutMode || 'auto');
    window.ytdj.local.onEvent((ev) => this.library.onLocalEvent(ev));
    window.ytdj.tools.onProgress((p) => this.onToolsProgress(p));
    this.bindRec();
    this.bindHelp();
    this.sampler = new Sampler(this);
    this.bindSampler();
    this.automix = new AutoMix(this);
    this.mixEditor = new MixEditor(this);
    this.bindAutoMix();
    this.midi = new Midi(this);
    this.midi.init();

    window.ytdj.deck.onState((id, s) => this.decks[id]?.onStreamState(s));
    window.ytdj.analysis.onEvent((ev) => {
      this.library.onAnalysisEvent(ev);
      this.eachDeck((d) => d.onAnalysisEvent(ev));
    });
    window.ytdj.auth.onChanged((st) => this.renderAuth(st));
    this.renderAuth(await window.ytdj.auth.status());
    this.checkTools();
    this.applyRouting();
    this.eachDeck((d) => d.setPitch(0));

    this.bindTopbar();
    this.bindKeyboard();
    this.bindLearn();
    this.bindSettings();
    document.querySelectorAll('[data-tip]').forEach((el) => (el.title = el.dataset.tip));
    window.addEventListener('resize', () => this.layoutYtmViews());

    const vuMaster = $('#vu-master i');
    const loop = () => {
      this.eachDeck((d) => d.render());
      let m = 0;
      this.eachDeck((d) => (m = Math.max(m, d.st.playing ? Math.min(1, d.st.level || 0) * Math.min(1, d.channelGain() * 1.4) : 0)));
      vuMaster.style.height = `${Math.round(m * 100)}%`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  eachDeck(fn) {
    fn(this.decks.A);
    fn(this.decks.B);
  }

  other(deck) {
    return deck === this.decks.A ? this.decks.B : this.decks.A;
  }

  // Deck "en cue": el que no suena al aire; si ambos están libres, el que no está sonando.
  cueDeck() {
    const { A, B } = this.decks;
    const live = (d) => d.st.playing && d.isAudible();
    if (live(A) && !live(B)) return B;
    if (live(B) && !live(A)) return A;
    if (!A.track) return A;
    if (!B.track) return B;
    return A.st.playing ? B : A;
  }

  onDeckLoaded() {
    this.library.render();
    // la cola de análisis atiende primero las pistas que están cargadas en un deck
    window.ytdj.backlog.setPriority([this.decks.A, this.decks.B].map((d) => d?.track?.videoId).filter(Boolean));
  }

  applyXf() {
    const x = Number(this.xfader.value);
    const n = (x + 1) / 2;
    let a;
    let b;
    if (this.settings.crossfaderCurve === 'sharp') {
      a = n < 0.95 ? 1 : (1 - n) / 0.05;
      b = n > 0.05 ? 1 : n / 0.05;
    } else {
      a = Math.cos((n * Math.PI) / 2);
      b = Math.sin((n * Math.PI) / 2);
      // Potencia constante, pero sin atenuar en el centro: ambos a 1 hasta ±(centro).
      a = Math.min(1, a * Math.SQRT2);
      b = Math.min(1, b * Math.SQRT2);
    }
    this.decks.A.xf = a;
    this.decks.B.xf = b;
    this.eachDeck((d) => d.pushMix());
  }

  routing() {
    return { mode: 'split', masterLabel: '', cueLabel: '', ...(this.settings.output || {}) };
  }

  applyRouting() {
    this.sampler?.setRouting(this.routing());
    const r = { type: 'routing', ...this.routing() };
    this.eachDeck((d) => d.broadcast(r));
  }

  // ---------- topbar / sesión ----------
  renderAuth(st) {
    $('#session-dot').classList.toggle('ok', st.loggedIn);
    $('#session-label').textContent = st.loggedIn ? 'YouTube Music: sesión iniciada' : 'YouTube Music: sin sesión (habrá anuncios)';
    $('#btn-login').hidden = st.loggedIn;
  }

  async checkTools() {
    const t = await window.ytdj.tools.check();
    this.tools = t;
    const bad = [];
    if (!t.ytdlp) bad.push('yt-dlp sin instalar');
    if (!t.ffmpeg) bad.push('falta ffmpeg');
    // la barra solo avisa si falta algo; el detalle completo está en Ajustes → Herramientas
    $('#tools-status').innerHTML = bad.length ? `<span class="bad">${bad.join(' · ')}</span>` : '';
    $('#tools-detail').innerHTML = [
      t.ytdlp ? `yt-dlp <code>${t.ytdlp.version}</code> en <code>${t.ytdlp.bin}</code>.` : '<b>yt-dlp no está instalado.</b> AlyssDJ lo descarga solo (binario oficial); pulsa “Instalar / actualizar herramientas”.',
      t.ffmpeg ? 'ffmpeg OK.' : `<b>Falta ffmpeg.</b> ${t.ffmpegHint}`,
    ].join(' ');
  }

  onToolsProgress(p) {
    const el = $('#tools-status');
    if (p.stage === 'ytdlp') el.innerHTML = `<span class="tools-bar">Instalando yt-dlp <progress max="1" value="${p.progress || 0}"></progress></span>`;
    else if (p.stage === 'installed') this.toast(`yt-dlp ${p.version} instalado`);
    else if (p.stage === 'error') this.toast(`No se pudo instalar yt-dlp: ${p.error}`, true);
    else if (p.stage === 'done') this.checkTools();
  }

  // ---------- historial ----------
  history() {
    try {
      return JSON.parse(localStorage.getItem('alyssdj:history') || '[]');
    } catch {
      return [];
    }
  }

  logHistory(t) {
    const h = this.history();
    if (h[0]?.videoId === t.videoId) return;
    const { videoId, title, artist, thumb, duration, local, path } = t;
    h.unshift({ videoId, title, artist, thumb, duration, local, path });
    try {
      localStorage.setItem('alyssdj:history', JSON.stringify(h.slice(0, 300)));
    } catch {}
    if (this.library.tab === 'history') this.library.show('history');
  }

  // ---------- grabación ----------
  bindRec() {
    const btn = $('#btn-rec');
    let timer = null;
    let t0 = 0;
    const setRec = (on) => {
      btn.classList.toggle('recording', on);
      clearInterval(timer);
      if (!on) return ($('#btn-rec span').textContent = 'REC');
      const tick = () => {
        const s = Math.floor((Date.now() - t0) / 1000);
        $('#btn-rec span').textContent = `REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      };
      tick();
      timer = setInterval(tick, 500);
    };
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('recording')) {
        const r = await window.ytdj.rec.stop();
        setRec(false);
        if (!r.ok) return this.toast(`No se pudo guardar la grabación: ${r.error}`, true);
        this.toast(`Mezcla guardada (${r.data.seconds} s): ${r.data.file}`);
        window.ytdj.rec.reveal(r.data.file);
      } else {
        const r = await window.ytdj.rec.start();
        if (!r.ok) return this.toast(r.error, true);
        t0 = Date.now();
        setRec(true);
        this.toast('Grabando lo que sale por tu salida de audio…');
      }
    });
    window.ytdj.rec.onEnded((e) => {
      if (btn.classList.contains('recording')) {
        setRec(false);
        this.toast(e.error ? `La grabación se detuvo: ${e.error}` : 'La grabación terminó', !!e.error);
      }
    });
    window.ytdj.rec.state().then((s) => {
      if (s.recording) {
        t0 = s.t0;
        setRec(true);
      }
    });
  }

  bindHelp() {
    const dlg = $('#help');
    $('#btn-help').addEventListener('click', () => dlg.showModal());
    $('#btn-about').addEventListener('click', async () => {
      const info = await window.ytdj.app.info();
      $('#about-ver').textContent = `Versión ${info.version}`;
      $('#about-link').onclick = (e) => (e.preventDefault(), window.ytdj.app.openRepo());
      $('#about').showModal();
    });
    $('#about-close').addEventListener('click', () => $('#about').close());
    $('#help-close').addEventListener('click', () => dlg.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === '?' && !e.target.matches?.('input, textarea, select')) {
        e.preventDefault();
        dlg.open ? dlg.close() : dlg.showModal();
      }
    });
  }

  // ---------- Sampler ----------
  bindSampler() {
    const panel = $('#sampler-panel');
    const btn = $('#btn-sampler');
    const setOpen = (open) => {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.classList.toggle('active', open);
    };
    btn.addEventListener('click', () => setOpen(panel.hidden));
    $('#sp-close').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && setOpen(false));
    this.closeSampler = () => setOpen(false);
  }

  // ---------- AutoMix (vista en la librería) ----------
  bindAutoMix() {
    const am = this.automix;
    const view = $('#am-view');
    $('#btn-automix').addEventListener('click', () => this.library.show('automix'));
    document.addEventListener('alyss:tab', () => this.syncCompact());
    am.subscribe(() => !view.hidden && this.renderAutoMix());
    setInterval(() => !view.hidden && am.on && this.renderAutoMix(), 400);
    $('#amv-toggle').addEventListener('click', () => (am.on ? am.stop() : am.start()));
    $('#amv-mix').addEventListener('click', () => am.mixNow());
    $('#amv-clear').addEventListener('click', () => am.clear());
    $('#amv-fill').addEventListener('click', () => {
      am.failUntil = 0;
      am.ensureQueue(true);
    });
    $('#amv-style').addEventListener('click', (e) => e.target.dataset.v && am.setCfg({ style: e.target.dataset.v }));
    $('#amv-len').addEventListener('input', (e) => am.setCfg({ len: Number(e.target.value) }));
    $('#amv-local').addEventListener('change', (e) => am.setCfg({ preferLocal: e.target.checked }));
    $('#amv-tempo').addEventListener('change', (e) => am.setCfg({ matchTempo: e.target.checked }));
    $('#amv-points').addEventListener('change', (e) => am.setCfg({ optimalPoints: e.target.checked }));
    $('#amv-order').addEventListener('change', (e) => am.setCfg({ smartOrder: e.target.checked }));
    $('#amv-reorder').addEventListener('click', () => am.reorganizeNow());
    $('#amv-undo').addEventListener('click', () => am.undoReorder());
    $('#amv-endless').addEventListener('change', (e) => am.setCfg({ endless: e.target.checked }));
    $('#amv-pop').addEventListener('change', (e) => am.setCfg({ popularity: e.target.checked }));
    $('#amv-popw').addEventListener('change', (e) => am.setCfg({ popWeight: e.target.value }));
    this.addPanel = new AddPanel(this);
    document.addEventListener('alyss:tab', (e) => e.detail === 'automix' && am.refreshPools());

    const list = $('#amv-list');
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      const li = e.target.closest('li[data-i]');
      if (!b || !li) return;
      const i = Number(li.dataset.i);
      if (b.dataset.act === 'up') am.move(i, i - 1);
      if (b.dataset.act === 'down') am.move(i, i + 1);
      if (b.dataset.act === 'next') am.playNext(i);
      if (b.dataset.act === 'rm') am.remove(i);
      if (b.dataset.act === 'edit') this.editQueuePoints(i);
    });
    // Arrastrar para reordenar, o soltar una pista de la librería en la posición que se quiera.
    let from = null;
    list.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li[data-i]');
      if (!li) return;
      from = Number(li.dataset.i);
      this.amDragging = true;
      li.classList.add('dragging');
      e.dataTransfer.setData('text/x-am-index', String(from));
      e.dataTransfer.effectAllowed = 'move';
    });
    list.addEventListener('dragend', () => {
      from = null;
      this.amDragging = false;
      list.querySelectorAll('.dragging, .drop-before').forEach((x) => x.classList.remove('dragging', 'drop-before'));
      this.renderAutoMix();
    });
    list.addEventListener('dragover', (e) => {
      const li = e.target.closest('li[data-i]');
      const ok = from != null || e.dataTransfer.types.includes('application/x-ytdj-track');
      if (!ok) return;
      e.preventDefault();
      list.querySelectorAll('.drop-before').forEach((x) => x.classList.remove('drop-before'));
      li?.classList.add('drop-before');
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const li = e.target.closest('li[data-i]');
      const to = li ? Number(li.dataset.i) : am.queue.length;
      const t = e.dataTransfer.getData('application/x-ytdj-track');
      if (t) {
        const track = JSON.parse(t);
        if (!track.playlist) {
          am.queue = am.queue.filter((x) => x.videoId !== track.videoId);
          am.queue.splice(Math.min(to, am.queue.length), 0, track);
          am.emit();
        }
      } else if (from != null) am.move(from, from < to ? to - 1 : to);
      from = null;
    });
  }

  // ---------- actualizaciones ----------
  initUpdates() {
    const ui = (st) => renderUpdate(st, { toast: (m, e) => this.toast(m, e) });
    window.ytdj.update.onState(ui);
    window.ytdj.update.state().then(ui);
    $('#upd-go').addEventListener('click', async () => {
      const st = await window.ytdj.update.state();
      if (st.stage === 'available') return st.mode === 'notify' ? window.ytdj.update.openRelease(st.url) : window.ytdj.update.download();
      if (st.stage === 'downloaded') {
        const r = await window.ytdj.update.install();
        if (r && !r.ok && r.reason === 'playing') this.toast('Detén los decks para instalar la actualización (o se instalará al cerrar la app).', true);
      }
    });
    $('#upd-later').addEventListener('click', () => window.ytdj.update.later());
    $('#upd-skip').addEventListener('click', () => window.ytdj.update.skip());
    // El proceso principal no reinicia con música sonando: se le informa si algún deck suena.
    let last = null;
    setInterval(() => {
      const p = this.decks.A.st.playing || this.decks.B.st.playing;
      if (p !== last) window.ytdj.update.setPlaying((last = p));
    }, 1000);
  }

  // Con AutoMix activo (o su vista abierta) los decks se compactan para dejarle sitio a la lista.
  syncCompact() {
    document.body.classList.toggle('am-compact', this.automix.on || this.library?.tab === 'automix');
  }

  // Abre el editor de una pista de la cola (la siguiente de la lista es la de la prueba de mezcla).
  editQueuePoints(i) {
    const am = this.automix;
    const t = am.queue[i];
    const ana = am.ana.get(t?.videoId);
    if (!ana) return this.toast('Esta pista aún no está analizada; espera a que termine.', true);
    const nt = am.queue[i + 1];
    this.mixEditor.open(t, ana, nt && am.ana.get(nt.videoId) ? { track: nt, analysis: am.ana.get(nt.videoId) } : null);
  }

  // Desde un deck: la siguiente de la cola de AutoMix (si la hay) es la de la prueba.
  editDeckPoints(deck) {
    const am = this.automix;
    const nt = am.queue[0];
    const nana = nt && am.ana.get(nt.videoId);
    if (!deck.track) return this.toast('Carga una pista en el deck.', true);
    this.mixEditor.open(deck.track, deck.analysis || am.ana.get(deck.track.videoId), nana ? { track: nt, analysis: nana } : null);
  }

  renderAutoMix() {
    const am = this.automix;
    const st = am.snapshot();
    const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const mmss = (sec) => (Number.isFinite(sec) && sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '');
    const badge = (t) => {
      const p = t.prep;
      if (t.local) return ['Archivo local', 'ready'];
      if (p.state === 'ready') return [p.stream ? 'Streaming' : '✓ Lista · local', p.stream ? 'work' : 'ready'];
      if (p.state === 'download') return [`Bajando ${Math.round((p.progress || 0) * 100)}%`, 'work'];
      if (p.state === 'analyze') return ['Analizando…', 'work'];
      if (p.state === 'queued') return ['En cola', 'work'];
      if (p.state === 'error') return ['Falló', 'error'];
      if (p.state === 'stream') return ['Streaming', ''];
      return ['Pendiente', ''];
    };
    $('#btn-automix').classList.toggle('active', st.on);
    this.syncCompact();
    $('#amv-toggle span').textContent = st.on ? 'Detener AutoMix' : 'Iniciar AutoMix';
    $('#amv-mix').disabled = !st.on || !!st.trans;
    $('#amv-mix').classList.toggle('on', !!st.pendingMix);
    $('#amv-mix-label').textContent = st.pendingMix ? 'Cancelar mezcla' : 'Mezclar ahora';
    document.querySelectorAll('#amv-style button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.cfg.style));
    $('#amv-len').value = st.cfg.len;
    $('#amv-len-out').textContent = `${st.cfg.len} s`;
    $('#amv-local').checked = st.cfg.preferLocal;
    $('#amv-tempo').checked = st.cfg.matchTempo;
    $('#amv-points').checked = st.cfg.optimalPoints;
    $('#amv-order').checked = st.cfg.smartOrder;
    $('#amv-undo').disabled = !st.chain.canUndo;
    $('#amv-reorder').disabled = st.queue.length < 2;
    $('#amv-quality').textContent = st.queue.length ? `${st.chain.analyzed}/${st.queue.length} analizadas${st.chain.analyzed > 1 ? ` · transiciones ${st.chain.total / Math.max(1, st.chain.analyzed) < 6 ? 'muy buenas' : st.chain.total / Math.max(1, st.chain.analyzed) < 14 ? 'aceptables' : 'flojas'}` : ''}` : '';
    $('#amv-endless').checked = st.cfg.endless;
    $('#amv-pop').checked = st.cfg.popularity !== false;
    $('#amv-popw').value = st.cfg.popWeight || 'mid';
    $('#amv-popw').disabled = st.cfg.popularity === false;
    this.addPanel?.renderSuggestions(st.suggestions || []);
    this.automix.analyzeSuggestions(st.suggestions || []);
    $('#amv-cur').textContent = st.cur ? st.cur.title || '—' : '—';
    const planKinds = { outro: 'outro', rotura: 'rotura', final: 'final' };
    $('#amv-cur-sub').textContent = st.cur
      ? [st.cur.artist, `Deck ${st.curDeck}`, st.curInfo?.bpm ? `${st.curInfo.bpm.toFixed(1)} BPM` : '', st.curInfo?.camelot || '', st.plan && Number.isFinite(st.pos) ? `mezcla en ${mmss(Math.max(0, st.plan.exitAt - st.pos))} (${planKinds[st.plan.kind] || 'final'}, ${mmss(st.plan.exitAt)})` : Number.isFinite(st.rem) ? `termina en ${mmss(st.rem)}` : ''].filter(Boolean).join(' · ')
      : 'Carga una pista y pulsa Iniciar, o usa “Radio” en la librería';
    $('#amv-next').textContent = st.next ? st.next.title || '—' : st.on ? 'Buscando en la radio…' : '—';
    $('#amv-next-sub').textContent = st.next ? [st.next.artist, st.queue[0] ? badge(st.queue[0])[0] : '', st.queue[0]?.bpm ? `${st.queue[0].bpm.toFixed(1)} BPM` : '', st.queue[0]?.jump ? 'salto de BPM' : ''].filter(Boolean).join(' · ') : '';
    $('#amv-status').textContent = st.trans
      ? `Mezclando ${st.trans.from} → ${st.trans.to} · ${{ bass: 'bass swap', filter: 'filtro', crossfade: 'fundido' }[st.trans.style]}${st.trans.tempo ? ' · tempo igualado' : ''}${st.trans.warnings?.length ? ` · ${st.trans.warnings.join(', ')}` : ''}`
      : st.on ? (st.pendingMix ? (st.pendingMix.ready ? `Mezclando en ${st.pendingMix.waitS.toFixed(1)} s · salida en ${{ phrase: 'frase', bar: 'compás', edit: 'tu punto', now: 'este instante', outro: 'el final', break: 'una rotura', auto: 'un punto de la pista' }[st.pendingMix.kind] || 'un punto de la pista'}` : 'Mezclará en cuanto la siguiente esté lista') : 'AutoMix activo') : 'Detenido';
    $('#amv-bar-wrap').hidden = !st.trans;
    if (st.trans) $('#amv-bar').style.width = `${Math.round(st.trans.progress * 100)}%`;
    $('#amv-note').textContent = st.note || '';

    if (this.amDragging) return; // no reconstruir la lista mientras se arrastra
    const sig = st.queue.map((t) => `${t.videoId}:${t.prep.state}:${Math.round((t.prep.progress || 0) * 20)}:${t.bpm}:${t.gapPct}:${t.pinned ? 1 : 0}:${t.energy}:${t.cost}`).join('|') + `|${st.curInfo?.bpm}`;
    const list = $('#amv-list');
    if (list.dataset.sig === sig) return;
    list.dataset.sig = sig;
    list.innerHTML = st.queue.map((t, i) => {
      const [label, cls] = badge(t);
      const art = t.thumb ? `<img src="${esc(t.thumb)}" alt="" loading="lazy">` : '<div class="noart">♪</div>';
      return `<li class="am-item${i === 0 ? ' head' : ''}" data-i="${i}" draggable="true">
        <span class="am-grip" aria-hidden="true">⋮⋮</span><span class="am-num">${i + 1}</span>${art}
        <div class="am-info"><b title="${esc(t.title)}">${esc(t.title)}${t.pinned ? '<span class="am-pin" title="Colocada por ti: no se reordena sola">📌 fija</span>' : ''}</b><small>${esc(t.artist)}</small></div>
        <span class="am-meta">
          <span class="bpm">${t.bpm ? t.bpm.toFixed(1) : '—'}</span>
          ${t.camelot ? `<span class="kchip" style="--k:${camelotColor(t.camelot)}">${t.camelot}</span>` : '<span class="kchip">—</span>'}
          <span class="am-energy" title="Energía ${t.energy ?? '—'}"><i style="width:${t.energy ?? 0}%"></i></span>
          <span class="am-q ${t.cost == null ? '' : t.cost < 6 ? 'good' : t.cost < 14 ? 'ok' : 'poor'}" title="Calidad de la transición desde la anterior (BPM, tonalidad y energía): ${t.cost == null ? 'sin analizar' : `${t.cost < 6 ? 'muy buena' : t.cost < 14 ? 'aceptable' : 'floja'} · coste ${t.cost}`}">${t.cost == null ? '·' : t.cost < 6 ? '●●●' : t.cost < 14 ? '●●○' : '●○○'}</span>
          <span class="am-gap ${t.jump ? 'jump' : Math.abs(t.gapPct || 0) > 4 ? 'warn' : ''}" title="${t.jump ? 'Salto brusco de BPM: la mezcla será larga, con filtro y sin forzar el tempo' : 'Diferencia de BPM con lo que suena'}">${t.gapPct == null ? '' : `${t.gapPct > 0 ? '+' : ''}${t.gapPct.toFixed(1)} %${t.jump ? ' ⚠' : ''}`}</span>
        </span>
        <span class="am-badge ${cls}" title="${esc(t.prep.error || '')}">${label}</span>
        <span class="am-dur">${mmss(t.duration)}</span>
        <span class="am-actions">
          <button data-act="edit" class="ghost" title="Editar los puntos de mezcla" aria-label="Editar los puntos de mezcla">✎</button>
          <button data-act="next" class="ghost" title="Poner a continuación" aria-label="Poner a continuación">⤒</button>
          <button data-act="up" class="ghost" title="Subir" aria-label="Subir"${i === 0 ? ' disabled' : ''}>▲</button>
          <button data-act="down" class="ghost" title="Bajar" aria-label="Bajar"${i === st.queue.length - 1 ? ' disabled' : ''}>▼</button>
          <button data-act="rm" class="ghost" title="Quitar de la cola" aria-label="Quitar de la cola">✕</button>
        </span></li>`;
    }).join('');
  }

  // Inicio de sesión: Google bloquea el login embebido, así que se importa la sesión de un navegador instalado.
  bindLogin() {
    const dlg = $('#login');
    const sel = $('#login-browser');
    const msg = $('#login-msg');
    const importBtn = $('#login-import');
    const say = (text, kind = '') => {
      msg.textContent = text;
      msg.className = `login-msg ${kind}`;
    };
    $('#btn-login').addEventListener('click', async () => {
      say('');
      const list = await window.ytdj.auth.browsers();
      sel.innerHTML = list.map((b) => `<option value="${b.id}">${b.label}${b.found ? '' : ' (no detectado)'}</option>`).join('');
      dlg.showModal();
    });
    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      say('Importando la sesión… puede tardar unos segundos.');
      const r = await window.ytdj.auth.importBrowser(sel.value);
      importBtn.disabled = false;
      if (!r.ok) return say(r.error, 'err');
      say(`Se importaron ${r.data.count} cookies. Comprobando con YouTube Music…`);
      const v = await window.ytdj.auth.verify();
      if (v.loggedIn === false) {
        return say('Las cookies se importaron, pero YouTube Music no reconoce la sesión (quizá caducó en el navegador). Abre music.youtube.com allí, comprueba que sigues dentro y reintenta.', 'err');
      }
      say(v.loggedIn ? 'Listo: sesión iniciada. Con Premium no verás anuncios.' : 'Sesión importada. Si ves anuncios en los decks, la cuenta no tiene Premium activo.', 'ok');
      setTimeout(() => dlg.open && dlg.close(), 2200);
    });
    $('#login-direct').addEventListener('click', () => {
      say('Se abrió la ventana de Google. Si dice “No puedes acceder”, cierra esa ventana y usa Importar sesión.');
      window.ytdj.auth.login();
    });
    $('#login-close').addEventListener('click', () => dlg.close());
  }

  bindTopbar() {
    this.bindLogin();
    $('#btn-settings').addEventListener('click', () => this.openSettings());
    $('#btn-midi-learn').addEventListener('click', () => this.setLearning(!this.learning));
  }

  toast(msg, err = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', err);
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (t.hidden = true), err ? 5000 : 2500);
  }

  // ---------- vista YTM de cada deck ----------
  toggleYtmView(id) {
    const f = $(`#ytm-float-${id}`);
    f.hidden = !f.hidden;
    f.querySelector('[data-close]').onclick = () => this.toggleYtmView(id);
    this.layoutYtmViews();
  }

  layoutYtmViews() {
    for (const id of ['A', 'B']) {
      const f = $(`#ytm-float-${id}`);
      if (f.hidden) window.ytdj.deck.show(id, null);
      else {
        const r = f.querySelector('.ytm-body').getBoundingClientRect();
        window.ytdj.deck.show(id, { x: r.x, y: r.y, width: r.width, height: r.height });
      }
    }
  }

  // ---------- teclado ----------
  bindKeyboard() {
    const keys = {
      z: 'deckA.play', x: 'deckA.cue', q: 'deckA.sync', a: 'deckA.nudgeDown', s: 'deckA.nudgeUp',
      1: 'deckA.hotcue1', 2: 'deckA.hotcue2', 3: 'deckA.hotcue3', 4: 'deckA.hotcue4',
      m: 'deckB.play', n: 'deckB.cue', p: 'deckB.sync', k: 'deckB.nudgeDown', l: 'deckB.nudgeUp',
      7: 'deckB.hotcue1', 8: 'deckB.hotcue2', 9: 'deckB.hotcue3', 0: 'deckB.hotcue4',
    };
    const typing = (e) => !!e.target.matches?.('input[type=search], input:not([type]), textarea, select');
    window.addEventListener('keydown', (e) => {
      if (/^F[1-8]$/.test(e.key) && !e.repeat && !typing(e)) return e.preventDefault(), this.sampler.key(e.key);
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight' && e.shiftKey) return e.preventDefault(), this.automix.mixNow();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.xfader.value = Math.max(-1, Math.min(1, Number(this.xfader.value) + (e.key === 'ArrowLeft' ? -0.05 : 0.05)));
        this.applyXf();
        e.preventDefault();
        return;
      }
      const id = keys[e.key.toLowerCase()] || keys[e.code.replace('Digit', '')];
      if (!id || e.repeat) return;
      e.preventDefault();
      const hc = id.match(/^deck(.)\.hotcue(\d)$/);
      if (hc && e.shiftKey) return this.decks[hc[1]].hotcue(Number(hc[2]) - 1, true);
      press(id, true);
    });
    window.addEventListener('keyup', (e) => {
      if (typing(e)) return;
      const id = keys[e.key.toLowerCase()] || keys[e.code.replace('Digit', '')];
      if (id && /cue$|nudge/.test(id)) press(id, false);
    });
  }

  // ---------- MIDI learn ----------
  setLearning(on) {
    this.learning = on;
    document.body.classList.toggle('learning', on);
    if (!on) this.disarm();
    else this.toast(this.midi.devices().length ? 'MIDI learn: clic en un control y mueve el control físico.' : 'MIDI learn activo, pero no se detecta ningún dispositivo MIDI.');
  }

  disarm() {
    this.midi.arm(null);
    document.querySelectorAll('.armed').forEach((e) => e.classList.remove('armed'));
  }

  bindLearn() {
    const block = (e) => {
      if (!this.learning) return;
      const el = e.target.closest('[data-ctl]');
      if (!el || el.closest('.topbar')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'pointerdown') {
        this.disarm();
        el.classList.add('armed');
        this.midi.arm(el.dataset.ctl);
      }
    };
    for (const t of ['pointerdown', 'click', 'input', 'mousedown']) document.addEventListener(t, block, true);
  }

  onMidiDevices(names) {
    $('#midi-devices').textContent = names.length ? `Dispositivos: ${names.join(', ')}` : 'No hay dispositivos MIDI conectados.';
  }

  // ---------- ajustes ----------
  async listOutputs() {
    let devs = await navigator.mediaDevices.enumerateDevices();
    if (devs.some((d) => d.kind === 'audiooutput' && !d.label)) {
      // Chromium solo expone los nombres tras un permiso de audio; se pide una vez y se cierra al instante.
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        devs = await navigator.mediaDevices.enumerateDevices();
      } catch {}
    }
    return devs.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  }

  async openSettings() {
    const f = $('#settings form');
    const s = this.settings;
    f.ytdlpPath.value = s.ytdlpPath || '';
    f.cookieSource.value = s.cookieSource;
    f.layoutMode.value = s.layoutMode || 'auto';
    f.saveOnAnalyze.checked = s.saveOnAnalyze !== false;
    f.saveOnPlay.checked = s.saveOnPlay !== false;
    f.preferSaved.checked = s.preferSaved !== false;
    f.autoUpdate.checked = s.autoUpdate !== false;
    f.libraryDir.value = s.libraryDir || (await window.ytdj.settings.libraryDir());
    f.autoAnalyzeCue.checked = !!s.autoAnalyzeCue;
    f.outputMode.value = s.output?.mode || 'split';
    f.pitchRange.value = String(s.pitchRange || 8);
    f.crossfaderCurve.value = s.crossfaderCurve || 'smooth';
    f.autoAnalyzeLocal.checked = s.autoAnalyzeLocal !== false;
    this.renderMusicDirs();
    const outs = await this.listOutputs();
    const opts = (sel, cur, none) => {
      sel.innerHTML = `<option value="">${none}</option>` + outs.map((d) => `<option>${d.label.replace(/</g, '&lt;')}</option>`).join('');
      sel.value = cur || '';
    };
    opts(f.masterLabel, s.output?.masterLabel, 'Predeterminado del sistema');
    opts(f.cueLabel, s.output?.cueLabel, 'Sin auriculares');
    const rs = await window.ytdj.rec.sources();
    const monitors = rs.ok ? rs.data.sources : [];
    f.recordSource.innerHTML = `<option value="">Predeterminada del sistema</option>` + monitors.map((m) => `<option>${m}</option>`).join('');
    f.recordSource.value = s.recordSource || '';
    this.onMidiDevices(this.midi.devices());
    if (this.midi.error) $('#midi-devices').textContent = `MIDI no disponible: ${this.midi.error}`;
    this.setSettingsPane('tools');
    $('#settings').showModal();
  }

  // Una sección de ajustes a la vez; flechas arriba/abajo cambian de sección (patrón de pestañas WAI-ARIA).
  setSettingsPane(id) {
    document.querySelectorAll('#settings .set-nav button').forEach((b) => {
      const on = b.dataset.pane === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('#settings .set-pane').forEach((p) => (p.hidden = p.dataset.pane !== id));
  }

  bindSettingsNav() {
    const nav = document.querySelector('#settings .set-nav');
    nav.addEventListener('click', (e) => e.target.dataset.pane && this.setSettingsPane(e.target.dataset.pane));
    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const tabs = [...nav.querySelectorAll('button')];
      const i = tabs.indexOf(document.activeElement);
      const next = tabs[(i + (e.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length];
      e.preventDefault();
      this.setSettingsPane(next.dataset.pane);
      next.focus();
    });
  }

  async renderMusicDirs() {
    this.settings = await window.ytdj.settings.get();
    const ul = $('#music-dirs');
    ul.textContent = '';
    for (const dir of this.settings.musicDirs || []) {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = dir;
      span.title = dir;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'icon-btn';
      x.setAttribute('aria-label', `Quitar ${dir}`);
      x.innerHTML = '<svg class="ic"><use href="#i-close"/></svg>';
      x.addEventListener('click', async () => {
        await window.ytdj.local.removeFolder(dir);
        this.renderMusicDirs();
        if (this.library.tab === 'local') this.library.show('local');
      });
      li.append(span, x);
      ul.append(li);
    }
  }

  bindSettings() {
    this.bindSettingsNav();
    const dlg = $('#settings');
    const f = dlg.querySelector('form');
    dlg.addEventListener('close', async () => {
      const prevYtdlp = this.settings.ytdlpPath;
      this.settings = await window.ytdj.settings.set({
        ytdlpPath: f.ytdlpPath.value.trim(),
        cookieSource: f.cookieSource.value,
        saveOnAnalyze: f.saveOnAnalyze.checked,
        saveOnPlay: f.saveOnPlay.checked,
        preferSaved: f.preferSaved.checked,
        autoUpdate: f.autoUpdate.checked,
        libraryDir: f.libraryDir.value,
        autoAnalyzeCue: f.autoAnalyzeCue.checked,
        output: { mode: f.outputMode.value, masterLabel: f.masterLabel.value, cueLabel: f.cueLabel.value },
        pitchRange: Number(f.pitchRange.value),
        crossfaderCurve: f.crossfaderCurve.value,
        layoutMode: f.layoutMode.value,
        recordSource: f.recordSource.value,
        autoAnalyzeLocal: f.autoAnalyzeLocal.checked,
      });
      this.applyLayout?.();
      this.applyRouting();
      this.applyXf();
      if (prevYtdlp !== this.settings.ytdlpPath) this.checkTools();
    });
    $('#btn-open-cache').addEventListener('click', () => window.ytdj.analysis.openCache());
    $('#btn-pick-library').addEventListener('click', async () => {
      const dir = await window.ytdj.settings.pickDir();
      if (dir) $('#settings form').libraryDir.value = dir;
    });
    $('#btn-check-update').addEventListener('click', () => window.ytdj.update.check());
    $('#btn-open-library').addEventListener('click', () => window.ytdj.settings.openPath($('#settings form').libraryDir.value));
    $('#btn-install-tools').addEventListener('click', async () => {
      this.toast('Comprobando herramientas…');
      await window.ytdj.tools.install();
    });
    $('#btn-add-folder-2').addEventListener('click', () => this.library.chooseFolder());
    $('#btn-logout').addEventListener('click', async () => this.renderAuth(await window.ytdj.auth.logout()));
    $('#btn-midi-clear').addEventListener('click', () => {
      this.midi.clear();
      this.toast('Mapeo MIDI borrado');
    });
    $('#btn-midi-export').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([this.midi.export()], { type: 'application/json' }));
      a.download = 'ytdj-midi.json';
      a.click();
    });
    $('#btn-midi-import').addEventListener('click', () => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = '.json,application/json';
      i.onchange = async () => {
        try {
          this.midi.import(await i.files[0].text());
          this.toast('Mapeo MIDI importado');
        } catch (e) {
          this.toast(`Mapeo inválido: ${e.message}`, true);
        }
      };
      i.click();
    });
  }
}

window.__app = new App();
window.__app.init();
window.__controls = controls;
