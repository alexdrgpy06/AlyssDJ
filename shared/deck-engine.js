// Motor de un deck sobre un HTMLMediaElement. Las dos fuentes lo comparten:
//  - stream: el <video> de music.youtube.com (sesión Premium), dentro de la vista del deck
//  - local:  un <audio> con el archivo que bajó yt-dlp, dentro del renderer
// Lo que cambia entre ambas es el "adapter" (cómo se carga una pista y se lee su metadata).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dsp-chain.js'));
  else root.YTDJEngine = factory(root.YTDJChain);
})(typeof self !== 'undefined' ? self : this, function (Chain) {
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
      return rate * (1 + (performance.now() < bendUntil ? bend : 0));
    }

    function applyRate() {
      if (!media) return;
      const r = effectiveRate();
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

    async function handle(cmd) {
      switch (cmd.type) {
        case 'load':
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
        pos: media ? media.currentTime : 0,
        dur: media && isFinite(media.duration) ? media.duration : 0,
        playing: !!media && !media.paused && !media.ended,
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
