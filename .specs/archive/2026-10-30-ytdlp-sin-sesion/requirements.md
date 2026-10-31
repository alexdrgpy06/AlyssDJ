---
change: 2026-10-30-ytdlp-sin-sesion
type: fix
domains: [analysis]
paths: [main/settings.js, main/analyzer.js, main/ytdlp.js, main/tools.js, renderer/index.html, renderer/app.js, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 04dacc82e9eed96c746a64fceeb197e3661c8f7a6fc4d9b26c82e881febb9cbc
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Requirements · ytdlp-sin-sesion

## Contexto
Al analizar o guardar pistas, algunas fallan con "Requested format is not available". yt-dlp recibía las cookies de la sesión de la app; con cookies, YouTube obliga a usar clientes web que hoy no entregan formatos de audio sin un token, y además yt-dlp avisa de que no encuentra un runtime de JavaScript. Sin cookies, las mismas pistas devuelven sus formatos de audio. La sesión del usuario solo hace falta para el streaming de los decks.

## Requisitos

### REQ-1: yt-dlp sin sesión
WHEN el sistema ejecuta yt-dlp para analizar o guardar una pista THE SYSTEM SHALL hacerlo sin cookies de ninguna sesión por defecto, y no volver a exportar las cookies de la sesión de la app a yt-dlp.

### REQ-2: Ajustes existentes
WHEN la configuración guardada indica la sesión de la app como fuente de cookies de yt-dlp THE SYSTEM SHALL tratarla como "ninguna" y actualizarla.

### REQ-3: Cookies solo para el streaming
THE SYSTEM SHALL usar las cookies de la sesión de YouTube Music únicamente en las vistas de los decks y de la biblioteca, y ofrecer cookies de un navegador para yt-dlp solo como opción avanzada, desactivada por defecto.

### REQ-4: Runtime de JavaScript
WHEN yt-dlp se ejecuta THE SYSTEM SHALL indicarle un runtime de JavaScript disponible (Node del sistema o, si no hay, el propio Electron como Node) para que no falte extracción de formatos.

### REQ-5: Formato no disponible
IF yt-dlp responde que el formato pedido no está disponible THEN THE SYSTEM SHALL reintentar una vez con la selección más abierta de formatos de audio y, si sigue fallando, mostrar la causa en español y recordar que la pista puede seguir sonando por streaming.

## Fuera de alcance
- Obtener formatos que requieren sesión o tokens (pistas con restricción de edad o contenido privado).
- Calidad Premium de 256 kbps (depende de la sesión y de tokens).
