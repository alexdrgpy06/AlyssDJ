// Efectos de un deck (insert): tres ranuras en serie, cada una con un tipo a elegir entre Eco, Reverb, Flanger, Gate,
// Phaser, Crush, Filtro, Cinta, Reducer, Stutter, Brake, Transformer, Drive y Pitch, una cantidad (wet, 0–1) y un segundo parámetro propio (P, 0–1).
// Cada ranura: out = dry + efecto·wet. Solo se monta el efecto de una ranura mientras está activa (on y wet > 0);
// apagada, el audio pasa tal cual y no gasta CPU. Eco, Gate, Flanger y Phaser siguen el BPM del deck.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YTDJFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TYPES = ['echo', 'reverb', 'flanger', 'gate', 'phaser', 'crush', 'filter', 'tape', 'reducer', 'stutter', 'brake', 'transformer', 'drive', 'pitch'];
  const SLOTS = 3;
  const SMOOTH = 0.02;
  const FADE_MS = 90; // tiempo antes de desmontar un efecto ya silenciado
  const DIVS = [0.25, 0.5, 0.75, 1]; // eco: beats
  const PERIODS = [16, 8, 4, 2, 1]; // flanger y phaser: beats por ciclo del LFO
  const GATES = [1, 0.5, 0.25]; // gate: beats por ciclo
  const DIVD = [1, 0.5, 0.25, 0.125, 1 / 3]; // división de beat elegible (`d`): 1, ½, ¼, ⅛ y tresillo
  const WET_SCALE = { reverb: 2.6 };
  const GATE_LIKE = ['gate', 'flanger', 'stutter', 'brake', 'transformer'];
  const PATTERNS = [[1, 1, 0, 1, 1, 0, 1, 0], [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 0, 0, 0, 0], [1, 0, 0, 1, 0, 1, 0, 0]]; // transformer: 8 pasos por compás
  const offlineCtx = (ctx) => typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));
  const div = (d, p, n, table) => (d == null ? table[stop(p, n)] : DIVD[Math.max(0, Math.min(4, d | 0))]);
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

  const tanhCurve = (k) => {
    const n = 2049;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * k);
    return c;
  };
  // Saturación de pendiente 1 en el centro (la realimentación de la cinta no puede crecer): tanh(kx)/k.
  const softCurve = (k) => Float32Array.from({ length: 2049 }, (_, i) => Math.tanh(((i / 2048) * 2 - 1) * k) / k);
  const triCurve = () => Float32Array.from({ length: 2049 }, (_, i) => 1 - Math.abs((i / 2048) * 2 - 1));

  // Agenda eventos por ciclo con anticipación (en tiempo real, un temporizador; con OfflineAudioContext, todo de una vez).
  function loop(ctx, fn) {
    const off = offlineCtx(ctx);
    const horizon = off ? ctx.length / ctx.sampleRate : 0.3;
    let next = ctx.currentTime + 0.01;
    let cyc = 1;
    let timer = 0;
    const pump = () => {
      const lim = ctx.currentTime + horizon;
      for (let n = 0; next < lim && n < 4000; n++) {
        cyc = Math.max(0.05, fn(next) || cyc);
        next += cyc;
      }
    };
    if (!off) timer = setInterval(pump, 50);
    return { stop: () => clearInterval(timer), pump };
  }

  // Cada constructor devuelve { in, out, setP(p, beat, t, d), nodes (para desconectar), osc (para detener), stop? }.
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
        setP(p, beat, t, d) {
          delay.delayTime.setTargetAtTime(Math.min(3.9, beat * div(d, p, 4, DIVS)), t, 0.05);
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
        setP(p, beat, t, d) {
          osc.frequency.setTargetAtTime(1 / (beat * div(d, p, 3, GATES)), t, 0.02);
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

    tape(ctx) {
      const inp = ctx.createGain();
      const delay = ctx.createDelay(4);
      const sat = ctx.createWaveShaper();
      sat.curve = softCurve(1.5);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      const fb = ctx.createGain();
      const wow = ctx.createOscillator();
      wow.frequency.value = 0.7;
      const wd = ctx.createGain();
      wd.gain.value = 0.0007;
      wow.connect(wd).connect(delay.delayTime);
      wow.start();
      inp.connect(delay);
      delay.connect(sat).connect(lp).connect(fb).connect(delay);
      return {
        in: inp, out: lp, nodes: [inp, delay, sat, lp, fb, wd], osc: [wow],
        setP(p, beat, t, d) {
          delay.delayTime.setTargetAtTime(Math.min(3.9, beat * div(d, p, 4, [0.5, 0.75, 1, 0.25])), t, 0.05);
          fb.gain.setTargetAtTime(0.3 + 0.45 * clamp01(p), t, 0.05);
        },
      };
    },
    reducer(ctx) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.7;
      const ws = ctx.createWaveShaper();
      lp.connect(ws);
      let bits = 0;
      return {
        in: lp, out: ws, nodes: [lp, ws], osc: [],
        setP(p, beat, t) {
          lp.frequency.setTargetAtTime(14000 * Math.pow(0.03, clamp01(p)), t, 0.03);
          const b = Math.round(12 - 8 * clamp01(p));
          if (b !== bits) {
            bits = b;
            ws.curve = crushCurve(b);
          }
        },
      };
    },
    stutter(ctx) {
      const gIn = ctx.createGain();
      gIn.gain.value = 0;
      const delay = ctx.createDelay(2);
      const fb = ctx.createGain();
      const out = ctx.createGain();
      out.gain.value = 0;
      gIn.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(out);
      let beat = 0.5;
      let len = 0.25;
      const lp = loop(ctx, (t) => {
        const bar = beat * 4;
        delay.delayTime.setValueAtTime(len, t);
        gIn.gain.setValueAtTime(1, t);
        fb.gain.setValueAtTime(0, t);
        out.gain.setValueAtTime(0, t);
        gIn.gain.setValueAtTime(0, t + len);
        fb.gain.setValueAtTime(0.995, t + len);
        out.gain.setValueAtTime(1, t + len + 0.002);
        out.gain.setValueAtTime(0, t + bar - 0.004);
        return bar;
      });
      return {
        in: gIn, out, nodes: [gIn, delay, fb], osc: [], stop: lp.stop,
        setP(p, b, t, d) {
          beat = b;
          len = Math.min(1.9, b * div(d, p, 4, DIVD.slice(0, 4)));
          lp.pump();
        },
      };
    },
    brake(ctx) {
      const delay = ctx.createDelay(3);
      delay.delayTime.value = 0.001;
      const out = ctx.createGain();
      out.gain.value = 0;
      delay.connect(out);
      let beat = 0.5;
      let dur = 1;
      const lp = loop(ctx, (t) => {
        delay.delayTime.cancelScheduledValues(t);
        delay.delayTime.setValueAtTime(0.001, t);
        delay.delayTime.linearRampToValueAtTime(Math.min(2.8, dur * 0.9), t + dur);
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(1, t);
        out.gain.setValueAtTime(1, t + dur * 0.9);
        out.gain.linearRampToValueAtTime(0, t + dur);
        return dur + beat * 0.5;
      });
      return {
        in: delay, out, nodes: [delay], osc: [], stop: lp.stop,
        setP(p, b) {
          beat = b;
          dur = Math.max(0.3, Math.min(3, b * (1 + 3 * (1 - clamp01(p)))));
          lp.pump();
        },
      };
    },
    transformer(ctx) {
      const g = ctx.createGain();
      g.gain.value = 0;
      let pat = PATTERNS[0];
      let step = 0.25;
      const lp = loop(ctx, (t) => {
        pat.forEach((v, k) => g.gain.setTargetAtTime(v, t + k * step, 0.002));
        return pat.length * step;
      });
      return {
        in: g, out: g, nodes: [g], osc: [], stop: lp.stop,
        setP(p, b, t, d) {
          pat = PATTERNS[stop(p, PATTERNS.length)];
          step = b * (d == null ? 0.5 : DIVD[Math.max(0, Math.min(4, d | 0))]);
          lp.pump();
        },
      };
    },
    drive(ctx) {
      const pre = ctx.createGain();
      const ws = ctx.createWaveShaper();
      ws.curve = tanhCurve(1);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 9000;
      const post = ctx.createGain();
      pre.connect(ws).connect(tone).connect(post);
      return {
        in: pre, out: post, nodes: [pre, ws, tone, post], osc: [],
        setP(p, beat, t) {
          const k = 1 + 19 * clamp01(p);
          pre.gain.setTargetAtTime(k, t, 0.03);
          post.gain.setTargetAtTime(1 / Math.sqrt(k), t, 0.03);
          tone.frequency.setTargetAtTime(14000 - 9000 * clamp01(p), t, 0.03);
        },
      };
    },
    pitch(ctx) {
      const T = 0.06; // periodo de la rampa
      const L = 2048;
      const ramp = ctx.createBuffer(1, L, ctx.sampleRate); // rampa exacta de -1 a 1 (un diente de sierra de OscillatorNode llega limitado en banda y desvía el tono)
      const rd = ramp.getChannelData(0);
      for (let k = 0; k < L; k++) rd[k] = -1 + (2 * k) / L;
      const out = ctx.createGain();
      const inp = ctx.createGain();
      const win = triCurve();
      const voices = [0, 1].map((i) => {
        const delay = ctx.createDelay(0.5);
        delay.delayTime.value = 0.02; // arranca en el centro de la rampa: sin barrido de tono al montar
        const osc = ctx.createBufferSource();
        osc.buffer = ramp;
        osc.loop = true;
        osc.playbackRate.value = L / ctx.sampleRate / T;
        const depth = ctx.createGain();
        const shaper = ctx.createWaveShaper();
        shaper.curve = win;
        const vg = ctx.createGain();
        vg.gain.value = 0;
        osc.connect(depth).connect(delay.delayTime);
        osc.connect(shaper).connect(vg.gain);
        inp.connect(delay);
        delay.connect(vg).connect(out);
        osc.start(0, (i * L) / 2 / ctx.sampleRate);
        return { delay, depth, osc, shaper, vg };
      });
      return {
        in: inp, out, nodes: [inp, out, ...voices.flatMap((v) => [v.delay, v.depth, v.shaper, v.vg])], osc: voices.map((v) => v.osc),
        setP(p, beat, t) {
          const ratio = Math.pow(2, ((clamp01(p) - 0.5) * 24) / 12);
          const g = ((1 - ratio) * T) / 2;
          for (const v of voices) {
            v.depth.gain.setTargetAtTime(g, t, 0.03);
            v.delay.delayTime.setTargetAtTime(Math.abs(g) + 0.005, t, 0.03);
          }
        },
      };
    },
  };

  const dryFor = (type, wet) => (type === 'echo' || type === 'reverb' || type === 'tape' ? 1 - wet * 0.15 : GATE_LIKE.includes(type) ? 1 - wet * 0.5 : 1 - wet);

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
      try { c.fx.stop?.(); } catch {}
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
        cur.fx.setP(slot.p, beat, t, slot.d);
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
    const state = { bpm: 120, slots: Array.from({ length: SLOTS }, () => ({ type: 'echo', on: false, wet: 0.5, p: 0.5, d: null })) };

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
            if (s) state.slots[i] = { type: TYPES.includes(s.type) ? s.type : state.slots[i].type, on: s.on === true, wet: clamp01(s.wet), p: clamp01(s.p), d: s.d == null ? null : Math.max(0, Math.min(4, s.d | 0)) };
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
