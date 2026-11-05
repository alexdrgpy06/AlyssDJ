---
change: 2026-11-03-automix-inicio-y-controles
---
# Tasks · 2026-11-03-automix-inicio-y-controles

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Módulo puro `automix-origin.js`: `radioOrigins` y `otherDeckHead` con su prueba de modelo (REQ-1, REQ-3) @coder [verify: node --experimental-default-type=module scripts/test-automix-inicio.js model]
- [x] 1.2 `AutoMix.start` toma la pista compatible del otro deck con la cola vacía; prueba del motor (REQ-3) @coder [verify: node --experimental-default-type=module scripts/test-automix-inicio.js engine]
- [x] 1.3 Panel: barra fija con Iniciar, Mezclar ahora, Siguiente y menú «Radio»; botón «Radio» en los resultados de búsqueda (REQ-1, REQ-4) @ui [verify: xvfb-run -a node scripts/test-automix-inicio.js panel]
- [x] 1.4 Vista inmersiva con iniciar/detener, mezclar ahora, siguiente y radio (REQ-2) @ui [verify: xvfb-run -a node scripts/test-automix-inicio.js immersive]
- [x] 1.5 Diseño a 1280×720 sin recortes: botones uniformes, estilos que envuelven, cola visible, barra superior sin partir textos (REQ-4) @ui [verify: xvfb-run -a node scripts/test-automix-inicio.js layout]
- [x] 1.6 Documentación, inventario, arquitectura regenerada, referencias visuales y CI (REQ-1, REQ-2, REQ-3, REQ-4) @coder [verify: node scripts/test-automix-inicio.js docs]
