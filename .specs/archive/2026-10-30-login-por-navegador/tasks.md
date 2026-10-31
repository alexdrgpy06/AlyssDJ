---
change: 2026-10-30-login-por-navegador
status: draft
rev: 1
---
# Tasks · login-por-navegador

- [x] 1.1 Módulo main/auth-import.js: detectar navegadores, volcar cookies con yt-dlp, parsear Netscape y filtrar dominios (REQ-2, REQ-3, REQ-5) @coder [verify: node scripts/test-auth-import.js]
- [x] 1.2 IPC auth:browsers y auth:import-browser con limpieza del temporal y recarga de vistas; login directo con UA de Firefox (REQ-2, REQ-3, REQ-4, REQ-6, REQ-7) @coder [verify: node --check main/main.js && node --check preload/app.js]
- [x] 1.3 Diálogo de inicio de sesión en la UI, con errores en línea y estado de sesión (REQ-1, REQ-4, REQ-5, REQ-7) @ui [verify: node --input-type=module --check < renderer/app.js]
- [x] 1.4 Prueba de punta a punta en la app: diálogo, error sin navegador, importación con cookies sintéticas (REQ-1, REQ-2, REQ-3, REQ-4, REQ-7) @coder [verify: node scripts/test-login-flow.js]
- [x] 1.5 Documentar en docs/ (guía de primeros pasos y problemas frecuentes) con captura del diálogo (REQ-1) @pm [verify: grep -q "Importar sesión" docs/01-primeros-pasos.md]
