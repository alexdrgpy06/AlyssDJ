---
change: 2026-11-04-automix-simple-y-continuo
---
# Tasks · 2026-11-04-automix-simple-y-continuo

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 `songKey` y filtro de duplicados en inicio, agregar, radio y sugeridas, con confirmación (REQ-4) @coder [verify: node --experimental-default-type=module scripts/test-automix-continuo.js dup]
- [x] 1.2 Entrada segura sin análisis y plan que espera al análisis (REQ-1) @coder [verify: node --experimental-default-type=module scripts/test-automix-continuo.js entry]
- [x] 1.3 Transición solo con la entrante lista y colocada; espera y salto a los 20 s (REQ-2) @coder [verify: node --experimental-default-type=module scripts/test-automix-continuo.js seamless]
- [x] 1.4 Receta por fuente: local completa, stream solo fundido y filtro; sin FX de reproducción en stream (REQ-3) @coder [verify: node --experimental-default-type=module scripts/test-automix-continuo.js source]
- [x] 1.5 Panel simple: Perfil, Duración y Efectos; resto en «Avanzado»; tarjeta SIGUE con punto seguro y aviso de duplicado (REQ-1, REQ-4, REQ-5) @ui [verify: xvfb-run -a node scripts/test-automix-continuo.js ui]
- [x] 1.6 Documentación, inventario, arquitectura, referencias visuales y CI (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5) @coder [verify: node scripts/test-automix-continuo.js docs]
