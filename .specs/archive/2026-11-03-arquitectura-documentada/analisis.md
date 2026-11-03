# Análisis de arquitectura · 2026-11-03

Fuente: lectura del código en la rama `main` (v0.14.0) por tres exploraciones. No se ejecutó nada. Las cifras de líneas son aproximadas.

## Capas

| Capa | Carpeta | Contenido |
|---|---|---|
| Principal (CommonJS) | `main/` | Ventana, IPC, protocolo `app://`, análisis, biblioteca, stems, actualizador, ajustes |
| Preload | `preload/` | `app.js` (puente `window.ytdj`), `deck.js` (motor dentro de la vista de YouTube Music) |
| Compartido (UMD/ESM) | `shared/` | Análisis, FX, cadena DSP, motor de deck, scratch, DSP de stems |
| Interfaz (ESM sin bundler) | `renderer/` | 33 módulos, `index.html`, `styles.css` |

## Principales hallazgos

1. `renderer/app.js` (1 184 líneas) cablea AutoMix (`#amv-*`), la vista inmersiva (`#imm-*`), ajustes, login, REC, historial, vistas y divisores; debería repartirse en `automix-ui.js`, `immersive.js` y `settings.js` (el patrón ya existe en `update-ui.js` y `settings-ui.js`).
2. Persistencia dispersa: prefijos `alyssdj:`, `alyssdj.`, `alyssdj.fx.`, `ytdj:`; `STORE` se exporta en `views.js`, `splits.js` y `fxchain.js` pero lo leen y escriben `app.js` y `deck.js`.
3. Planificación de transiciones repartida entre `mixplan.js`, `recipes.js` y `fxcues.js`, con dos tolerancias de BPM (`bpmGap` 0,08 y `bpmCompatible` 0,06).
4. La compacidad del layout se decide en `layout.js`, en `ViewState.compact()` y en CSS (`body.am-compact`).
5. La previsualización está en tres módulos (`preview.js`, `mixpreview.js`, `mixeditor.js`).
6. `library.js` importa `fmtSize` de `stems.js`; la interfaz de stems se reparte entre `deck.js`, `library.js` y `app.js`.
7. Cada deck tiene su propio `AudioContext` y no hay bus maestro: el fader efectivo es `f² · crossfader · masterGain`, calculado en `renderer/deck.js`.
8. QA: ~38 scripts de prueba y 25 autopruebas; ninguna compara capturas con una referencia; ocho PNG sin referenciar; el script de capturas de `docs/` no corre en CI; `test-orden.js` y otros no están en CI.
9. SDD: 9 dominios; faltan fx, stems, sampler/MIDI, jog, géneros, exportación, actualizador y ajustes; `video` apunta a archivos inexistentes; `install` y `platform` repiten `paths:`; `steering.md` sin reglas.

## Sin prueba de lógica directa

`main/analysis-worker.js`, `analyze-cli.js`, `decode.js`, `stems-worker.js`; `renderer/fxpad.js`, `mixeditor.js`, `mixpreview.js`; `shared/deck-engine.js`, `dsp-chain.js`, `scratch-worklet.js`; y de forma indirecta `app.js`, `deck.js`, `automix.js`, `library.js`, `sampler.js`, `midi.js`.
