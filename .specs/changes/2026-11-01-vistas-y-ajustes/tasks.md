---
change: 2026-11-01-vistas-y-ajustes
---
# Tasks · 2026-11-01-vistas-y-ajustes

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 `SplitState` y `clampSplit` puros: arrastrar, límites, restablecer, guardado (REQ-1, REQ-2) @coder [verify: node scripts/test-vistas.js state]
- [~] 2.1 Divisores en la interfaz: arrastre, doble clic, teclado, variables CSS, guardado por vista y reajuste al redimensionar (REQ-1, REQ-2, REQ-5) @ui [verify: node scripts/test-vistas.js ui] {claim: alex@alex-pc 2026-11-01T23:50:29-03:00}
- [ ] 3.1 `settingsFilter`, secciones nuevas, buscador y estado vacío (REQ-3) @ui [verify: node scripts/test-vistas.js search]
- [ ] 3.2 Guardado al cambiar, confirmación, reversión en error, «Restablecer sección» y «Restablecer vistas» (REQ-2, REQ-4, REQ-5) @coder [verify: node scripts/test-vistas.js save]
- [ ] 4.1 Regresión, documentación, capturas y lista de CI (REQ-5, REQ-6) @coder [verify: node scripts/test-vistas.js docs]
