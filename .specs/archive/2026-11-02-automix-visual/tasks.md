---
change: 2026-11-02-automix-visual
---
# Tasks · 2026-11-02-automix-visual

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Modelo puro `viz.js`: fase del beat, anillos, intensidad, sin BPM, pausa, transición y movimiento reducido (REQ-1, REQ-2, REQ-3, REQ-6) @coder [verify: node scripts/test-visual.js model]
- [x] 2.1 `Visualizer`, lienzo, botón «Visual», persistencia, bucle a 30 fps solo si es visible, movimiento reducido, latido de la portada y rendimiento (REQ-4, REQ-5, REQ-6) @ui [verify: node scripts/test-visual.js ui]
- [x] 3.1 Regresión, documentación, capturas y lista de CI (REQ-7) @coder [verify: node scripts/test-visual.js docs]
