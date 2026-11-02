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
        if (!Scratch || !media) return false;
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

    async function handle(cmd) {
      switch (cmd.type) {
        case 'scratch':
          return scratchOp(cmd);
        case 'load':
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
