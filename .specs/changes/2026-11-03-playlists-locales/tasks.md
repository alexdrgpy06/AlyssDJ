---
change: 2026-11-03-playlists-locales
---
# Tasks · 2026-11-03-playlists-locales

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Almacén de playlists: CRUD, añadir sin duplicados, quitar con deshacer, orden, listas inteligentes y guardado atómico (REQ-1, REQ-2, REQ-3, REQ-5, REQ-6, REQ-8) @coder [verify: node scripts/test-playlists.js store]
- [x] 1.2 IPC, preload y exportación `pl:<id>` con importación de una playlist de YouTube Music (REQ-1, REQ-7) @coder [verify: node scripts/test-playlists.js ipc]
- [x] 1.3 Interfaz: sección Mis listas, crear/renombrar/duplicar/borrar, «＋ lista» en las filas y soltar pistas (REQ-1, REQ-2) @ui [verify: xvfb-run -a node scripts/test-playlists.js ui]
- [x] 1.4 Selección múltiple y barra de acciones, quitar con deshacer (REQ-3, REQ-4) @ui [verify: xvfb-run -a node scripts/test-playlists.js select]
- [x] 1.5 Ordenar y reordenar a mano (REQ-5) @ui [verify: xvfb-run -a node scripts/test-playlists.js order]
- [x] 1.6 Listas inteligentes desde filtros (REQ-6) @ui [verify: xvfb-run -a node scripts/test-playlists.js smart]
- [x] 1.7 Guardar importada como local, exportar y enviar a AutoMix (REQ-7) @ui [verify: xvfb-run -a node scripts/test-playlists.js export]
- [x] 1.8 Guía, ayuda, inventario y CI (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8) @pm [verify: node scripts/test-playlists.js docs]
