---
change: 2026-10-31-arreglos-bot-y-pista-equivocada
type: fix
domains: [library, video]
paths: [main/ytdlp.js, preload/deck.js, scripts/**, .github/**, renderer/**, main/settings.js, docs/**, README.md]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: fca350b590b362cdde04310a7fed6ac5a93a217d6f5b40f7ff2dd81b376d9dd7
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-arreglos-bot-y-pista-equivocada

## Contexto

Dos fallos vistos en uso real: (1) yt-dlp falla de repente con «Sign in to confirm you're not a bot» y la app sigue lanzando descargas, lo que lo alarga; (2) un deck suena una canción (NSYNC) pero muestra otra (Ramones): con «Preferir el video musical» activo, la protección que vuelve a la pista del deck cuando YouTube Music avanza solo (autoplay) estaba desactivada; (3) el video dentro del plato da muy mal rendimiento.

## Requisitos

### REQ-1: Rechazo de YouTube por bot
WHEN yt-dlp falla porque YouTube pide confirmar que no es un bot THE SYSTEM SHALL mostrar un mensaje claro (sigue sonando por streaming; opción de cookies del navegador en Ajustes) en vez del texto crudo.
WHILE dure la pausa de 10 minutos tras ese rechazo THE SYSTEM SHALL no lanzar nuevas descargas de yt-dlp (audio, librería ni video) y fallarlas de inmediato con el mismo mensaje.

### REQ-2: El deck suena la pista que muestra
WHILE el stream de un deck reproduce una pista distinta de la cargada THE SYSTEM SHALL volver a la pista del deck, también con «Preferir el video musical» activo.
WHEN el propio deck pide la versión en video THE SYSTEM SHALL aceptar el cambio a esa versión una sola vez y solo durante los 8 s siguientes.

### REQ-3: Sin video en el plato
THE SYSTEM SHALL mostrar solo la portada en el centro del plato de cada deck, sin reproducir video ni capturar fotogramas del stream, y SHALL ofrecer el video únicamente en la ventana de video (botón «Video», botón del plato y doble clic) y en la vista de video de AutoMix.
WHILE la vista de video de AutoMix no esté visible THE SYSTEM SHALL no capturar fotogramas de los streams.

## Fuera de alcance

- Reintentar con otros clientes de yt-dlp o resolver el bot-check automáticamente.
