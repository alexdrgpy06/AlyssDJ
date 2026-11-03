---
change: 2026-11-03-playlists-locales
type: feature
domains: [library, ui]
paths: [main/main.js, main/playlists.js, main/export.js, preload/app.js, renderer/library.js, renderer/automix.js, renderer/index.html, renderer/styles.css, docs/**, scripts/test-*.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 4d9e2f9736f87bf2f1b341ffce0c2e1c90d172a5ebc58ffe4adcc7df34b43ec6
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-playlists-locales

## Contexto

Hoy las playlists vienen solo de YouTube Music: **Importadas** (copia de las del usuario, de solo lectura) y la cola de AutoMix. No se pueden crear listas propias, ni **sacar** pistas de una lista ni **ponerlas** en otra. Alejandro quiere más opciones para manejar música: crear playlists locales, añadir y quitar pistas desde cualquier fuente, ordenarlas y sacarlas a otros programas.

## Requisitos

### REQ-1: Crear y gestionar playlists locales
THE SYSTEM SHALL permitir crear, renombrar, duplicar y borrar playlists locales (guardadas en el equipo), que aparecen en una sección propia de las fuentes de la librería con su número de pistas y su duración total.

### REQ-2: Poner pistas en una lista
WHEN el usuario arrastra pistas a una lista, usa «Añadir a playlist…» en el menú de la fila, o pulsa un atajo sobre la selección THE SYSTEM SHALL añadirlas (de cualquier fuente: búsqueda, local, Me gusta, importadas, analizadas, cola) sin duplicados en la misma lista salvo que el usuario lo pida.

### REQ-3: Sacar pistas de una lista
WHEN el usuario quita pistas de una playlist local THE SYSTEM SHALL quitarlas de esa lista sin borrar el archivo ni las demás listas, y SHALL permitir deshacer.

### REQ-4: Selección múltiple
THE SYSTEM SHALL permitir seleccionar varias pistas (Ctrl/Mayús + clic, seleccionar todo) y aplicar a la vez añadir a lista, quitar de lista, añadir a la cola de AutoMix y analizar.

### REQ-5: Ordenar y reordenar
THE SYSTEM SHALL permitir ordenar una lista por título, artista, BPM, tonalidad, género o duración y reordenarla a mano arrastrando, guardando el orden elegido.

### REQ-6: Listas inteligentes
THE SYSTEM SHALL permitir crear una lista inteligente a partir de filtros guardados (BPM, tonalidad, género, solo analizadas, solo con stems) que se actualiza sola.

### REQ-7: Importar y exportar
THE SYSTEM SHALL poder guardar una playlist de YouTube Music importada como lista local editable, y exportar cualquier lista local con los formatos de exportación existentes (Rekordbox XML, Traktor, M3U, CSV) y también a la cola de AutoMix.

### REQ-8: Datos a salvo
THE SYSTEM SHALL guardar las playlists de forma atómica en `userData`, tolerar un archivo dañado (conservando una copia) y no modificar nunca archivos de música del usuario.

## Fuera de alcance

- Crear o editar playlists en la cuenta de YouTube Music (requeriría escribir en su API).
- Compartir listas entre equipos.
