// AudioWorklet del scratch: reproduce el buffer con la velocidad que le manda el hilo principal.
import { makeState, render } from './scratch-math.js';

class ScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = null;
    this.st = makeState(sampleRate);
    this.run = false;
    this.last = 0;
    this.port.onmessage = ({ data: m }) => {
      if (m.type === 'buffer') this.buf = { L: m.L, R: m.R };
      else if (m.type === 'drop') this.buf = null;
      else if (m.type === 'hold') (this.st.pos = Math.max(0, m.pos * sampleRate), (this.st.vel = m.vel || 0), (this.st.target = m.target ?? m.vel ?? 0), (this.run = true));
      else if (m.type === 'vel') this.st.target = m.v;
      else if (m.type === 'stop') (this.run = false, this.port.postMessage({ pos: this.st.pos / sampleRate, vel: this.st.vel, final: true }));
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!this.run || !this.buf) return true;
    render(this.buf, this.st, out[0], out[1] || out[0], out[0].length);
    this.last += out[0].length;
    if (this.last >= sampleRate / 30) {
      this.last = 0;
      this.port.postMessage({ pos: this.st.pos / sampleRate, vel: this.st.vel });
    }
    return true;
  }
}
registerProcessor('ytdj-scratch', ScratchProcessor);
