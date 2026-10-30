import { controls, register, press } from './controls.js';
import { makeKnob } from './knob.js';
import { Deck } from './deck.js';
import { Library } from './library.js';
import { Midi } from './midi.js';
import { AutoMix } from './automix.js';
import { Sampler } from './sampler.js';

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
    document.body.classList.toggle('no-mini', this.settings.miniVideo === false);
    window.ytdj.deck.onFrame((id, url) => this.decks[id]?.onFrame(url));
    window.ytdj.local.onEvent((ev) => this.library.onLocalEvent(ev));
    window.ytdj.tools.onProgress((p) => this.onToolsProgress(p));
    this.bindRec();
    this.bindHelp();
    this.sampler = new Sampler(this);
    this.bindSampler();
    this.automix = new AutoMix(this);
    this.bindAutoMix();
    this.videoMode = 'auto';
    this.videoState = await window.ytdj.video.state();
    this.lastShown = 'A';
    this.bindVideoPanel();
    if (this.settings.videoPref) this.eachDeck((d) => d.sendStream({ type: 'videoPref', on: true }));
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
    $('#tools-status').innerHTML = bad.length
      ? `<span class="bad">${bad.join(' · ')}</span>`
      : `yt-dlp ${t.ytdlp.version} · ffmpeg ✓`;
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
    $('#help-close').addEventListener('click', () => dlg.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === '?' && !e.target.matches('input, textarea, select')) {
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
      if (open) for (const id of ['video-panel', 'automix-panel']) $(`#${id}`).hidden = true;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.classList.toggle('active', open);
    };
    btn.addEventListener('click', () => setOpen(panel.hidden));
    $('#sp-close').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && setOpen(false));
    this.closeSampler = () => setOpen(false);
  }

  // ---------- AutoMix ----------
  bindAutoMix() {
    const am = this.automix;
    const panel = $('#automix-panel');
    const btn = $('#btn-automix');
    const setOpen = (open) => {
      if (open) {
        $('#video-panel').hidden = true;
        this.closeSampler();
      }
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) render();
    };
    const fmt = (t) => (t ? `<b>${t.title || '—'}</b>${t.artist ? ` · ${t.artist}` : ''}` : '—');
    const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const render = () => {
      const st = am.snapshot();
      btn.classList.toggle('active', st.on);
      $('#am-toggle span').textContent = st.on ? 'Detener AutoMix' : 'Iniciar AutoMix';
      $('#am-skip').disabled = !st.on || st.progress != null;
      document.querySelectorAll('#am-style button').forEach((b) => b.classList.toggle('on', b.dataset.v === am.cfg.style));
      $('#am-len').value = am.cfg.len;
      $('#am-len-out').textContent = `${am.cfg.len} s`;
      $('#am-tempo').checked = am.cfg.matchTempo;
      $('#am-analyze').checked = am.cfg.analyze;
      $('#am-endless').checked = am.cfg.endless;
      const lines = [];
      if (st.on) {
        lines.push(`Suena: ${fmt(st.cur)}`);
        lines.push(`Sigue: ${st.next ? `${fmt(st.next)}${st.nextReady ? ' ✓' : ' …'}` : 'buscando en la radio…'}`);
        if (Number.isFinite(st.rem)) lines.push(`Termina en ${Math.max(0, Math.round(st.rem))} s`);
      } else lines.push('Detenido. Carga una pista y pulsa Iniciar, o usa “Radio” en la librería.');
      if (st.note) lines.push(`<i>${esc(st.note)}</i>`);
      $('#am-now').innerHTML = lines.join('<br>');
      const bar = $('#am-bar');
      bar.hidden = st.progress == null;
      if (st.progress != null) bar.firstElementChild.style.width = `${Math.round(st.progress * 100)}%`;
      $('#am-queue').innerHTML = st.queue.slice(0, 8).map((t, i) => `<li><span class="n">${i + 1}</span><span class="t" title="${esc(t.title)}">${esc(t.title)} <small>${esc(t.artist)}</small></span><button class="icon-btn" data-rm="${i}" aria-label="Quitar de la cola"><svg class="ic"><use href="#i-close"/></svg></button></li>`).join('');
    };
    am.subscribe(() => !panel.hidden && render());
    setInterval(() => !panel.hidden && am.on && render(), 500);
    btn.addEventListener('click', () => setOpen(panel.hidden));
    $('#am-close').addEventListener('click', () => setOpen(false));
    $('#btn-video').addEventListener('click', () => (panel.hidden = true));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && setOpen(false));
    $('#am-toggle').addEventListener('click', () => (am.on ? am.stop() : am.start()));
    $('#am-skip').addEventListener('click', () => am.skip());
    $('#am-clear').addEventListener('click', () => am.clear());
    $('#am-style').addEventListener('click', (e) => e.target.dataset.v && am.setCfg({ style: e.target.dataset.v }));
    $('#am-len').addEventListener('input', (e) => am.setCfg({ len: Number(e.target.value) }));
    $('#am-tempo').addEventListener('change', (e) => am.setCfg({ matchTempo: e.target.checked }));
    $('#am-analyze').addEventListener('change', (e) => am.setCfg({ analyze: e.target.checked }));
    $('#am-endless').addEventListener('change', (e) => am.setCfg({ endless: e.target.checked }));
    $('#am-queue').addEventListener('click', (e) => {
      const b = e.target.closest('[data-rm]');
      if (b) am.remove(Number(b.dataset.rm));
    });
  }

  // ---------- pantalla de video ----------
  autoShow() {
    const score = (d) => (d.st.playing ? 1 : 0.25) * d.channelGain();
    const a = score(this.decks.A);
    const b = score(this.decks.B);
    if (a > b * 1.3) return 'A';
    if (b > a * 1.3) return 'B';
    return a === 0 && b === 0 ? this.lastShown : 'split';
  }

  resolveVideoShow() {
    return this.videoMode === 'auto' ? this.autoShow() : this.videoMode;
  }

  async openVideo(id) {
    this.videoMode = id;
    this.videoState = await window.ytdj.video.open({ show: id });
    this.renderVideoPanel();
  }

  async refreshDisplays() {
    const sel = $('#vp-display');
    const list = await window.ytdj.video.displays();
    const cur = sel.value;
    sel.innerHTML = list.map((d) => `<option value="${d.id}">${d.label}</option>`).join('');
    sel.value = cur && list.some((d) => String(d.id) === cur) ? cur : String((list.find((d) => !d.primary) || list[0]).id);
  }

  renderVideoPanel() {
    const st = this.videoState;
    $('#vp-toggle span').textContent = st.open ? 'Cerrar ventana de video' : 'Abrir ventana de video';
    $('#btn-video').classList.toggle('active', !!st.open);
    document.querySelectorAll('#vp-show button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.videoMode));
    $('#vp-full').classList.toggle('on', !!st.fullscreen);
  }

  bindVideoPanel() {
    const panel = $('#video-panel');
    const btn = $('#btn-video');
    const setOpen = (open) => {
      if (open) {
        $('#automix-panel').hidden = true;
        this.closeSampler();
      }
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) this.refreshDisplays().then(() => this.renderVideoPanel());
    };
    const displayId = () => Number($('#vp-display').value) || undefined;
    btn.addEventListener('click', () => setOpen(panel.hidden));
    $('#vp-close').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && setOpen(false));
    $('#vp-toggle').addEventListener('click', async () => {
      this.videoState = this.videoState.open
        ? await window.ytdj.video.close()
        : await window.ytdj.video.open({ show: this.resolveVideoShow(), displayId: displayId() });
      this.renderVideoPanel();
    });
    $('#vp-full').addEventListener('click', async () => {
      this.videoState = await window.ytdj.video.open({ show: this.resolveVideoShow(), displayId: displayId(), fullscreen: !this.videoState.fullscreen });
      this.renderVideoPanel();
    });
    $('#vp-show').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      this.videoMode = b.dataset.v;
      if (this.videoMode !== 'auto') window.ytdj.video.show(this.videoMode);
      this.renderVideoPanel();
    });
    $('#vp-display').addEventListener('change', async () => {
      if (this.videoState.open) this.videoState = await window.ytdj.video.open({ displayId: displayId() });
      this.renderVideoPanel();
    });
    $('#vp-pref').checked = !!this.settings.videoPref;
    $('#vp-pref').addEventListener('change', async (e) => {
      this.settings = await window.ytdj.settings.set({ videoPref: e.target.checked });
      this.eachDeck((d) => d.sendStream({ type: 'videoPref', on: e.target.checked }));
    });
    window.ytdj.video.onState((st) => {
      this.videoState = st;
      this.renderVideoPanel();
    });
    // Modo Auto: la ventana sigue al deck que está al aire (con un respiro para no parpadear al cruzar).
    let pending = null;
    setInterval(() => {
      if (!this.videoState.open || this.videoMode !== 'auto') return;
      const want = this.autoShow();
      if (want === this.lastShown) return (pending = null);
      if (pending?.want !== want) pending = { want, since: performance.now() };
      else if (performance.now() - pending.since > 600) {
        this.lastShown = want;
        window.ytdj.video.show(want);
        pending = null;
      }
    }, 200);
  }

  bindTopbar() {
    $('#btn-login').addEventListener('click', () => window.ytdj.auth.login());
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
    const typing = (e) => e.target.matches('input[type=search], input:not([type]), textarea, select');
    window.addEventListener('keydown', (e) => {
      if (/^F[1-8]$/.test(e.key) && !e.repeat && !typing(e)) return e.preventDefault(), this.sampler.key(e.key);
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
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
    f.keepAudio.checked = !!s.keepAudio;
    f.autoAnalyzeCue.checked = !!s.autoAnalyzeCue;
    f.outputMode.value = s.output?.mode || 'split';
    f.pitchRange.value = String(s.pitchRange || 8);
    f.crossfaderCurve.value = s.crossfaderCurve || 'smooth';
    f.miniVideo.checked = s.miniVideo !== false;
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
    $('#settings').showModal();
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
    const dlg = $('#settings');
    const f = dlg.querySelector('form');
    dlg.addEventListener('close', async () => {
      const prevYtdlp = this.settings.ytdlpPath;
      this.settings = await window.ytdj.settings.set({
        ytdlpPath: f.ytdlpPath.value.trim(),
        cookieSource: f.cookieSource.value,
        keepAudio: f.keepAudio.checked,
        autoAnalyzeCue: f.autoAnalyzeCue.checked,
        output: { mode: f.outputMode.value, masterLabel: f.masterLabel.value, cueLabel: f.cueLabel.value },
        pitchRange: Number(f.pitchRange.value),
        crossfaderCurve: f.crossfaderCurve.value,
        recordSource: f.recordSource.value,
        miniVideo: f.miniVideo.checked,
        autoAnalyzeLocal: f.autoAnalyzeLocal.checked,
      });
      document.body.classList.toggle('no-mini', !this.settings.miniVideo);
      this.eachDeck((d) => d.setMiniVideo(this.settings.miniVideo));
      this.applyRouting();
      this.applyXf();
      if (prevYtdlp !== this.settings.ytdlpPath) this.checkTools();
    });
    $('#btn-open-cache').addEventListener('click', () => window.ytdj.analysis.openCache());
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
