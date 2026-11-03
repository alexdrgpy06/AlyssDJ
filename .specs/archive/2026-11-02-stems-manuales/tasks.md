---
change: 2026-11-02-stems-manuales
---
# Tasks · 2026-11-02-stems-manuales

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 stems-dsp.js: STFT/iSTFT de Demucs, normalización, ventanas con solape y salida por trozos, con inferencia inyectable (REQ-1, REQ-3) @coder [verify: node --experimental-default-type=module scripts/test-stems.js model]
- [x] 1.2 StemStore: almacén, cola de una pista, cancelación, límites y proceso hijo con ffmpeg a FLAC de 8 canales (REQ-1, REQ-2, REQ-3, REQ-8) @coder [verify: node --experimental-default-type=module scripts/test-stems.js store]
- [x] 1.3 Modelo bajo demanda con permiso, SHA-256 y disponibilidad por plataforma; IPC, preload y filtros de empaquetado (REQ-4, REQ-8) @coder [verify: node --experimental-default-type=module scripts/test-stems.js ipc]
- [x] 1.4 Motor del deck: reproducir el FLAC de 8 canales con matriz de ganancias, mute y solo sin chasquidos, y volver a la pista completa (REQ-5, REQ-6) @coder [verify: node --experimental-default-type=module scripts/test-stems.js engine]
- [x] 1.5 Interfaz: tira de stems en el deck y botón, chip y borrado en la Librería (REQ-2, REQ-5, REQ-7, REQ-8) @ui [verify: node --experimental-default-type=module scripts/test-stems.js ui]
- [x] 1.6 Documentación, CI y prueba real opcional con el modelo (REQ-1, REQ-4, REQ-7) @coder [verify: node --experimental-default-type=module scripts/test-stems.js docs]
