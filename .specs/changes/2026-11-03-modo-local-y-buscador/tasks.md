---
change: 2026-11-03-modo-local-y-buscador
---
# Tasks · 2026-11-03-modo-local-y-buscador

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Índice `LocalSearch` con texto normalizado, fusión por id, filtros de BPM, tonalidad y género; 20 000 pistas en menos de 100 ms (REQ-1, REQ-5, REQ-7) @coder [verify: node scripts/test-local.js search]
- [x] 1.2 IPC `lib:search-local` y `local:similar` con las cuatro fuentes, sin rutas ni consultas hacia fuera (REQ-1, REQ-6, REQ-8) @coder [verify: node scripts/test-local.js ipc]
- [x] 1.3 Modo local: ajuste `localMode`, puerta de red en main (búsqueda, sesión, actualizaciones, herramientas, modelos) y marca «LOCAL» (REQ-3) @coder [verify: node scripts/test-local.js mode]
- [x] 1.4 Buscador con ámbito Todo / Mi equipo / YouTube Music, resultados locales al instante, etiquetas de fuente y caída sin conexión (REQ-1, REQ-2, REQ-4) @ui [verify: xvfb-run -a node scripts/test-local.js ui]
- [x] 1.5 Filtros de BPM, tonalidad y género en la interfaz (REQ-5) @ui [verify: xvfb-run -a node scripts/test-local.js filters]
- [x] 1.6 AutoMix sugiere y rellena desde lo local con modo local o ámbito «Mi equipo» (REQ-6) @coder [verify: node scripts/test-local.js automix]
- [x] 1.7 Documentación, ayuda y CI (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6) @ui [verify: node scripts/test-local.js docs]
