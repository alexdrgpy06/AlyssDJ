---
change: 2026-11-02-preescucha-libreria
---
# Tasks · 2026-11-02-preescucha-libreria

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [ ] 1.1 Módulo preview.js: punto de inicio, una sola pista, salida de auriculares, seek y parada (REQ-1, REQ-2, REQ-3, REQ-4, REQ-6) @coder [verify: node --experimental-default-type=module scripts/test-preescucha.js model]
- [ ] 1.2 Botón ▶ y barra de progreso en las filas de la Librería, con estado deshabilitado (REQ-1, REQ-4, REQ-5) @ui [verify: node --experimental-default-type=module scripts/test-preescucha.js ui]
- [ ] 1.3 Parada al sonar un deck sin auriculares, documentación y CI (REQ-3, REQ-6) @coder [verify: node --experimental-default-type=module scripts/test-preescucha.js docs]
