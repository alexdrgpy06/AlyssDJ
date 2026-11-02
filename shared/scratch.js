// Controlador del scratch en el hilo principal: decodifica el audio local, lo entrega al worklet y lo manda sujetar,
// mover a la velocidad del plato y soltar. Si algo falla (stream, sin worklet, pista enorme) `prepare` devuelve false
// y el deck usa el respaldo de freno y arranque suaves.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YTDJScratch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_SECONDS = 15 * 60; // ≈ 300 MiB de buffer: más que esto no se decodifica

  function create(ctx, dest, { worklet = '/shared/scratch-worklet.js' } = {}) {
    let node = null;
    let url = null;
    let ready = false;
    let loading = null;
    let pos = 0;
    let waiter = null;
    let lastError = '';

    async function ensureNode() {
      if (node) return node;
      await ctx.audioWorklet.addModule(worklet);
      node = new AudioWorkletNode(ctx, 'ytdj-scratch', { numberOfInputs: 0, outputChannelCount: [2] });
      node.connect(dest);
      node.port.onmessage = ({ data }) => {
        pos = data.pos;
        if (data.final && waiter) waiter(pos);
      };
      return node;
    }

    async function load(u) {
      try {
        const n = await ensureNode();
        const res = await fetch(u);
        if (!res.ok) return false;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        if (buf.duration > MAX_SECONDS) return false;
        const L = buf.getChannelData(0).slice();
        const R = buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : L.slice();
        n.port.postMessage({ type: 'buffer', L, R }, [L.buffer, R.buffer]);
        url = u;
        ready = true;
        return true;
      } catch (e) {
        ready = false;
        lastError = String((e && e.message) || e);
        return false;
      }
    }

    return {
      get ready() {
        return ready;
      },
      get url() {
        return url;
      },
      get error() {
        return lastError;
      },
      get pos() {
        return pos;
      },
      // Decodifica `u` (o reutiliza el buffer si ya es esa pista).
      prepare(u) {
        if (!u || /^blob:|^mediasource:/.test(u)) return Promise.resolve(false);
        if (ready && url === u) return Promise.resolve(true);
        if (loading?.url === u) return loading.p;
        ready = false;
        const p = load(u).finally(() => { if (loading?.p === p) loading = null; });
        loading = { url: u, p };
        return p;
      },
      hold(p, vel, target) {
        pos = p;
        node.port.postMessage({ type: 'hold', pos: p, vel, target });
      },
      move(v) {
        node?.port.postMessage({ type: 'vel', v });
      },
      // Para el worklet y devuelve la posición exacta (segundos), con un respaldo por si el mensaje tarda.
      release() {
        return new Promise((resolve) => {
          const t = setTimeout(() => resolve(pos), 120);
          waiter = (p) => { clearTimeout(t); waiter = null; resolve(p); };
          node.port.postMessage({ type: 'stop' });
        });
      },
      drop() {
        ready = false;
        url = null;
        node?.port.postMessage({ type: 'drop' });
      },
    };
  }

  return { create };
});
