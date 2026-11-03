---
change: 2026-11-03-automix-claro
---
# Tasks · 2026-11-03-automix-claro

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Módulo de estado `describe(snap)` y línea de estado con fases, cuenta atrás y motivo (REQ-1) @coder [verify: node --experimental-default-type=module scripts/test-automix-claro.mjs status]
- [x] 1.2 Compatibilidad de la cola en tres niveles con motivo y marcas (REQ-5) @coder [verify: node --experimental-default-type=module scripts/test-automix-claro.mjs compat]
- [x] 1.3 Perfiles Suave, Club, Radio y Personalizado que se recuerdan (REQ-6) @coder [verify: node --experimental-default-type=module scripts/test-automix-claro.mjs profiles]
- [x] 1.4 Línea de tiempo de la mezcla con arrastre de salida, entrada y duración y efecto inmediato en la receta (REQ-2, REQ-3) @ui [verify: xvfb-run -a node scripts/test-automix-claro.js ui]
- [x] 1.5 Preescucha de la próxima transición por auriculares desde la línea de tiempo (REQ-4) @ui [verify: xvfb-run -a node scripts/test-automix-claro.js ui]
- [x] 1.6 Robustez: una pista que falla o no se analiza se salta con motivo en el estado (REQ-8) @coder [verify: xvfb-run -a node scripts/test-automix-claro.js robust]
- [x] 1.7 Tarjeta compacta de estado en las demás vistas (REQ-7) @ui [verify: xvfb-run -a node scripts/test-automix-claro.js ui]
- [x] 1.8 Documentación, capturas, inventario y CI (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9) @coder [verify: node scripts/test-automix-claro.js docs]
