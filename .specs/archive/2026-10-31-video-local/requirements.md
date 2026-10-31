---
change: 2026-10-31-video-local
type: feature
domains: [video, library]
paths: [docs/**, main/main.js, main/settings.js, preload/video-window.js, renderer/localvideo.js, renderer/video.html, renderer/video.js, scripts/video-live-selftest.js, scripts/video-local-selftest.js, main/ytm-library.js, main/analyzer.js, main/main.js, main/ytdlp.js, main/library-save.js, main/analyzer.js, main/ytm-library.js, preload/**, renderer/deck.js, renderer/app.js, renderer/video.html, renderer/video.js, renderer/index.html, renderer/styles.css, scripts/test-video-local.js]
commits: [81614fb, 9686331, 0067b34]
status: approved
rev: 1
approved_rev: 1
approved_hash: 3cd4919a0fb72332342ebd0794a9be76d891bd34887c555a956c7d2e4e61e183
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-video-local

## Contexto
La vista de video muestra el reproductor de YouTube Music del stream. Cuando una pista se reproduce en modo local (guardada, AutoMix, archivo), ese reproductor está pausado y la vista de video queda vacía o con la portada. Se quiere guardar el video de las pistas que tienen video de verdad y usarlo en la vista de video.

## Requisitos
### REQ-1: Detectar si hay video real
WHEN se guarda una pista de YouTube THE SYSTEM SHALL determinar si es un video musical (tipo OMV/UGC) o solo audio con portada (tipo ATV) usando YouTube Music.
### REQ-2: Descargar el video
WHEN la pista tiene video real y se guarda en la librería THE SYSTEM SHALL descargar también su video (sin audio, hasta 1080p, mp4) junto al audio, con el mismo nombre base.
IF la descarga del video falla THEN THE SYSTEM SHALL conservar el audio guardado y marcar la pista como «sin video».
### REQ-3: Usar el video en modo local
WHILE un deck reproduce una pista local con video guardado THE SYSTEM SHALL mostrarlo en la ventana de video y en la miniatura del deck, sincronizado con el audio (posición, pausa y velocidad) con corrección de deriva superior a 80 ms.
### REQ-4: Solo cuando hay video real
WHILE la pista no tiene video real THE SYSTEM SHALL mostrar su portada, como hoy, y no descargar video.
### REQ-5: Control del usuario
THE SYSTEM SHALL ofrecer un ajuste «Guardar video de las pistas que lo tengan» (activado por defecto) y limitar la calidad máxima (720p/1080p).

## Fuera de alcance
Video para archivos locales sin origen en YouTube, efectos de video y pantalla externa distinta de la ventana de video actual.
