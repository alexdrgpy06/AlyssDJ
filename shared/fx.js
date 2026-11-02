// Efectos de un deck (insert): tres ranuras en serie, cada una con un tipo a elegir entre Eco, Reverb, Flanger, Gate,
// Phaser, Crush y Filtro, una cantidad (wet, 0–1) y un segundo parámetro propio (P, 0–1).
// Cada ranura: out = dry + efecto·wet. Solo se monta el efecto de una ranura mientras está activa (on y wet > 0);
// apagada, el audio pasa tal cual y no gasta CPU. Eco, Gate, Flanger y Phaser siguen el BPM del deck.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YTDJFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TYPES = ['echo', 'reverb', 'flanger', 'gate', 'phaser', 'crush', 'filter'];
  const SLOTS = 3;
  const SMOOTH = 0.02;
  const FADE_MS = 90; // tiempo antes de desmontar un efecto ya silenciado
  const DIVS = [0.25, 0.5, 0.75, 1]; // eco: beats
  const PERIODS = [16, 8, 4, 2, 1]; // flanger y phaser: beats por ciclo del LFO
  const GATES = [1, 0.5, 0.25]; // gate: beats por ciclo
  const WET_SCALE = { reverb: 2.6 };
  const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));
  const stop = (p, n) => Math.min(n - 1, Math.floor(clamp01(p) * n));

  // Salas sintéticas: ruido con caída exponencial, más oscuro al final. Se generan una vez por contexto.
  function impulse(ctx, seconds, decay) {
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
  const rooms = new WeakMap();
  const room = (ctx, kind) => {
    let r = rooms.get(ctx);
    if (!r) rooms.set(ctx, (r = {}));
    return r[kind] || (r[kind] = kind === 'small' ? impulse(ctx, 0.8, 2.6) : impulse(ctx, 3, 3.2));
  };

  const crushCurve = (bits) => {
    const n = 2049;
    const levels = Math.pow(2, bits) / 2;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.round(((i / (n - 1)) * 2 - 1) * levels) / levels;
    return c;
  };

  // Cada constructor devuelve { in, out, setP(p, beat, t), nodes (para desconectar), osc (para detener) }.
  const BUILD = {
    echo(ctx) {
      const inp = ctx.createGain();
      const delay = ctx.createDelay(4);
      const fb = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;
      inp.connect(delay);
      delay.connect(lp).connect(fb).connect(delay);
      return {
        in: inp, out: delay, nodes: [inp, delay, lp, fb], osc: [],
        setP(p, beat, t) {
          delay.delayTime.setTargetAtTime(Math.min(3.9, beat * DIVS[stop(p, 4)]), t, 0.05);
          fb.gain.setTargetAtTime(0.35 + 0.3 * clamp01(p), t, 0.05);
        },
      };
    },
    reverb(ctx) {
      const inp = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 180;
      const small = ctx.createConvolver();
      small.buffer = room(ctx, 'small');
      const large = ctx.createConvolver();
      large.buffer = room(ctx, 'large');
      const gs = ctx.createGain();
      const gl = ctx.createGain();
      const out = ctx.createGain();
      inp.connect(hp);
      hp.connect(small).connect(gs).connect(out);
      hp.connect(large).connect(gl).connect(out);
      return {
        in: inp, out, nodes: [inp, hp, small, large, gs, gl, out], osc: [],
        setP(p, beat, t) {
          const a = (clamp01(p) * Math.PI) / 2;
          gs.gain.setTargetAtTime(Math.cos(a), t, 0.05);
          gl.gain.setTargetAtTime(Math.sin(a), t, 0.05);
        },
      };
    },
    flanger(ctx) {
      const fl = ctx.createDelay(0.05);
      fl.delayTime.value = 0.003;
      const fb = ctx.createGain();
      fb.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      depth.gain.value = 0.0022;
      lfo.connect(depth).connect(fl.delayTime);
      lfo.start();
      fl.connect(fb).connect(fl);
      return {
        in: fl, out: fl, nodes: [fl, fb, depth], osc: [lfo],
        setP(p, beat, t) {
          lfo.frequency.setTargetAtTime(1 / (beat * PERIODS[stop(p, 5)]), t, 0.05);
        },
      };
    },
    gate(ctx) {
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const depth = ctx.createGain();
      depth.gain.value = 0.5;
      osc.connect(depth).connect(g.gain);
      osc.start();
      return {
        in: g, out: g, nodes: [g, depth], osc: [osc],
        setP(p, beat, t) {
          osc.frequency.setTargetAtTime(1 / (beat * GATES[stop(p, 3)]), t, 0.02);
        },
      };
    },
    phaser(ctx) {
      const inp = ctx.createGain();
      const out = ctx.createGain();
      out.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      depth.gain.value = 500;
      lfo.connect(depth);
      let prev = inp;
      const aps = [];
      for (let i = 0; i < 4; i++) {
        const ap = ctx.createBiquadFilter();
        ap.type = 'allpass';
        ap.frequency.value = 700 + i * 350;
        ap.Q.value = 0.8;
        depth.connect(ap.detune); // el LFO mueve el corte (en cents ×1 = ±500)
        prev.connect(ap);
        prev = ap;
        aps.push(ap);
      }
      lfo.start();
      inp.connect(out); // la mezcla con el original es lo que crea las muescas
      prev.connect(out);
      return {
        in: inp, out, nodes: [inp, out, depth, ...aps], osc: [lfo],
        setP(p, beat, t) {
          lfo.frequency.setTargetAtTime(1 / (beat * PERIODS[stop(p, 5)]), t, 0.05);
        },
      };
    },
    crush(ctx) {
      const ws = ctx.createWaveShaper();
      let bits = 0;
      return {
        in: ws, out: ws, nodes: [ws], osc: [],
        setP(p) {
          const b = Math.round(12 - 9 * clamp01(p));
          if (b !== bits) {
            bits = b;
            ws.curve = crushCurve(b);
          }
        },
      };
    },
    filter(ctx) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 6;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      f.connect(g);
      return {
        in: f, out: g, nodes: [f, g], osc: [],
        setP(p, beat, t) {
          f.frequency.setTargetAtTime(120 * Math.pow(150, clamp01(p)), t, 0.03);
        },
      };
    },
  };

  const dryFor = (type, wet) => (type === 'echo' || type === 'reverb' ? 1 - wet * 0.15 : type === 'gate' || type === 'flanger' ? 1 - wet * 0.5 : 1 - wet);

  function makeSlot(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wetG = ctx.createGain();
    wetG.gain.value = 0;
    input.connect(dry).connect(output);
    wetG.connect(output);
    let cur = null; // { type, fx, gate, timer }

    function dispose(c) {
      clearTimeout(c.timer);
      try { input.disconnect(c.fx.in); } catch {}
      for (const o of c.fx.osc) { try { o.stop(); } catch {} }
      for (const n of [c.fx.out, c.gate, ...c.fx.nodes]) { try { n.disconnect(); } catch {} }
    }
    function retire(c) {
      const t = ctx.currentTime;
      c.gate.gain.setTargetAtTime(0, t, 0.015);
      c.timer = setTimeout(() => dispose(c), FADE_MS);
    }
    function mount(type) {
      const fx = BUILD[type](ctx);
      const gate = ctx.createGain();
      gate.gain.value = 0;
      input.connect(fx.in);
      fx.out.connect(gate).connect(wetG);
      gate.gain.setTargetAtTime(1, ctx.currentTime, 0.015);
      return { type, fx, gate, timer: 0 };
    }

    return {
      input,
      output,
      mounted: () => cur?.type || null,
      apply(slot, bpm) {
        const t = ctx.currentTime;
        const wet = clamp01(slot.wet);
        const active = slot.on === true && wet > 0.001;
        if (!active) {
          wetG.gain.setTargetAtTime(0, t, SMOOTH);
          dry.gain.setTargetAtTime(1, t, SMOOTH);
          if (cur) {
            retire(cur);
            cur = null;
          }
          return;
        }
        if (cur && cur.type !== slot.type) {
          retire(cur);
          cur = null;
        }
        if (!cur) cur = mount(slot.type);
        const beat = 60 / Math.max(40, bpm || 120);
        cur.fx.setP(slot.p, beat, t);
        wetG.gain.setTargetAtTime(wet * (WET_SCALE[slot.type] || 1), t, SMOOTH);
        dry.gain.setTargetAtTime(dryFor(slot.type, wet), t, SMOOTH);
      },
    };
  }

  function create(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const slots = Array.from({ length: SLOTS }, () => makeSlot(ctx));
    let prev = input;
    for (const s of slots) {
      prev.connect(s.input);
      prev = s.output;
    }
    prev.connect(output);
    const state = { bpm: 120, slots: Array.from({ length: SLOTS }, () => ({ type: 'echo', on: false, wet: 0.5, p: 0.5 })) };

    return {
      input,
      output,
      TYPES,
      SLOTS,
      // p: { slots: [{type,on,wet,p}×3], bpm }
      set(p = {}) {
        if (p.bpm) state.bpm = p.bpm;
        if (Array.isArray(p.slots)) {
          p.slots.slice(0, SLOTS).forEach((s, i) => {
            if (s) state.slots[i] = { type: TYPES.includes(s.type) ? s.type : state.slots[i].type, on: s.on === true, wet: clamp01(s.wet), p: clamp01(s.p) };
          });
        }
        state.slots.forEach((s, i) => slots[i].apply(s, state.bpm));
      },
      get: () => ({ bpm: state.bpm, slots: state.slots.map((s) => ({ ...s })) }),
      mounted: () => slots.map((s) => s.mounted()),
    };
  }

  return { create, TYPES, SLOTS };
});
