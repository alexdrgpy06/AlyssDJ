// Motor de un deck sobre un HTMLMediaElement. Las dos fuentes lo comparten:
//  - stream: el <video> de music.youtube.com (sesión Premium), dentro de la vista del deck
//  - local:  un <audio> con el archivo que bajó yt-dlp, dentro del renderer
// Lo que cambia entre ambas es el "adapter" (cómo se carga una pista y se lee su metadata).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dsp-chain.js'), (() => { try { return require('./scratch.js'); } catch { return null; } })());
  else root.YTDJEngine = factory(root.YTDJChain, root.YTDJScratch);
})(typeof self !== 'undefined' ? self : this, function (Chain, Scratch) {
  const STATE_MS = 33;

  function createDeckEngine({ adapter, onState }) {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const chain = Chain.create(ctx);
    const sources = new WeakMap();
    let media = null;
    let rate = 1;
    let bend = 0;
    let bendUntil = 0;
    let keylock = true;
    let loop = null;
    let wantPlaying = false;
    let lastEmit = 0;
    let ramp = 1; // factor de velocidad del arranque/freno del plato
    let rampTimer = null;
    let held = null; // plato sujeto: { wasPlaying, buffered }
    let scratch = null;
    let stems = null; // stems activos: { el, orig, src, split, merge, gain, vol, mute, solo, fade, timer }
    let stemsLag = 0.05; // s que tarda un <audio> en empezar a sonar tras play(); se mide en cada activación

    function attach(el) {
      if (!el || el === media) return;
      media = el;
      let src = sources.get(el);
      if (!src) {
        src = ctx.createMediaElementSource(el);
        sources.set(el, src);
      }
      src.connect(chain.input);
      applyRate();
    }

    function effectiveRate() {
      return rate * (1 + (performance.now() < bendUntil ? bend : 0)) * ramp;
    }

    function applyRate() {
      if (!media) return;
      const r = Math.max(0.0625, effectiveRate()); // el <audio> no baja de ahí
      if (Math.abs(media.playbackRate - r) > 1e-4) media.playbackRate = r;
      if (media.preservesPitch !== keylock) media.preservesPitch = keylock;
    }

    async function play() {
      wantPlaying = true;
      if (ctx.state !== 'running') await ctx.resume();
      if (adapter.play) return adapter.play();
      return media && media.play();
    }

    function pause() {
      wantPlaying = false;
      if (adapter.pause) return adapter.pause();
      if (media) media.pause();
    }

    function seek(t) {
      if (!media) return;
      const d = media.duration || Infinity;
      media.currentTime = Math.max(0, Math.min(t, d - 0.05));
    }

    // Rampa del factor de velocidad (freno y arranque del vinilo).
    function rampTo(target, ms) {
      clearInterval(rampTimer);
      const from = ramp;
      const t0 = performance.now();
      rampTimer = setInterval(() => {
        const f = Math.min(1, (performance.now() - t0) / ms);
        ramp = from + (target - from) * f;
        applyRate();
        if (f >= 1) clearInterval(rampTimer);
      }, 16);
    }

    // Plato: sujetar, mover, soltar. Con buffer decodificado suena el worklet (scratch real, hacia atrás incluido);
    // sin él, freno y arranque suaves del <audio> y búsqueda al arrastrar.
    async function scratchOp(cmd) {
      if (cmd.op === 'prepare') {
        if (!Scratch || !media || stems) return false; // el FLAC de 8 canales no se decodifica para el scratch
        scratch = scratch || Scratch.create(ctx, chain.input);
        return scratch.prepare(media.currentSrc);
      }
      if (cmd.op === 'hold') {
        if (!media || held) return held?.buffered ?? false;
        const wasPlaying = !media.paused;
        const buffered = !!(scratch && scratch.ready && scratch.url === media.currentSrc);
        held = { wasPlaying, buffered, wanted: wantPlaying };
        if (buffered) {
          sources.get(media)?.disconnect();
          media.pause();
          wantPlaying = false;
          scratch.hold(media.currentTime, wasPlaying ? effectiveRate() : 0, 0);
        } else if (wasPlaying) rampTo(0.06, 150);
        return buffered;
      }
      if (cmd.op === 'move') {
        if (!held) return false;
        if (held.buffered) scratch.move(cmd.v || 0);
        else if (cmd.d) seek(media.currentTime + cmd.d);
        return true;
      }
      if (cmd.op === 'release') {
        if (!held) return false;
        const h = held;
        held = null;
        if (h.buffered) {
          const p = await scratch.release();
          sources.get(media)?.connect(chain.input);
          seek(p);
          wantPlaying = h.wanted;
          if (h.wasPlaying) {
            ramp = 0.06;
            rampTo(1, 300);
            await play();
          }
        } else if (h.wasPlaying) rampTo(1, 300);
        return true;
      }
      return false;
    }

    // Stems manuales: un segundo <audio> con el FLAC de 8 canales (batería, bajo, resto, voz; L/R) sustituye a la pista completa.
    // Una matriz ChannelSplitter(8) → 4 mezcladores estéreo → 4 ganancias lleva cada stem a la cadena; el elemento hereda
    // sincronía, keylock, loops y seek, así que todo lo demás del deck sigue usando `media`.
    function applyStemGains() {
      if (!stems) return;
      const solo = stems.solo.some(Boolean);
      const now = ctx.currentTime;
      stems.gain.forEach((g, i) => {
        const on = !stems.mute[i] && (!solo || stems.solo[i]);
        g.gain.cancelScheduledValues(now); // si aún está el fundido de entrada, se parte del valor actual
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.setTargetAtTime(on ? stems.vol[i] : 0, now, 0.015); // ≈ 15 ms: sin chasquidos
      });
    }

    const STEM_FADE = 0.04; // s: fundido cruzado entre la pista completa y los stems (sin salto audible)

    // Suelta el grafo de stems. Si la pista completa seguía en un fundido, la deja conectada directo a la cadena.
    function stemsTeardown(restore = true) {
      if (!stems) return;
      const s = stems;
      stems = null;
      clearTimeout(s.timer);
      try {
        s.el.pause();
        s.src.disconnect();
        s.split.disconnect();
        s.gain.forEach((g) => g.disconnect());
        s.fade?.disconnect();
        s.el.removeAttribute('src');
        s.el.load();
      } catch { /* el grafo ya estaba suelto */ }
      if (restore) {
        const os = sources.get(s.orig);
        try { os?.disconnect(); } catch { /* ya suelto */ }
        os?.connect(chain.input);
        if (media === s.el) media = s.orig;
      }
    }

    // Ganancia objetivo de cada stem según mute/solo/volumen.
    const stemTarget = (i) => {
      const solo = stems.solo.some(Boolean);
      return !stems.mute[i] && (!solo || stems.solo[i]) ? stems.vol[i] : 0;
    };

    // `cmd`: { url, mute?: [4], solo?: [4] }. Los stems entran ya con mute/solo aplicados, en una sola acción, y la pista
    // completa se apaga con una rampa lineal de STEM_FADE mientras ellos suben: la suma de ambas es constante.
    async function stemsOn(cmd) {
      if (!media || stems) return !!stems;
      const orig = media;
      const el = new Audio();
      el.preload = 'auto';
      el.src = cmd.url;
      await new Promise((res, rej) => {
        el.addEventListener('canplaythrough', res, { once: true });
        el.addEventListener('canplay', () => setTimeout(res, 1500), { once: true }); // por si canplaythrough no llega
        el.addEventListener('error', () => rej(new Error('No se pudo abrir el archivo de stems')), { once: true });
      });
      if (stems || media !== orig) return !!stems; // mientras cargaba cambió la pista o se activó por otro lado
      el.playbackRate = orig.playbackRate;
      el.preservesPitch = keylock;
      const lag = stemsLag; // arranque medido de la vez anterior: el elemento nuevo empieza ya adelantado
      el.currentTime = orig.currentTime + (orig.paused ? 0 : lag * orig.playbackRate);
      const src = ctx.createMediaElementSource(el);
      const split = ctx.createChannelSplitter(8);
      src.connect(split);
      const merge = [];
      const gain = [];
      for (let i = 0; i < 4; i++) {
        const m = ctx.createChannelMerger(2);
        split.connect(m, 2 * i, 0);
        split.connect(m, 2 * i + 1, 1);
        const g = ctx.createGain();
        g.gain.value = 0;
        m.connect(g);
        g.connect(chain.input);
        merge.push(m);
        gain.push(g);
      }
      const wasPlaying = !orig.paused;
      const norm = (v) => [0, 1, 2, 3].map((i) => !!v?.[i]);
      stems = { el, orig, src, split, merge, gain, vol: [1, 1, 1, 1], mute: norm(cmd.mute), solo: norm(cmd.solo), fade: null, timer: null };
      if (wasPlaying) {
        if (ctx.state !== 'running') await ctx.resume();
        const t0 = performance.now();
        await el.play();
        stemsLag = Math.min(0.25, Math.max(0, (performance.now() - t0) / 1000)); // lo que tarda en sonar: la próxima vez se adelanta
        const drift = el.currentTime - orig.currentTime;
        if (Math.abs(drift) > 0.015) el.currentTime = orig.currentTime;
      }
      const os = sources.get(orig);
      const fade = ctx.createGain();
      stems.fade = fade;
      const now = ctx.currentTime;
      try { os?.disconnect(); } catch { /* ya suelto */ }
      os?.connect(fade);
      fade.connect(chain.input);
      fade.gain.setValueAtTime(1, now);
      fade.gain.linearRampToValueAtTime(0, now + STEM_FADE);
      gain.forEach((g, i) => {
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(stemTarget(i), now + STEM_FADE);
      });
      media = el;
      applyRate();
      const st = stems;
      st.timer = setTimeout(() => { // la completa ya no suena: se libera
        if (stems !== st) return;
        orig.pause();
        try { os?.disconnect(); fade.disconnect(); } catch { /* ya suelto */ }
        st.fade = null;
      }, STEM_FADE * 1000 + 20);
      return true;
    }

    async function stemsOp(cmd) {
      switch (cmd.op) {
        case 'on':
          return stemsOn(cmd);
        case 'off': {
          if (!stems) return false;
          const s = stems;
          const { el, orig } = s;
          clearTimeout(s.timer);
          orig.currentTime = el.currentTime;
          const wasPlaying = !el.paused;
          const os = sources.get(orig);
          const fade = s.fade || ctx.createGain();
          if (!s.fade) {
            try { os?.disconnect(); } catch { /* ya suelto */ }
            os?.connect(fade);
            fade.connect(chain.input);
            s.fade = fade;
          }
          const now = ctx.currentTime;
          fade.gain.cancelScheduledValues(now);
          fade.gain.setValueAtTime(fade.gain.value, now);
          fade.gain.linearRampToValueAtTime(1, now + STEM_FADE);
          s.gain.forEach((g) => { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + STEM_FADE); });
          if (wasPlaying) await orig.play();
          media = orig;
          applyRate();
          s.timer = setTimeout(() => { if (stems === s) stemsTeardown(true); }, STEM_FADE * 1000 + 20);
          return true;
        }
        case 'gain': // v: volumen 0–1 del stem i
        case 'mute':
        case 'solo': {
          if (!stems || !(cmd.i >= 0 && cmd.i < 4)) return false;
          if (cmd.op === 'gain') stems.vol[cmd.i] = Math.max(0, Math.min(1, Number(cmd.v)));
          else stems[cmd.op][cmd.i] = !!cmd.v;
          applyStemGains();
          return true;
        }
      }
      return false;
    }

    async function handle(cmd) {
      switch (cmd.type) {
        case 'scratch':
          return scratchOp(cmd);
        case 'stems':
          return stemsOp(cmd);
        case 'load':
          stemsTeardown(true);
          held = null;
          ramp = 1;
          scratch?.drop();
          wantPlaying = !!cmd.play;
          loop = null;
          await adapter.load(cmd, engine);
          break;
        case 'play':
          await play();
          break;
        case 'pause':
          pause();
          break;
        case 'seek':
          seek(cmd.t);
          break;
        case 'rate':
          if (cmd.rate != null) rate = cmd.rate;
          if (cmd.keylock != null) keylock = !!cmd.keylock;
          applyRate();
          break;
        case 'bend':
          bend = cmd.amount || 0;
          bendUntil = performance.now() + (cmd.ms ?? 1e9);
          applyRate();
          break;
        case 'loop':
          loop = cmd.in != null && cmd.out > cmd.in ? { in: cmd.in, out: cmd.out } : null;
          break;
        case 'mix':
          chain.setMix(cmd);
          break;
        case 'routing':
          await chain.setRouting(cmd);
          break;
      }
    }

    function tick() {
      if (media) {
        applyRate();
        if (loop && media.currentTime >= loop.out) {
          media.currentTime = loop.in + (media.currentTime - loop.out);
        }
      }
      if (adapter.tick) adapter.tick(engine);
      const now = performance.now();
      if (now - lastEmit >= STATE_MS) {
        lastEmit = now;
        onState(state());
      }
    }

    function state() {
      const meta = adapter.meta ? adapter.meta() : {};
      return {
        ...meta,
        pos: held?.buffered ? scratch.pos : media ? media.currentTime : 0,
        dur: media && isFinite(media.duration) ? media.duration : 0,
        playing: held?.buffered ? held.wasPlaying : !!media && !media.paused && !media.ended,
        held: !!held,
        scratchReady: !!(scratch && scratch.ready && media && scratch.url === media.currentSrc),
        rate: effectiveRate(),
        level: chain.level(),
        loop,
        stems: stems ? { on: true, vol: [...stems.vol], mute: [...stems.mute], solo: [...stems.solo] } : { on: false },
      };
    }

    const engine = {
      ctx,
      attach,
      handle,
      state,
      get media() {
        return media;
      },
      scratchError: () => (scratch ? scratch.error : 'sin controlador'),
      get wantPlaying() {
        return wantPlaying;
      },
      set wantPlaying(v) {
        wantPlaying = v;
      },
    };
    setInterval(tick, 5);
    return engine;
  }

  return { createDeckEngine };
});
