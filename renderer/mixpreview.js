// Pre-escucha de una transición: los segundos previos a la salida de A y la entrada de B, con el mismo cruce que AutoMix.
// Va por la salida de auriculares (cue) si está configurada; si no, por la salida por defecto. `silent` es para las pruebas.
export function fileUrl(track, analysis) {
  const id = track.local ? track.videoId : analysis?.saved?.localId;
  return id ? `/localfile/${encodeURIComponent(id)}` : null;
}

export function previewPlan({ a, b, exitAt, len = 16 }) {
  const ratio = a.bpm && b.bpm ? a.bpm / b.bpm : 1;
  const rate = Math.abs(ratio - 1) <= 0.08 ? ratio : 1;
  return { lead: Math.min(12, exitAt), len, rate, enterAt: Math.max(0, b.mixEdit?.in ?? b.mix?.mixIn ?? b.offset ?? 0) };
}

export async function startPreview({ aUrl, bUrl, a, b, exitAt, len = 16, cueLabel = '', silent = false, onEnd = () => {} }) {
  const plan = previewPlan({ a, b, exitAt, len });
  const ctx = new AudioContext();
  const out = ctx.createGain();
  out.gain.value = silent ? 0 : 0.8;
  out.connect(ctx.destination);
  if (cueLabel && ctx.setSinkId) {
    try {
      const id = await window.YTDJChain?.findSinkId(cueLabel);
      if (id) await ctx.setSinkId(id);
    } catch {}
  }
  const mk = (url) => {
    const el = new Audio(url);
    el.preload = 'auto';
    const g = ctx.createGain();
    ctx.createMediaElementSource(el).connect(g).connect(out);
    return { el, g };
  };
  const A = mk(aUrl);
  const B = mk(bUrl);
  A.el.currentTime = exitAt - plan.lead;
  B.el.currentTime = plan.enterAt;
  B.el.playbackRate = plan.rate;
  B.g.gain.value = 0;
  const st = { plan, phase: 'lead', stopped: false, A: A.el, B: B.el };
  const stop = () => {
    if (st.stopped) return;
    st.stopped = true;
    clearInterval(timer);
    A.el.pause();
    B.el.pause();
    ctx.close().catch(() => {});
    st.phase = 'ended';
    onEnd();
  };
  let started = 0;
  const timer = setInterval(() => {
    if (st.stopped) return;
    if (st.phase === 'lead' && A.el.currentTime >= exitAt) {
      st.phase = 'mixing';
      started = ctx.currentTime;
      B.el.play().catch(() => {});
    }
    if (st.phase === 'mixing') {
      const p = Math.min(1, (ctx.currentTime - started) / plan.len);
      A.g.gain.value = Math.cos((p * Math.PI) / 2); // cruce de potencia constante
      B.g.gain.value = Math.sin((p * Math.PI) / 2);
      if (p >= 1) stop();
    }
  }, 50);
  await A.el.play();
  st.stop = stop;
  return st;
}
