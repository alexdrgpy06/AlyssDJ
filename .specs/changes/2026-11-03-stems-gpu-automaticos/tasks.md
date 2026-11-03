---
change: 2026-11-03-stems-gpu-automaticos
---
# Tasks · 2026-11-03-stems-gpu-automaticos

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Spike del modelo para GPU: localizar o generar un ONNX de HTDemucs apto para CUDA/DirectML/WebGPU (licencia compatible), medir tiempo y SNR frente a CPU y registrar la decisión en `spike-gpu.md` (REQ-1, REQ-2, REQ-8) @architect [verify: test -s .specs/changes/2026-11-03-stems-gpu-automaticos/spike-gpu.md]
- [x] 1.2 Selector de dispositivo con sondeo, caché `device.json` y caída a CPU ante fallo o muerte del hijo (REQ-1, REQ-3) @coder [verify: node --experimental-default-type=module scripts/test-stems.js device]
- [x] 1.3 Variantes de modelo (`cpu`/`gpu`) con permiso, SHA-256 y descarga bajo demanda (REQ-8) @coder [verify: node --experimental-default-type=module scripts/test-stems.js model]
- [x] 1.4 Medida de tiempo real, evento `done` con `rt` y sección «Stems» de Ajustes con dispositivo y velocidad (REQ-1, REQ-2) @coder [verify: node --experimental-default-type=module scripts/test-stems.js ipc]
- [x] 1.5 Cola con prioridades y ajuste `stemsAuto`: pedir stems al cargar en un deck y al fijar la siguiente de AutoMix (REQ-4) @coder [verify: node --experimental-default-type=module scripts/test-stems.js store]
- [x] 1.6 Cuota con descarte de los menos usados y espacio usado en Ajustes (REQ-7) @coder [verify: node --experimental-default-type=module scripts/test-stems.js quota]
- [x] 1.7 Deck sin «Activar»: acción pendiente mientras se prepara y cambio con fundido de 40 ms sin salto (REQ-5, REQ-6) @coder [verify: xvfb-run -a node --experimental-default-type=module scripts/test-stems.js engine]
- [x] 1.8 Pruebas de interfaz, `docs/05-stems.md` y capturas al día (REQ-3, REQ-5, REQ-6) @ui [verify: xvfb-run -a node --experimental-default-type=module scripts/test-stems.js ui && node --experimental-default-type=module scripts/test-stems.js docs]
