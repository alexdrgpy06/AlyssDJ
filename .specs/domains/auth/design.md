---
domain: auth
paths: [main/main.js, main/auth-import.js, preload/app.js, renderer/app.js, renderer/index.html, renderer/styles.css, docs/**]
last_change: 2026-10-30-login-por-navegador
---
# auth · design

## Importación de cookies con yt-dlp

`main/auth-import.js` vuelca las cookies con `yt-dlp --cookies-from-browser`, las filtra en memoria por dominio y las carga en `persist:ytm`; canales IPC `auth:browsers`, `auth:import-browser` y `auth:verify`; el login directo usa la huella de Firefox solo en su ventana.
