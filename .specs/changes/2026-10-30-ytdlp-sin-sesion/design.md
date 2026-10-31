---
change: 2026-10-30-ytdlp-sin-sesion
status: approved
rev: 1
approved_rev: 1
approved_hash: 704e944a718ff09ec7c2cf3d12f6c2c500f4fd06913febf5309f816a66f546be
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Design · ytdlp-sin-sesion

## Enfoque
Quitar las cookies de la ruta de yt-dlp y darle un runtime de JavaScript. Es un cambio de configuración más un reintento; no cambia el flujo de analizar/guardar.

## Contratos
- `settings.cookieSource` por defecto `'none'`; al leerlo, el valor `'app'` se migra a `'none'` y se persiste. La opción "Sesión de esta app" desaparece del selector; quedan "Ninguna (recomendado)" y navegadores como opción avanzada.
- `ytdlp.cookieArgs(settings)`: `'none'` → `[]`; navegador → `--cookies-from-browser`. Ya no se llama a `exportCookies` desde el analizador (la función queda por si se usa en pruebas).
- `ytdlp.runtimeArgs()`: `--js-runtimes node:<ruta>` con el `node` del PATH; si no existe, `process.execPath` con `ELECTRON_RUN_AS_NODE=1` en el entorno del proceso; si tampoco, sin argumento.
- `download` y `downloadToLibrary`: `-f bestaudio/best -S abr,asr`; si el error contiene "Requested format is not available", un solo reintento con `-f ba*/b` (cualquier audio, aunque venga con video). Si falla, mensaje: "YouTube no entregó audio para esta pista sin sesión. Sigue sonando por streaming."

## Decisiones
- **Sin sesión por defecto:** es lo que pidió el usuario y lo que se verificó que devuelve formatos; la calidad es la mejor sin sesión (~130 kbps opus/AAC).
- **Sin reintento con cookies:** evita volver a mezclar la cuenta del usuario con las descargas.

## Domain deltas
### analysis
#### ADDED spec: yt-dlp sin sesión
WHEN el sistema ejecuta yt-dlp para analizar o guardar una pista THE SYSTEM SHALL hacerlo sin cookies de ninguna sesión por defecto, con un runtime de JavaScript disponible.
IF yt-dlp responde que el formato no está disponible THEN THE SYSTEM SHALL reintentar una vez con una selección más abierta y, si falla, explicar la causa.
#### ADDED design: Cookies solo para el streaming
`ytdlp.cookieArgs` devuelve `[]` para `none` y `app` (los ajustes antiguos se migran); `ytdlp.runtime` pasa `--js-runtimes` con Node del sistema o Electron como Node; `withFormatRetry` aplica el reintento.
