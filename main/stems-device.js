'use strict';
// Selector de dispositivo para los stems: qué proveedor de ONNX Runtime usar (GPU o CPU), con sondeo y caché.
// El sondeo lo hace el proceso hijo (`stems-worker.js`, mensaje `probe`): separa una ventana sintética en el proveedor y en CPU,
// y devuelve { ok, rt, cpuRt, snr }. Aquí solo se decide y se recuerda: `userData/stems/device.json`.
const fs = require('fs');
const path = require('path');

const MIN_SNR = 40; // dB frente a la salida de CPU
const LABELS = { cuda: 'CUDA', dml: 'DirectML', coreml: 'CoreML', webgpu: 'WebGPU', cpu: 'CPU' };

// Proveedores a intentar por plataforma, de más a menos deseable; `cpu` no se lista (es el último recurso).
function candidates(platform = process.platform, arch = process.arch, { cuda = false } = {}) {
  if (platform === 'win32') return ['dml'];
  if (platform === 'darwin') return arch === 'arm64' ? ['coreml'] : [];
  if (platform === 'linux') return cuda ? ['cuda', 'webgpu'] : ['webgpu'];
  return [];
}

// ¿Están las bibliotecas de CUDA junto a onnxruntime-node? (el paquete no las trae: se instalan aparte)
function hasCuda(root = path.join(__dirname, '..')) {
  const dir = path.join(root, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', 'linux', process.arch);
  return fs.existsSync(path.join(dir, 'libonnxruntime_providers_cuda.so')) && fs.existsSync(path.join(dir, 'libonnxruntime_providers_shared.so'));
}

class DeviceSelector {
  // opts: dir, appVersion, modelSha, probe(provider) → Promise<{ ok, rt, cpuRt, snr }>, candidates (lista), now()
  constructor(opts) {
    this.o = opts;
    this.file = path.join(opts.dir, 'device.json');
    this.state = null; // { device, ok, rt, probe, probedAt, appVersion, modelSha, bad: { [proveedor]: motivo } }
    this.pending = null;
    try { this.state = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.state = null; }
  }

  fresh() {
    const s = this.state;
    return !!s && s.appVersion === this.o.appVersion && s.modelSha === this.o.modelSha;
  }

  save() {
    fs.mkdirSync(this.o.dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state));
    fs.renameSync(tmp, this.file);
  }

  // Resultado vigente sin sondear (para pintar Ajustes): { device, label, rt, probe }.
  info() {
    if (!this.fresh()) return { device: 'cpu', label: LABELS.cpu, rt: null, probe: 'pendiente' };
    const { device, rt, ok } = this.state;
    return { device, label: LABELS[device] || device, rt: rt ?? null, probe: ok ? 'ok' : 'fallo' };
  }

  // Elige el dispositivo: usa la caché si es de esta versión de app y de modelo; si no, sondea de a uno en orden.
  select() {
    if (this.fresh()) return Promise.resolve(this.info());
    if (!this.pending) this.pending = this.run().finally(() => { this.pending = null; });
    return this.pending;
  }

  async run() {
    const list = this.o.candidates || [];
    const bad = {};
    let chosen = null;
    for (const provider of list) {
      let r;
      try { r = await this.o.probe(provider); } catch (e) { r = { ok: false, error: e.message }; }
      if (r?.ok && r.snr >= MIN_SNR && (r.cpuRt == null || r.rt > r.cpuRt)) { chosen = { provider, rt: r.rt }; break; }
      bad[provider] = !r?.ok ? (r?.error || 'el sondeo falló') : r.snr < MIN_SNR ? `salida distinta de CPU (${r.snr.toFixed(1)} dB)` : 'más lento que la CPU';
    }
    this.state = {
      device: chosen ? chosen.provider : 'cpu',
      ok: !!chosen || list.length === 0,
      rt: chosen ? chosen.rt : null,
      probedAt: (this.o.now || Date.now)(),
      appVersion: this.o.appVersion,
      modelSha: this.o.modelSha,
      bad,
    };
    this.save();
    return this.info();
  }

  // El proveedor murió o dio error en una pista real: se descarta hasta que cambie la versión de la app o del modelo.
  markBad(provider, reason) {
    if (!provider || provider === 'cpu') return;
    this.state = { ...(this.fresh() ? this.state : {}), device: 'cpu', ok: false, rt: null, probedAt: (this.o.now || Date.now)(), appVersion: this.o.appVersion, modelSha: this.o.modelSha, bad: { ...(this.state?.bad || {}), [provider]: reason || 'falló' } };
    this.save();
  }

  // Velocidad medida en una pista real: sustituye a la del sondeo (más fiel, con música de verdad).
  noteRt(provider, rt) {
    if (!this.fresh() || this.state.device !== provider || !(rt > 0)) return;
    this.state.rt = rt;
    this.save();
  }

  // Proveedor a usar ahora (sin sondear): el de la caché o `cpu`.
  provider() { return this.fresh() ? this.state.device : 'cpu'; }
}

module.exports = { DeviceSelector, candidates, hasCuda, MIN_SNR, LABELS };
