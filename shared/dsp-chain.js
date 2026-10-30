// Cadena de canal de un deck: trim → EQ 3 bandas → filtro bipolar → (fader → master) + (PFL → cue) + medidor.
// Se usa igual en la vista de YouTube Music (stream) y en el renderer (archivo local de yt-dlp).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fx.js'));
  else root.YTDJChain = factory(root.YTDJFx);
})(typeof self !== 'undefined' ? self : this, function (Fx) {
  const SMOOTH = 0.015;

  // Knob de EQ en [-1, 1]: -1 = kill, 0 = plano, +1 = +6 dB.
  function eqDb(v) {
    if (v >= 0) return v * 6;
    if (v <= -0.97) return -60;
    return v * 26;
  }

  async function findSinkId(label) {
    if (!label || !navigator.mediaDevices?.enumerateDevices) return '';
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hit = devices.find((d) => d.kind === 'audiooutput' && d.label === label);
      return hit ? hit.deviceId : '';
    } catch {
      return '';
    }
  }

  function create(ctx) {
    const nyq = ctx.sampleRate / 2;
    const input = ctx.createGain();
    const trim = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 250;
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 0.7;
    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 4000;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 10;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = nyq;
    const fx = Fx.create(ctx);
    const post = ctx.createGain();
    const fader = ctx.createGain();
    fader.gain.value = 0;
    const pfl = ctx.createGain();
    pfl.gain.value = 0;
    const meter = ctx.createAnalyser();
    meter.fftSize = 1024;

    input.connect(trim).connect(low).connect(mid).connect(high).connect(hp).connect(lp).connect(fx.input);
    fx.output.connect(post);
    post.connect(fader);
    post.connect(pfl);
    post.connect(meter);

    const buf = new Float32Array(meter.fftSize);
    let cueEl = null;
    let cueDest = null;
    let merger = null;
    let routing = { mode: 'split', masterLabel: '', cueLabel: '' };

    function ramp(param, value) {
      param.setTargetAtTime(value, ctx.currentTime, SMOOTH);
    }

    function setMix(m) {
      if (m.trim != null) ramp(trim.gain, Math.pow(10, m.trim / 20));
      if (m.low != null) ramp(low.gain, eqDb(m.low));
      if (m.mid != null) ramp(mid.gain, eqDb(m.mid));
      if (m.high != null) ramp(high.gain, eqDb(m.high));
      if (m.filter != null) {
        const f = m.filter;
        if (f < -0.02) {
          ramp(lp.frequency, Math.min(nyq, 20000 * Math.pow(10, 3 * f)));
          ramp(hp.frequency, 10);
          lp.Q.value = 1.2;
        } else if (f > 0.02) {
          ramp(hp.frequency, Math.min(nyq * 0.9, 10 * Math.pow(10, 3.3 * f)));
          ramp(lp.frequency, nyq);
          hp.Q.value = 1.2;
        } else {
          ramp(lp.frequency, nyq);
          ramp(hp.frequency, 10);
          lp.Q.value = hp.Q.value = 0.707;
        }
      }
      if (m.fader != null) ramp(fader.gain, m.fader);
      if (m.pfl != null) ramp(pfl.gain, m.pfl === true ? 1 : +m.pfl || 0);
      if (m.fxType != null || m.fxWet != null || m.bpm != null || m.fxDiv != null) fx.set({ type: m.fxType, wet: m.fxWet, bpm: m.bpm, div: m.fxDiv });
    }

    function teardown() {
      fader.disconnect();
      pfl.disconnect();
      if (merger) merger.disconnect();
      merger = null;
      if (cueEl) {
        cueEl.pause();
        cueEl.srcObject = null;
      }
    }

    // split: master por el dispositivo del contexto, cue por un segundo dispositivo.
    // quad:  un solo dispositivo de 4 canales (1-2 master, 3-4 cue), típico de controladoras DJ.
    async function setRouting(r) {
      routing = { ...routing, ...r };
      teardown();
      const masterId = await findSinkId(routing.masterLabel);
      if (ctx.setSinkId) {
        try {
          await ctx.setSinkId(masterId);
        } catch (e) {
          console.warn('[ytdj] setSinkId master', e);
        }
      }
      const dest = ctx.destination;
      if (routing.mode === 'quad' && dest.maxChannelCount >= 4) {
        dest.channelCount = 4;
        dest.channelCountMode = 'explicit';
        dest.channelInterpretation = 'discrete';
        merger = ctx.createChannelMerger(4);
        const sm = ctx.createChannelSplitter(2);
        const sc = ctx.createChannelSplitter(2);
        fader.connect(sm);
        pfl.connect(sc);
        sm.connect(merger, 0, 0);
        sm.connect(merger, 1, 1);
        sc.connect(merger, 0, 2);
        sc.connect(merger, 1, 3);
        merger.connect(dest);
        return { mode: 'quad' };
      }
      dest.channelCount = 2;
      fader.connect(dest);
      if (routing.cueLabel) {
        cueDest = cueDest || ctx.createMediaStreamDestination();
        pfl.connect(cueDest);
        cueEl = cueEl || new Audio();
        cueEl.srcObject = cueDest.stream;
        try {
          await cueEl.setSinkId(await findSinkId(routing.cueLabel));
          await cueEl.play();
        } catch (e) {
          console.warn('[ytdj] cue output', e);
        }
      }
      return { mode: 'split' };
    }

    function level() {
      meter.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > peak) peak = a;
      }
      return peak;
    }

    setRouting({});
    return { input, setMix, setRouting, level };
  }

  return { create, findSinkId };
});
