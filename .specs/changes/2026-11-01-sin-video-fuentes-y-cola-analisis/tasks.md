---
change: 2026-11-01-sin-video-fuentes-y-cola-analisis
---
# Tasks · 2026-11-01-sin-video-fuentes-y-cola-analisis

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Retirar el video de main, preload, renderer, analizador, ajustes, pruebas y docs (REQ-1) @coder [verify: node scripts/test-sinvideo.js removed]
- [x] 2.1 Módulo `source.js`, ajuste preferSaved, etiqueta de origen en deck y chip en librería (REQ-2) @coder [verify: node scripts/test-sinvideo.js source]
- [ ] 3.1 Cola de análisis persistente en main con IPC y pruebas de unidad (REQ-3) @coder [verify: node scripts/test-sinvideo.js backlog]
- [ ] 3.2 Fuente y vista «Análisis», «Analizar lista» y «Analizar» por playlist (REQ-4) @ui [verify: node scripts/test-sinvideo.js queue-ui]
- [ ] 4.1 Sistema de vistas (Mezcla, Librería, Ondas), selector, atajos y ondas arriba o en el deck (REQ-5) @ui [verify: node scripts/test-sinvideo.js views]
- [ ] 4.2 Vista Automix inmersiva y salto automático desde la fuente AutoMix (REQ-5) @ui [verify: node scripts/test-sinvideo.js immersive]
- [ ] 5.1 Regresión, documentación, capturas y lista de CI (REQ-6) @coder [verify: node scripts/test-sinvideo.js docs]
