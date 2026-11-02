---
change: 2026-11-02-exportar-biblioteca
status: approved
rev: 1
approved_rev: 1
approved_hash: d0221125fc3d20d4d59ff83573e57f707ca64505c285504810640ce5ccbcd9c7
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-exportar-biblioteca

## Enfoque

Un módulo puro `main/export.js` (sin Electron) con tres generadores y un normalizador; `main/main.js` solo reúne los datos, abre el cuadro de guardado y escribe el archivo. La interfaz añade un botón «Exportar» a la barra de la Librería.

- **Entradas normalizadas** (`Entry`): `{ id, title, artist, duration, bpm, offset, key, camelot, path, mix }`. `normalize(record, resolvePath)` toma un registro de análisis o una fila de playlist y devuelve un `Entry`; los campos de análisis quedan vacíos (`0`/`''`/`null`) si no hay análisis.
- **Ruta de audio**: `saved.path` si existe en el disco; si no, la ruta de la pista local (`localLib`) por id; si no, el audio que conserva la caché (`analyzer.audioFile`). Si ninguna existe, `path` es `''`.
- **Orígenes**: `all` = `analyzer.list()` (todo lo analizado); `crate:<id>` = pistas de la playlist importada, cada una unida a su análisis por `videoId` (o por el `localId` de la copia guardada).
- **Generadores**: `toM3u8(entries, name)`, `toCsv(entries)`, `toRekordbox(entries, name)` devuelven texto. M3U8 y Rekordbox omiten las entradas sin `path` y devuelven también cuántas omitieron; CSV las deja con la ruta vacía.
- **Escritura**: `writeAtomic(file, text)` escribe `file + '.tmp'` y renombra; ante error borra el temporal y lanza.
- **Rekordbox**: `DJ_PLAYLISTS Version="1.0.0"` con `PRODUCT Name="AlyssDJ"`, `COLLECTION Entries=n` y por pista `TrackID` (1..n), `Name`, `Artist`, `TotalTime` (segundos enteros), `AverageBpm` (2 decimales), `Tonality` (Camelot, p. ej. `8A`; vacío si no hay), `Location` = `file://localhost/` + ruta con cada segmento codificado, un `TEMPO Inizio=offset Bpm=bpm Metro="4/4" Battito="1"` y `POSITION_MARK` tipo 0 (cue) para `mixIn`, `introEnd` y `outroStart` cuando existen (nombres «Mezcla», «Intro», «Salida»; `Num` 0..2 en orden). `PLAYLISTS` contiene `ROOT` con un nodo `NODE Type="1"` con las claves de las pistas.
- **XML**: `esc()` convierte `& < > " '` y elimina caracteres de control no válidos en XML 1.0.
- **CSV**: separador coma, fin de línea CRLF, campos con coma, comilla o salto entre comillas dobles (comillas duplicadas). Se antepone un BOM UTF-8 para que las hojas de cálculo lean bien los acentos.

## Contratos

- `normalize(rec, resolvePath) → Entry`.
- `toM3u8(entries, name) → { text, written, skipped }`; `toCsv(entries) → { text, written, skipped: 0 }`; `toRekordbox(entries, name) → { text, written, skipped }`.
- `writeAtomic(file, text)`.
- IPC `export:run(source, format)` (`source`: `'all'` o `'crate:<id>'`; `format`: `'m3u8' | 'csv' | 'rekordbox'`) → `{ ok, file, written, skipped }`, `{ ok:false, canceled:true }` o `{ ok:false, error }`. El nombre sugerido es `<lista>.<ext>` (`.m3u8`, `.csv`, `.xml`) con el título saneado.
- Preload: `window.ytdj.export.run(source, format)`.
- Autoprueba: `YTDJ_EXPORT_FILE` fija la ruta de salida y evita el cuadro de guardado cuando `YTDJ_SELFTEST=1`.

## Visual Spec

- Botón «Exportar» (`#btn-export`, icono existente de descarga o de lista) en `.lib-toolbar`, junto a «Analizar lista». Visible en las pestañas de analizadas y de playlists importadas; oculto en búsqueda y en directo.
- Al pulsarlo se abre un menú pequeño (`role="menu"`) bajo el botón con tres opciones: «M3U8 (lista)», «CSV (hoja de cálculo)» y «Rekordbox XML». Se cierra con Escape o al elegir; el foco vuelve al botón.
- El resultado va al `#lib-msg` (`role="status"`): «Exportadas N pistas a nombre.ext» y, si hubo omitidas, «M sin audio en el disco omitidas».
- Mismos tokens y estilo `.btn.sm` que los botones vecinos; sin elementos nuevos fuera de la barra.

## Amendments
