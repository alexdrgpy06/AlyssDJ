---
change: 2026-11-02-exportar-biblioteca
---
# Tasks · 2026-11-02-exportar-biblioteca

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Módulo puro `main/export.js`: normalizar, M3U8, CSV, Rekordbox XML y escritura atómica (REQ-1, REQ-2, REQ-3, REQ-4) @coder [verify: node scripts/test-export.js model]
- [x] 2.1 IPC `export:run`, preload, botón «Exportar» con menú y avisos; pruebas con la interfaz sin ventana (REQ-1, REQ-4, REQ-5) @ui [verify: node scripts/test-export.js ui]
- [~] 3.1 Documentación, lista de CI y regresión (REQ-5) @coder [verify: node scripts/test-export.js docs] {claim: alex@alex-pc 2026-11-02T03:46:11-03:00}
