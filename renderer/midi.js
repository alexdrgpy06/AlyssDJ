// MIDI: aprendizaje (clic en control + mover el control físico) y despacho a los controles registrados.
import { controls } from './controls.js';

const STORE = 'ytdj:midi';

export class Midi {
  constructor(app) {
    this.app = app;
    this.map = JSON.parse(localStorage.getItem(STORE) || '{}');
    this.armed = null;
    this.access = null;
    this.error = null;
  }

  async init() {
    try {
      this.access = await navigator.requestMIDIAccess();
      this.access.onstatechange = () => this.bind();
      this.bind();
    } catch (e) {
      this.error = e.message;
    }
  }

  bind() {
    for (const input of this.access.inputs.values()) input.onmidimessage = (m) => this.onMessage(m.data);
    this.app.onMidiDevices?.(this.devices());
  }

  devices() {
    return this.access ? [...this.access.inputs.values()].map((i) => i.name) : [];
  }

  save() {
    localStorage.setItem(STORE, JSON.stringify(this.map));
  }

  arm(id) {
    this.armed = id;
  }

  onMessage(data) {
    let [status, d1, d2 = 0] = data;
    let type = status & 0xf0;
    const ch = status & 0x0f;
    if (type === 0x80) {
      type = 0x90;
      d2 = 0;
    }
    if (type !== 0x90 && type !== 0xb0) return;
    const key = `${type}:${ch}:${d1}`;

    if (this.app.learning && this.armed) {
      if (type === 0x90 && d2 === 0) return;
      const ctl = controls.get(this.armed);
      if (!ctl) return;
      const mode = ctl.kind === 'relative' ? 'relative' : ctl.kind === 'range' && type === 0xb0 ? 'abs' : 'button';
      for (const [k, m] of Object.entries(this.map)) if (m.id === this.armed) delete this.map[k];
      this.map[key] = { id: this.armed, mode };
      this.save();
      this.app.toast(`${type === 0x90 ? 'Nota' : 'CC'} ${d1} (canal ${ch + 1}) → ${this.armed}`);
      this.app.disarm();
      return;
    }

    const m = this.map[key];
    const ctl = m && controls.get(m.id);
    if (!ctl) return;
    if (m.mode === 'abs') ctl.setNorm?.(d2 / 127);
    else if (m.mode === 'relative') ctl.nudge?.(d2 < 64 ? d2 : d2 - 128);
    else ctl.press?.(type === 0x90 ? d2 > 0 : d2 > 63);
  }

  export() {
    return JSON.stringify(this.map, null, 2);
  }

  import(json) {
    this.map = JSON.parse(json);
    this.save();
  }

  clear() {
    this.map = {};
    this.save();
  }
}
