---
change: 2026-10-31-arreglos-bot-y-pista-equivocada
status: approved
rev: 1
approved_rev: 1
approved_hash: 49db3f6e58cb61622190be1d03e60f8ad5397c41c81e7f334bcd3c7674413772
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-arreglos-bot-y-pista-equivocada

## Enfoque

`main/ytdlp.js`: las tres funciones de descarga se envuelven con `guarded`: detectan el texto del bot-check (`isBotError`), guardan `botUntil = ahora + 10 min` y rechazan con `BOT_ERROR`; en pausa rechazan sin lanzar el proceso. `preload/deck.js`: al pulsar el botón de video se abre una ventana de 8 s (`videoSwitchUntil`); solo en ella (y una vez, `videoAltId`) se acepta un `video_id` distinto del esperado; cualquier otro cambio se revierte como sin «preferir video».

Plato: se eliminan el `<video>` y la imagen de fotogramas del plato, el `LocalVideo` del deck y el ajuste `miniVideo`; el deck sigue resolviendo `videoSrc`/`videoKey` (los usa la ventana de video y la vista de AutoMix). `Deck.setFrames(on)` pide los fotogramas del stream solo mientras `body.am-stage` está activo.

## Contratos

`ytdlp.isBotError(msg)`, `botBlocked(now)`, `resetBot()`, `BOT_ERROR`, `BOT_COOLDOWN_MS = 600000`. Pruebas: `scripts/test-bot-check.js`.

## Visual Spec

Sin cambios de interfaz: el mensaje sale por el aviso de error existente.

## Domain deltas
### library
#### ADDED spec: Pausa ante el bot-check de YouTube
WHEN yt-dlp falla porque YouTube pide confirmar que no es un bot THE SYSTEM SHALL mostrar un mensaje claro y no lanzar nuevas descargas durante 10 minutos.
### video
#### ADDED spec: Sin video en el plato y pista correcta en el stream
THE SYSTEM SHALL mostrar solo la portada en el plato y ofrecer el video en la ventana de video y en la vista de AutoMix; WHILE el stream reproduce una pista distinta de la cargada THE SYSTEM SHALL volver a la del deck, salvo el cambio a la versión en video pedido por el propio deck (una vez, 8 s).

## Amendments
