---
change: 2026-10-31-spotify-entrada
type: feature
domains: [sources, library]
paths: [main/spotify.js, main/spotify-match.js, main/main.js, main/settings.js, preload/app.js, renderer/library.js, renderer/index.html, renderer/app.js, renderer/styles.css, docs/**, scripts/test-spotify.js]
commits: []
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Requirements · 2026-10-31-spotify-entrada

## Contexto
Se quiere usar Spotify Premium como fuente de pistas, con la cuenta del usuario, pudiendo elegir motor: YouTube Music, Spotify o ambos. Restricciones reales de Spotify: su audio va cifrado (DRM) y no se puede tomar de la tubería de audio de la app, no permite descargar, y su API de análisis de audio ya no está disponible para apps nuevas. Por eso Spotify aporta el **catálogo y la cuenta**, y el audio que se mezcla sale de YouTube Music (stream o archivo local), emparejando cada pista.

## Requisitos
### REQ-1: Conectar la cuenta
WHEN el usuario pulsa «Conectar Spotify» THE SYSTEM SHALL iniciar OAuth con PKCE en el navegador del sistema y guardar el token cifrado, sin guardar la contraseña ni el secreto de cliente.
### REQ-2: Catálogo de Spotify
WHILE hay una cuenta conectada THE SYSTEM SHALL permitir buscar, ver «Me gusta» y listar y abrir las playlists de Spotify en la librería.
### REQ-3: Emparejar con YouTube Music
WHEN el usuario carga o pone en cola una pista de Spotify THE SYSTEM SHALL buscar su equivalente en YouTube Music por artista, título y duración (±3 s), usar la mejor coincidencia y mostrar «sin coincidencia» si ninguna supera el umbral.
### REQ-4: Elegir motor
THE SYSTEM SHALL ofrecer en la librería y en Ajustes el motor de entrada: «YouTube Music», «Spotify» o «Ambos», y con «Ambos» mostrar las dos listas con su origen.
### REQ-5: Todas las funciones de mezcla
WHEN una pista de Spotify se ha emparejado THE SYSTEM SHALL tratarla como una pista de YouTube (análisis, guardado local, AutoMix, video).
### REQ-6: Honestidad sobre el reproductor de Spotify
THE SYSTEM SHALL indicar en la interfaz y en la guía que la reproducción directa de Spotify (con su SDK) no ofrece EQ, efectos ni sync por el cifrado DRM, y no ofrecerla como motor de mezcla.
### REQ-7: Sin credenciales en el repositorio
THE SYSTEM SHALL pedir al usuario su propio Client ID de la app de Spotify (Ajustes) y no incluir ninguno en el código.

## Fuera de alcance
Descargar audio de Spotify, reproducir con el SDK de Spotify dentro de los decks, y analizar con la API de audio de Spotify. No puedo probar el flujo OAuth con tu cuenta sin que lo hagas tú en el navegador.
