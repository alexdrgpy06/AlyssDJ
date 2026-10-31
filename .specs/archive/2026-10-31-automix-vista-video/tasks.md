---
change: 2026-10-31-automix-vista-video
---
# Tasks · 2026-10-31-automix-vista-video

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Lógica pura: pickMedia, airWeights, clampWidth y su prueba (REQ-2, REQ-3, REQ-4, REQ-5) @coder [verify: node --experimental-default-type=module scripts/test-ministage.js]
- [x] 1.2 Deck: videoKey y vaciado de videoSrc al cargar otra pista (REQ-2) @coder [verify: node --experimental-default-type=module scripts/test-ministage.js]
- [x] 2.1 Franja #stage, interruptor Vista, estilos, asa de tamaño y persistencia (REQ-1, REQ-4) @ui [verify: node scripts/test-stage.js layout]
- [x] 2.2 Integración en el bucle: video sincronizado, al aire, doble clic y miniatura desactivada (REQ-2, REQ-3, REQ-5, REQ-6) @coder [verify: node scripts/test-stage.js live]
- [x] 3.1 Prueba de extremo a extremo en Electron, documentación y capturas (REQ-1, REQ-2, REQ-4, REQ-5, REQ-6) @coder [verify: node scripts/test-stage.js e2e]
