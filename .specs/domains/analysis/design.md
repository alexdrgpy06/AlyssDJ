---
domain: analysis
paths: [main/settings.js, main/analyzer.js, main/ytdlp.js, main/tools.js, renderer/index.html, renderer/app.js, docs/**]
last_change: 2026-11-01-sin-video-fuentes-y-cola-analisis
---
# analysis · design

## Cookies solo para el streaming

`ytdlp.cookieArgs` devuelve `[]` para `none` y `app` (los ajustes antiguos se migran); `ytdlp.runtime` pasa `--js-runtimes` con Node del sistema o Electron como Node; `withFormatRetry` aplica el reintento.

## Estructura y tempo

`shared/structure.js` calcula la energía por beat (banda < 2 kHz) y por frase y deriva `introEnd`, `outroStart`, `mixIn` y `mixOut`; `analysis.mix` y `version: 2` se guardan con el análisis; `tempo()` afina cada candidato 3:2 y 2:1 y elige por la energía grave.

## Backlog persistente

`main/analysis-backlog.js` (`Backlog`) guarda `userData/analysis-queue.json` (escritura atómica con retardo) con listas e ítems (`queued|running|done|error`), entrega de a uno al `Analyzer` solo cuando está libre y `!botBlocked()`, escucha sus eventos y notifica por `backlog:event` (máx. cada 250 ms). IPC `backlog:add|state|pause|resume|cancel|retry|clear-done|priority`.
