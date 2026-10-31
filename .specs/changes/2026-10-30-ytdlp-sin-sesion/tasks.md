---
change: 2026-10-30-ytdlp-sin-sesion
status: draft
rev: 1
---
# Tasks · ytdlp-sin-sesion

- [x] 1.1 Ajustes: cookieSource por defecto "none" y migración de "app" a "none" (REQ-1, REQ-2) @coder [verify: node scripts/test-ytdlp-sin-sesion.js settings]
- [x] 1.2 yt-dlp sin cookies, con runtime de JavaScript y reintento ante "formato no disponible" (REQ-1, REQ-3, REQ-4, REQ-5) @coder [verify: node scripts/test-ytdlp-sin-sesion.js args]
- [x] 1.3 Ajustes en la UI: quitar "Sesión de esta app" y dejar cookies de navegador como opción avanzada (REQ-3) @ui [verify: node --input-type=module --check < renderer/app.js]
- [x] 1.4 Prueba real con la pista que falló (Y2NkuFIlLEo): el formato se resuelve sin sesión y el error es comprensible (REQ-1, REQ-4, REQ-5) @coder [verify: node scripts/test-ytdlp-sin-sesion.js real]
