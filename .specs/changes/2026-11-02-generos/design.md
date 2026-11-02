---
change: 2026-11-02-generos
status: approved
rev: 1
approved_rev: 1
approved_hash: 45e9392db6f5277a5bffd2f27b02e614046e7058c752b612d79448dc5b3e4d5b
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-generos



## Enfoque

- **Almacén propio** `main/genres.js`: `userData/genres.json`, mapa `id → { genres: string[], source: 'metadatos'|'archivo'|'manual' }`. No vive en el JSON de análisis, así que reanalizar no lo pierde (REQ-1). Escritura atómica (`.tmp` + rename). `normalize(list)`: recorta, minúsculas con mayúscula inicial de cada palabra, quita duplicados, máximo 5, separa por `;`, `/` y `,`.
- **Lectura automática** (REQ-2): `LocalLibrary.probe` ya lee las etiquetas con `ffmpeg -i`; añade `genre` y lo guarda en el índice. `Analyzer` tras la descarga lee la misma etiqueta del archivo (`tags.probe`) y, si no hay, usa `genre` de yt-dlp (`--print after_move:YTDJGENRE %(genre)s`, ignorando `NA`). Solo se escribe si no hay entrada `manual`.
- **IPC** (`preload/app.js`): `genres.all() → { map, vocabulary }`, `genres.set(id, list)` (guarda como `manual`; lista vacía borra la entrada manual y vuelve a lo automático), evento `genres:changed`.
- **Librería** (REQ-3, REQ-4): `renderer/library.js` pinta chips bajo el título y añade a la barra un filtro por género (menú de selección múltiple con el vocabulario y su cuenta); la fila gana «Editar géneros» en su menú, con un campo de etiquetas (Enter o coma añade, Retroceso quita) y autocompletado del vocabulario.
- **AutoMix** (REQ-5): `AutoMix.genres` (mapa cargado y refrescado con `genres:changed`); antes de `rankCandidates` se anota `track.genres`. En `mixplan.js`, `rankCandidates` suma `GENRE_BONUS = 1.2` al `style` de la candidata que comparta algún género con `refTrack`; sin géneros en alguna de las dos, 0. La cola muestra los chips.
- **Exportación** (REQ-6): `main/export.js` `normalize()` incluye `genre` (géneros unidos con `, `); CSV gana la columna `género` y Rekordbox XML el atributo `Genre` de `TRACK`; M3U8 no cambia.

## Contratos

- `genres.json`: `{ "<id>": { "genres": ["House", "Deep House"], "source": "manual" } }`.
- `rankCandidates` acepta `track.genres?: string[]`; sin ellas el resultado es idéntico al actual.
- CSV: la columna nueva va tras `Camelot` y antes de `ruta`.

## Decisiones

- Almacén aparte y no en el análisis: lo manual debe sobrevivir a reanalizar y las pistas locales sin analizar también pueden tener género.
- Preferir, no filtrar, en el AutoMix: un bono pequeño que no descarta candidatas ni castiga a las sin género.
- Sin sinónimos: «House» y «Deep House» son etiquetas distintas (fuera de alcance).

## Visual Spec

Chips pequeños (alto 18 px, texto 11 px, color neutro con borde, sin color por género) tras el artista en la fila de la librería y la cola; máximo 3 visibles y «+N». El filtro es un botón «Géneros» en `.lib-toolbar` que abre un menú con casillas y cuentas, usable con teclado (flechas, espacio, Escape). El editor es un campo con chips que se abre bajo la fila, con el foco en el campo y Escape para cerrar. Contraste AA en oscuro, objetivos táctiles de al menos 24 px, sin animaciones.

## Amendments

### A1 · 2026-11-02
No se añadió la lectura de `%(genre)s` de yt-dlp: YouTube Music casi nunca lo trae y el riesgo de parsear la salida de la descarga no compensa. La fuente automática de pistas de YouTube es la etiqueta del archivo bajado (`ffmpeg -i`), con origen `metadatos`; las locales usan `archivo`. Afecta a REQ-2. Además, la columna `género` del CSV va tras `Camelot` y antes de `ruta`, y el almacén expone `genres:event` para refrescar la interfaz.
