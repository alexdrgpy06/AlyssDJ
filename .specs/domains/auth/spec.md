---
domain: auth
paths: [main/main.js, main/auth-import.js, preload/app.js, renderer/app.js, renderer/index.html, renderer/styles.css, docs/**]
last_change: 2026-10-30-login-por-navegador
---
# auth · spec

## Inicio de sesión de YouTube Music

WHEN el usuario pulsa "Iniciar sesión" THE SYSTEM SHALL mostrar un diálogo que ofrezca importar la sesión desde un navegador instalado o intentar el inicio de sesión directo.
WHEN el usuario importa desde un navegador THE SYSTEM SHALL copiar a la sesión de la app solo las cookies de youtube.com y google.com, eliminar el archivo temporal aunque falle y recargar los decks.
IF la importación falla THEN THE SYSTEM SHALL mostrar la causa y qué hacer sin modificar la sesión.
