---
change: 2026-10-30-login-por-navegador
status: approved
rev: 1
approved_rev: 1
approved_hash: d6f2c5dcf6247b90e39c8670ece2d730eca3e5fb520be91e6e2c2dd0c5dae58a
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Design · login-por-navegador

## Enfoque
Reutilizar yt-dlp, que ya sabe descifrar las cookies de cada navegador (incluido el llavero en Chromium), en lugar de reimplementar la lectura de bases de datos. El flujo es: yt-dlp vuelca las cookies a un archivo Netscape temporal → se filtran por dominio → se cargan en la sesión `persist:ytm` de Electron → se borra el temporal → se recargan las vistas.

## Contratos
IPC (main ↔ renderer):

| Canal | Entrada | Salida |
|---|---|---|
| `auth:browsers` | — | `{ id, label }[]` navegadores con perfil encontrado; lista completa si no hay ninguno |
| `auth:import-browser` | `browserId` | `{ ok, count }` o `{ ok:false, error }` |
| `auth:login` | `{ mode:'direct' }` | abre la ventana de Google con UA de Firefox |

Módulo `main/auth-import.js` (sin dependencias de Electron salvo la sesión que recibe):
- `detectBrowsers()` — comprueba directorios de perfil.
- `dumpCookies(ytdlpBin, browserId, file)` — `yt-dlp --cookies-from-browser <id> --cookies <file> --simulate -q <url pública>`; tolera código de salida distinto de 0 si el archivo existe.
- `parseNetscape(text)` — devuelve cookies `{domain, path, secure, httpOnly, expires, name, value}` (incluye líneas `#HttpOnly_`).
- `isYoutubeGoogle(domain)` — acepta youtube.com y google.com y subdominios.

## Decisiones
- **Filtrar antes de guardar:** el archivo de yt-dlp contiene todas las cookies del navegador; se filtra en memoria y el temporal se crea con 0600 y se borra en `finally`.
- **Sin logs de valores:** solo se registra el número de cookies importadas.
- **Huella de Firefox solo en la ventana de login:** los decks siguen con UA de Chrome (probado con la reproducción). El login directo puede seguir bloqueado; por eso la importación es la vía recomendada.
- **No se cambia `cookieSource`:** al estar las cookies en la sesión de la app, "Sesión de esta app" de yt-dlp pasa a usarlas.

## UI
Diálogo `#login` con el mismo estilo de los ajustes: texto explicativo, selector de navegador con botón **Importar** (primario) y un enlace secundario **Probar inicio de sesión directo**. Mensajes de error en línea, sin toasts, para que no desaparezcan.

## Domain deltas
### auth
#### ADDED spec: Inicio de sesión de YouTube Music
WHEN el usuario pulsa "Iniciar sesión" THE SYSTEM SHALL mostrar un diálogo que ofrezca importar la sesión desde un navegador instalado o intentar el inicio de sesión directo.
WHEN el usuario importa desde un navegador THE SYSTEM SHALL copiar a la sesión de la app solo las cookies de youtube.com y google.com, eliminar el archivo temporal aunque falle y recargar los decks.
IF la importación falla THEN THE SYSTEM SHALL mostrar la causa y qué hacer sin modificar la sesión.
#### ADDED design: Importación de cookies con yt-dlp
`main/auth-import.js` vuelca las cookies con `yt-dlp --cookies-from-browser`, las filtra en memoria por dominio y las carga en `persist:ytm`; canales IPC `auth:browsers`, `auth:import-browser` y `auth:verify`; el login directo usa la huella de Firefox solo en su ventana.
