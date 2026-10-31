---
change: 2026-10-31-spotify-entrada
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-10-31-spotify-entrada

## Enfoque
- `main/spotify.js`: OAuth 2.0 Authorization Code + PKCE con redirección a `http://127.0.0.1:<puerto efímero>/callback` (servidor local de un solo uso) y `shell.openExternal`. Token y refresh token cifrados con `safeStorage` en la carpeta de datos. Cliente de la Web API (`search`, `me/tracks`, `me/playlists`, `playlists/{id}/tracks`) con renovación del token y manejo de 429.
- `main/spotify-match.js`: `matchTrack({artist,title,duration}) -> {videoId, score}`; usa `ytm-library.search`, puntúa por similitud normalizada de título/artista (sin «feat.», «remaster») y diferencia de duración; umbral 0,6; caché en disco por `spotifyId`.
- Ajustes: `spotifyClientId`, `inputEngine: 'ytm'|'spotify'|'both'`; guía para crear la app en el panel de desarrolladores (redirect URI `http://127.0.0.1/callback`).
- Librería: pestañas «Spotify» (Me gusta, Playlists, Buscar) con un distintivo de origen; al cargar, `match` resuelve el `videoId` y el resto del flujo es el de YouTube.
- Pruebas: `scripts/test-spotify.js` con un servidor de Spotify falso (PKCE, paginación, 429) y casos de emparejamiento.

## Contratos
Pista de Spotify: `{ spotifyId, title, artist, duration, matched?: { videoId, score } }`.

## Visual Spec
Pestaña nueva en la librería, botón conectar en Ajustes y selector de motor; estilos de la app.

## Amendments
