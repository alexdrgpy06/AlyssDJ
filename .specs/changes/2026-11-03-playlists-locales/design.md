---
change: 2026-11-03-playlists-locales
status: approved
rev: 1
approved_rev: 1
approved_hash: a4cb87344361117d3536deacbd4d5c395396f217937f433cfd4305eac4d3535b
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Design · 2026-11-03-playlists-locales

## Enfoque

Las playlists locales viven en un almacén propio (`main/playlists.js`, `PlaylistStore`) y la interfaz en un módulo nuevo (`renderer/playlists.js`, `PlaylistsUI`) que la librería monta; `library.js` solo recibe ganchos pequeños (selección, fuente `pl:<id>`, columna de acciones). No se reutiliza `playlists.json` (las importadas de YouTube Music): se queda como está y se copia a una lista local solo si el usuario lo pide.

- **Almacén:** `userData/playlists-local.json`, escritura atómica (`.tmp` + `rename`); si no se puede leer se renombra a `.bad-<fecha>` y se arranca vacío (REQ-8). Nunca toca archivos de música.
- **Pistas:** `{ videoId, title, artist, duration, thumb, local? }` sin rutas; la ruta se resuelve al abrir la lista con `localLib.pathOf` (igual que el resto de la librería).
- **Listas manuales** (`kind: 'manual'`) guardan las pistas en orden; **inteligentes** (`kind: 'smart'`) solo un `filter` y se resuelven con el índice local (`LocalSearch.search('', …)`), así se actualizan solas.
- **Quitar con deshacer:** `remove` devuelve `removed: [{ index, track }]`; `restore` las reinserta en su sitio. La interfaz guarda la última operación y ofrece «Deshacer» (botón y Ctrl+Z).
- **Selección:** `Library.sel` (conjunto de `videoId`); clic simple selecciona una, Ctrl/Cmd alterna, Mayús extiende hasta la última, Ctrl+A todo. La barra de selección actúa sobre `sel`.

## Contratos

```
PlaylistStore(file, { meta(id) → { bpm, camelot, genres } })
  list() → [{ id, name, kind, count, duration, updatedAt }]
  get(id) → { id, name, kind, tracks, sort, filter }
  create(name, { kind, filter, tracks }) → lista
  rename(id, name) · duplicate(id) · delete(id)
  add(id, tracks, { allowDup }) → { added, skipped }       // solo manuales
  remove(id, videoIds) → { removed: [{ index, track }] }
  restore(id, removed) → count
  reorder(id, videoIds) → lista                            // orden manual; borra sort
  sortBy(id, key, dir) → lista   // title|artist|bpm|key|genre|dur; guarda el orden y `sort`
  fromCrate(crate, name?) → lista
```

IPC (preload `window.ytdj.pl`): `list`, `get`, `create`, `rename`, `duplicate`, `delete`, `add`, `remove`, `restore`, `reorder`, `sort`, `fromCrate`, y el evento `onChange`. Todos responden `{ ok, data | error }`. `export:run` acepta la fuente `pl:<id>`. El filtro inteligente es `{ bpm: [min, max], key, compat, genres: [], analyzed: bool, stems: bool }`.

## Visual Spec

- **Fuentes:** bajo «Importadas» aparece la sección **Mis listas** con un botón «+» (nueva) y una fila por lista (icono de lista, o de rayo si es inteligente, nombre, número de pistas). La lista abierta usa el mismo realce que las demás fuentes. Aceptan soltar pistas (borde de acento mientras se arrastra encima).
- **Fila:** botón «＋ lista» en la columna de acciones que abre un menú con las listas y «Nueva playlist…». Casilla implícita: fila seleccionada con fondo de acento tenue.
- **Barra de selección** (sobre la tabla, solo con 2 o más pistas): «N seleccionadas · Añadir a playlist ▾ · Quitar de la lista · A la cola de AutoMix · Analizar · Cancelar».
- **Barra de lista** (toolbar al abrir una lista local): Renombrar, Duplicar, Borrar, Orden ▾ (título, artista, BPM, tonalidad, género, duración), Deshacer. Las filas se reordenan arrastrando solo en listas manuales sin filtros.
- **Nueva lista:** nombre en línea en la propia fila de «Mis listas» (sin ventana emergente); Intro crea, Esc cancela. Inteligente: panel con los filtros sobre la tabla.
- Estados vacíos con texto: «Esta lista está vacía: arrastra pistas o usa ＋ lista».
- Foco visible, menús con flechas/Esc, colores solo con los tokens existentes.

## Amendments

## Domain deltas
### library
#### ADDED spec: Playlists locales
THE SYSTEM SHALL guardar playlists propias (manuales o inteligentes) en `userData/playlists-local.json` de forma atómica, conservar una copia `.bad-…` si el archivo está dañado, no modificar nunca archivos de música, y permitir crearlas, renombrarlas, duplicarlas y borrarlas con su número de pistas y duración.
#### ADDED spec: Poner, sacar y ordenar pistas
WHEN el usuario arrastra pistas a una lista, usa «Añadir a playlist» o la barra de selección THE SYSTEM SHALL añadirlas sin repetir la pista en la misma lista; WHEN las quita THE SYSTEM SHALL conservar archivos y demás listas y permitir deshacer en su posición original; THE SYSTEM SHALL ordenar por título, artista, BPM, tonalidad, género o duración (las pistas sin dato al final) y permitir reordenar arrastrando, guardando el resultado.
#### ADDED spec: Listas inteligentes
THE SYSTEM SHALL resolver una lista inteligente a partir de sus filtros (BPM, tonalidad y compatibles, géneros, solo analizadas, solo con stems) sobre el índice local cada vez que se abre, sin permitir editar sus pistas a mano.
#### ADDED design: Almacén de playlists
`main/playlists.js` (`PlaylistStore`: `create`, `add`, `remove`/`restore`, `reorder`, `sortBy`, `setFilter`, `fromCrate`) con IPC `pl:*` y evento `pl:event`; la exportación acepta la fuente `pl:<id>`; la copia de una importada usa `pl:from-crate`.
### ui
#### ADDED spec: Mis listas y selección múltiple
THE SYSTEM SHALL mostrar «Mis listas» en las fuentes (nombre editable en línea, soltar pistas encima), un botón «＋» y un menú «Añadir a playlist» en cada fila, selección con clic, Ctrl/Cmd, Mayús y Ctrl+A, y una barra con añadir, quitar, cola de AutoMix y analizar cuando hay dos o más pistas seleccionadas.
#### ADDED design: Módulo de la interfaz
`renderer/playlists.js` (`PlaylistsUI`) lo monta `Library` (`library.pls`) con ganchos en `show`, `render`, `onClick` y el arrastre de filas.
