// Unidad de efectos de un deck (insert): Eco (sincronizado al BPM), Reverb, Flanger y Gate rítmico.
// out = dry·(1 − wet/2) + efecto·wet. Todos los tipos quedan montados; solo cambia cuál alimenta la salida.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YTDJFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TYPES = ['echo', 'reverb', 'flanger', 'gate'];
  const SMOOTH = 0.02;

  // Respuesta al impulso de una sala sintética: ruido con caída exponencial, más oscuro al final.
  function impulse(ctx, seconds = 2.2, decay = 3.2) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.9 - 0.75 * t);
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  function create(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wetBus = ctx.createGain();
    wetBus.gain.value = 0;
    input.connect(dry).connect(output);
    wetBus.connect(output);

    // Selector de tipo: una ganancia por efecto en el bus húmedo.
    const sel = {};
    for (const t of TYPES) {
      sel[t] = ctx.createGain();
      sel[t].gain.value = 0;
      sel[t].connect(wetBus);
    }

    // Eco: delay con realimentación filtrada.
    const delay = ctx.createDelay(4);
    const fb = ctx.createGain();
    fb.gain.value = 0.5;
    const fbLp = ctx.createBiquadFilter();
    fbLp.type = 'lowpass';
    fbLp.frequency.value = 4200;
    input.connect(delay);
    delay.connect(fbLp).connect(fb).connect(delay);
    delay.connect(sel.echo);

    // Reverb.
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx);
    const rvIn = ctx.createBiquadFilter();
    rvIn.type = 'highpass';
    rvIn.frequency.value = 180;
    input.connect(rvIn).connect(conv).connect(sel.reverb);

    // Flanger: delay corto modulado por un LFO, con realimentación.
    const fl = ctx.createDelay(0.05);
    fl.delayTime.value = 0.003;
    const flFb = ctx.createGain();
    flFb.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.0022;
    lfo.connect(lfoDepth).connect(fl.delayTime);
    lfo.start();
    input.connect(fl);
    fl.connect(flFb).connect(fl);
    fl.connect(sel.flanger);

    // Gate rítmico: corta el audio con una onda cuadrada sincronizada al BPM.
    const gateGain = ctx.createGain();
    gateGain.gain.value = 0.5;
    const gateOsc = ctx.createOscillator();
    gateOsc.type = 'square';
    gateOsc.frequency.value = 2;
    const gateDepth = ctx.createGain();
    gateDepth.gain.value = 0.5;
    gateOsc.connect(gateDepth).connect(gateGain.gain);
    gateOsc.start();
    input.connect(gateGain).connect(sel.gate);

    const state = { type: 'echo', wet: 0, bpm: 120, div: 0.75 };

    function apply() {
      const t = ctx.currentTime;
      const beat = 60 / Math.max(40, state.bpm || 120);
      delay.delayTime.setTargetAtTime(Math.min(3.9, beat * state.div), t, 0.05);
      gateOsc.frequency.setTargetAtTime(1 / (beat * 0.5), t, 0.02); // corcheas
      for (const k of TYPES) sel[k].gain.setTargetAtTime(k === state.type ? (k === 'reverb' ? 2.6 : 1) : 0, t, SMOOTH);
      wetBus.gain.setTargetAtTime(state.wet, t, SMOOTH);
      dry.gain.setTargetAtTime(1 - (state.type === 'gate' || state.type === 'flanger' ? state.wet * 0.5 : state.wet * 0.15), t, SMOOTH);
    }

    return {
      input,
      output,
      TYPES,
      set(p) {
        if (p.type && TYPES.includes(p.type)) state.type = p.type;
        if (p.wet != null) state.wet = Math.max(0, Math.min(1, p.wet));
        if (p.bpm) state.bpm = p.bpm;
        if (p.div) state.div = p.div;
        apply();
      },
    };
  }

  return { create, TYPES };
});
