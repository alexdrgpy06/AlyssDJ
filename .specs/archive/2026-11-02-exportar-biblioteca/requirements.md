---
change: 2026-11-02-exportar-biblioteca
type: feature
domains: [library]
paths: [main/export.js, main/main.js, preload/app.js, renderer/library.js, renderer/index.html, renderer/styles.css, scripts/**, docs/**, README.md, .github/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 875c1df2d5aefaeff1ac526d65dab93a2945af1bfb2a3c093869b4f45990300c
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-exportar-biblioteca

## Contexto

Pedido original de Alejandro (roadmap tras v0.4.0): poder llevar lo analizado y las playlists a otro software de DJ. AlyssDJ ya guarda por pista un análisis en `cache/<id>.json` (título, artista, duración, BPM, offset de la rejilla, tonalidad y Camelot, ganancia, puntos de mezcla) y las playlists importadas de YouTube Music en `playlists.json`; las pistas guardadas tienen además un archivo de audio en disco.

Se eligen tres formatos: **M3U8** (lista simple, la entienden casi todos los reproductores y DJ), **CSV** (para hojas de cálculo) y **Rekordbox XML** (importable en Rekordbox y, a través de él, en otros programas; lleva BPM, tonalidad, rejilla y puntos de mezcla). **Traktor NML** queda fuera: su formato no está documentado oficialmente y no se puede verificar sin el programa.

Nada de esto sale del equipo: se escribe un archivo local que Alejandro elige. Las pistas que solo existen como stream de YouTube se exportan con sus datos pero sin ruta de audio.

## Requisitos

### REQ-1: Qué se exporta
WHEN Alejandro pide exportar THE SYSTEM SHALL ofrecer dos orígenes: «Todo lo analizado» y cada playlist importada.
THE SYSTEM SHALL incluir, por pista, título, artista, duración, BPM, tonalidad (nombre y Camelot) y la ruta del archivo de audio si existe en el disco.
IF una pista no tiene análisis THEN THE SYSTEM SHALL exportarla igualmente con título, artista y duración, y los campos de análisis vacíos.

### REQ-2: M3U8 y CSV
WHEN el formato es M3U8 THE SYSTEM SHALL escribir una lista extendida en UTF-8 (`#EXTM3U`, `#EXTINF` con duración y «artista - título», y la ruta del archivo).
WHEN el formato es CSV THE SYSTEM SHALL escribir UTF-8 con cabecera y las columnas título, artista, duración, BPM, tonalidad, Camelot, ruta e id, escapando comas, comillas y saltos de línea.
IF una pista no tiene archivo de audio THEN THE SYSTEM SHALL omitirla del M3U8 (no se puede reproducir) y dejar la ruta vacía en el CSV.

### REQ-3: Rekordbox XML
WHEN el formato es Rekordbox XML THE SYSTEM SHALL escribir un `DJ_PLAYLISTS` válido con `COLLECTION` (una `TRACK` por pista con nombre, artista, duración, `AverageBpm`, `Tonality`, `Location` como URI `file://` y un `TEMPO` con el inicio de la rejilla y el BPM) y un nodo `PLAYLISTS` con la lista exportada.
THE SYSTEM SHALL escapar los caracteres especiales de XML y codificar las rutas como URI.
IF una pista no tiene archivo de audio THEN THE SYSTEM SHALL omitirla de este formato.
THE SYSTEM SHALL escribir los puntos de mezcla del análisis (`mixIn`, fin de la intro `introEnd` y comienzo de la salida `outroStart`) como marcas `POSITION_MARK` de la pista.

### REQ-4: Interfaz y resultado
THE SYSTEM SHALL ofrecer la exportación desde la vista Librería con un botón «Exportar» que abre un cuadro de guardado con el formato elegido y un nombre sugerido.
WHEN la exportación termina THE SYSTEM SHALL avisar con el número de pistas escritas y las omitidas por no tener audio.
IF no hay nada que exportar o falla la escritura THEN THE SYSTEM SHALL mostrar un mensaje claro y no dejar un archivo a medias (se escribe a un temporal y se renombra).

### REQ-5: Verificación sin ventana
THE SYSTEM SHALL tener pruebas que ejecuten en modo sin ventana: generación de cada formato desde datos fijos, ida y vuelta del CSV, validez de XML y del M3U8, y la interfaz con el cuadro de guardado sustituido.

## Fuera de alcance

- Traktor NML y otros formatos (Serato, Engine DJ).
- Importar desde otro programa.
- Copiar o convertir los archivos de audio.
- Exportar la forma de onda o las rejillas variables.
