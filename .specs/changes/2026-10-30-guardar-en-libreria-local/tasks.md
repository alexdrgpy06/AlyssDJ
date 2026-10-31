---
change: 2026-10-30-guardar-en-libreria-local
status: draft
rev: 1
---
# Tasks · guardar-en-libreria-local

- [x] 1.1 Ajustes saveOnAnalyze, saveOnPlay y libraryDir; carpeta añadida a musicDirs (REQ-5) @coder [verify: node scripts/test-save-library.js settings]
- [x] 1.2 Descarga a la librería con mejor calidad, metadatos y carátula, sin parciales (REQ-1, REQ-6) @coder [verify: node scripts/test-save-library.js download]
- [x] 1.3 Registro en la librería local con análisis copiado, sin duplicar (REQ-3) @coder [verify: node scripts/test-save-library.js register]
- [x] 1.4 Guardar al reproducir más de 30 s y reproducir en LOCAL el archivo guardado (REQ-2, REQ-4) @coder [verify: node --input-type=module --check < renderer/deck.js]
- [x] 1.5 Ajustes en la UI (interruptores, carpeta, abrir) y estado "guardada" en deck y librería (REQ-4, REQ-5) @ui [verify: node --input-type=module --check < renderer/app.js]
- [~] 1.6 Prueba de punta a punta con descarga real de una pista pública y documentación (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6) @coder [verify: node scripts/test-save-library.js e2e] {claim: alex@alex-pc 2026-10-30T20:44:02-03:00}
