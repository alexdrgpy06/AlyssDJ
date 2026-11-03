---
change: 2026-11-03-interfaz-ordenada
---
# Tasks · 2026-11-03-interfaz-ordenada

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Inventario de controles (`docs/inventario-controles.md`) con nombre, icono, lugar y duplicados a retirar (REQ-1, REQ-5) @planner [verify: test -s docs/inventario-controles.md]
- [x] 1.2 AutoMix en un solo panel: retirar controles `imm-*`, añadir «Abrir panel», botón de la barra como indicador (REQ-1) @ui [verify: xvfb-run -a node scripts/test-orden.js automix]
- [x] 1.3 Barra superior en tres zonas con sesión y herramientas solo cuando requieren atención (REQ-2) @ui [verify: xvfb-run -a node scripts/test-orden.js topbar]
- [x] 1.4 Menú «⋯» del deck y controles que no aplican ocultos o atenuados con motivo (REQ-3, REQ-4) @ui [verify: xvfb-run -a node scripts/test-orden.js deck]
- [x] 1.5 Bancos plegables con memoria por deck (REQ-3) @ui [verify: xvfb-run -a node scripts/test-orden.js banks]
- [x] 1.6 Ajustes agrupados por tarea con la búsqueda actual intacta (REQ-5) @ui [verify: node scripts/test-rediseno.js settings && node scripts/test-vistas.js docs]
- [x] 1.7 Nombres coherentes, atajos y ayuda («?») alineados con el inventario (REQ-5, REQ-6) @coder [verify: node scripts/test-orden.js docs]
- [x] 1.8 Teclado, 1280×720 sin desbordes y pruebas existentes adaptadas (REQ-6, REQ-7) @ui [verify: xvfb-run -a node scripts/test-orden.js layout]
- [x] 1.9 Capturas y `docs/` regenerados (REQ-8) @ui [verify: node scripts/test-orden.js docs]
