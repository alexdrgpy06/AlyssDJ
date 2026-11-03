# 07 · Deuda y desviaciones

Lo que el análisis de [modulos.json](modulos.json) y la [matriz de QA](06-qa.md) muestran fuera de lugar, ordenado por impacto. Cada punto dice qué pasa, cuánto cuesta arreglarlo y qué cambio SDD lo resolvería. Nada de esto es un error: la app funciona; son los sitios donde el siguiente cambio será más caro de lo necesario.

Impacto: **alto** = frena o hace peligroso cambiar; **medio** = encarece; **bajo** = molesta. Esfuerzo: S (horas), M (un día), L (varios).

| # | Desviación | Dónde | Impacto | Esfuerzo | Cambio SDD sugerido |
|---|---|---|---|---|---|
| 1 | `app.js` cablea toda la interfaz (1232 líneas): vistas, sesión, sampler, grabación, AutoMix, ajustes, atajos y MIDI en un solo archivo | [renderer/app.js](../../renderer/app.js) | alto | L | `dividir-app` (un archivo por vista; `app.js` solo arranca) |
| 2 | `deck.js` mezcla modelo (audio, cues, loops, tempo) con vista (DOM) en 1149 líneas | [renderer/deck.js](../../renderer/deck.js) | alto | L | `separar-deck` (modelo puro probable en Node + vista) |
| 3 | `main.js` registra 92 canales IPC y las ventanas en 705 líneas | [main/main.js](../../main/main.js) | medio | M | `ipc-por-dominio` (un `register(ipcMain)` por módulo) |
| 4 | `automix.js` junto a otros siete archivos `automix-*.js`: el motor (1030 líneas) sigue siendo grande | [renderer/automix.js](../../renderer/automix.js) | medio | M | `automix-motor-modular` |
| 5 | Sin prueba de lógica en Node para `deck-engine`, `dsp-chain`, `structure`, `knob`, `midi`, `sampler`, `waveform` (solo autopruebas dentro de Electron) | véase [06-qa.md](06-qa.md) | medio | M | `pruebas-de-audio-en-node` |
| 6 | `preload/app.js` expone todo en un objeto `window.api` plano que crece con cada función nueva; no hay contrato escrito por canal | [preload/app.js](../../preload/app.js) | medio | M | `contrato-ipc` (tipos y validación de argumentos) |
| 7 | Claves de `localStorage` repartidas por 15 módulos con prefijos distintos (`alyssdj:`, `alyssdj.`) | [05-ipc-y-persistencia.md](05-ipc-y-persistencia.md) | bajo | S | `claves-de-almacenamiento` (un registro único) |
| 8 | Nombres repetidos entre capas: `main/genres.js` y `renderer/genres.js`, `main/playlists.js` y `renderer/playlists.js` | [03-renderer.md](03-renderer.md) | bajo | S | renombrar a `*-store` / `*-ui` |
| 9 | La comprobación visual cubre solo Linux; macOS y Windows renderizan texto distinto | `scripts/visual-check.js` | bajo | M | `visual-multiplataforma` |
| 10 | Dominios SDD que no existían (fx, stems, sampler-midi, jog, genres, export, updater, settings) y `paths:` de `video`, `install` y `platform` desactualizados | `.specs/` | medio | S | resuelto en este cambio (tarea 1.8) |

## Cómo usar esta lista

Antes de abrir un cambio en un archivo marcado aquí, mira si el cambio sugerido lo desbloquea: tocar `app.js` o `deck.js` sin dividirlos aumenta la deuda. Cuando se resuelva un punto, bórralo de la tabla en el mismo cambio.
