# Spike GPU · 2026-11-03

Equipo: RTX 3090, Linux, `onnxruntime-node` 1.31.1. Ventana de 343 980 muestras (7,8 s) estéreo de «Neon Drive» (segundo 20).

## Modelo candidato

`StemSplitio/htdemucs-onnx` · `htdemucs.onnx` · licencia MIT · opset 17 · 316 446 953 B · SHA-256 `68d0bf16428ef66e692cdff8a9ccf28f1ef3f69440d57e58605a4cc55fcc5e74`.
Interfaz: entrada `mix` `[1,2,343980]`, salida `stems` `[1,4,2,343980]` (drums, bass, other, vocals). La STFT/iSTFT va dentro del grafo, no hace falta `shared/stems-dsp.js`.

## Medidas (ms por ventana, tras calentar)

| Proveedor | Sesión | Ventana | Tiempo real* | SNR frente a CPU |
|---|---|---|---|---|
| `cpu` | 7,3 s | 2,4–2,9 s | ≈ 3× | referencia |
| `webgpu` | 4,0 s | 0,49–0,53 s (1,0 s la primera) | ≈ 15× | batería 91,6 · bajo 83,2 · resto 83,0 · voz 67,4 dB |

\* segundos de audio / segundos de cálculo en una ventana; con solape del 50 % el rendimiento real es la mitad.

## Hallazgos

- El fallo de WebGPU del `.ort` (`node_Softmax_1313`) no aparece con este modelo: el ONNX sin optimizar para CPU sí corre entero en la GPU.
- La salida coincide con CPU (≥ 67 dB), por encima del umbral de 40 dB del sondeo del diseño.
- CUDA y DirectML/CoreML no se pueden probar en este equipo (sin cuDNN, sin Windows/macOS); se mantienen como proveedores con sondeo.
- El modelo ocupa 316 MB (el `.ort` actual 210 MB): se descarga solo con GPU utilizable.

## Decisión

1. Variante `gpu` = este ONNX, con interfaz `mix → stems`; variante `cpu` = el `.ort` actual (sin cambios).
2. Orden de proveedores: Windows `dml`, macOS arm64 `coreml`, Linux `cuda` (si hay bibliotecas) → `webgpu`; siempre `cpu` al final.
3. El sondeo compara con la salida de CPU de referencia (SNR ≥ 40 dB) y exige ser más rápido que CPU.
4. El hijo del worker alimenta la ventana directamente en la variante `gpu`.
