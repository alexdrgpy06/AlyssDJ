---
change: 2026-11-03-efectos-ampliados
---
# Tasks · 2026-11-03-efectos-ampliados

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Siete tipos nuevos en el motor (tape, reducer, stutter, brake, transformer, drive, pitch) y su modelo (REQ-1, REQ-6) @coder [verify: node scripts/test-fx-ampliados.js model && xvfb-run -a node scripts/test-fx-ampliados.js engine]
- [x] 1.2 División de beat y etiquetas de P por tipo (REQ-2) @coder [verify: node scripts/test-fx-ampliados.js model && xvfb-run -a node scripts/test-fx-ampliados.js engine]
- [x] 1.3 Presets de fábrica y propios, guardar y borrar (REQ-3) @coder [verify: node scripts/test-fx-ampliados.js presets]
- [x] 1.4 Instant FX con rampas de entrada y salida (REQ-4) @ui [verify: xvfb-run -a node scripts/test-fx-ampliados.js ui]
- [x] 1.5 Orden de ranuras y ruta Deck o Ambos con vista del orden (REQ-5) @ui [verify: node scripts/test-fx-ampliados.js model && xvfb-run -a node scripts/test-fx-ampliados.js ui]
- [x] 1.6 Calidad de audio y coste de CPU acotado en autopruebas sintéticas (REQ-6, REQ-8) @coder [verify: xvfb-run -a node scripts/test-fx-ampliados.js engine]
- [x] 1.7 Frenazo en la caída para las recetas de AutoMix respetando nivel y ranuras libres (REQ-7) @coder [verify: node scripts/test-fx-ampliados.js automix]
- [x] 1.8 Documentación, inventario, ayuda y CI (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8) @coder [verify: node scripts/test-fx-ampliados.js docs]
