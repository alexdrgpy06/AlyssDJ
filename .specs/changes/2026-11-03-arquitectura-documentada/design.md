---
change: 2026-11-03-arquitectura-documentada
status: approved
rev: 1
approved_rev: 1
approved_hash: 231c348bf825085773b64a9c55a5dc2fe7f5bf5d2d5d640d11630581ce914847
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Design · 2026-11-03-arquitectura-documentada

## Enfoque

La documentación se apoya en un **registro único legible por máquina** (`docs/arquitectura/modulos.json`) y se escribe a mano solo lo que una máquina no puede deducir (qué *debe* hacer cada pieza). Las pruebas leen el registro, así que la documentación no puede divergir en silencio.

### Estructura de `docs/arquitectura/`

| Archivo | Contenido | Requisito |
|---|---|---|
| `README.md` | Índice, leyenda y diagrama de capas (Mermaid) | REQ-1 |
| `01-main.md` | Un apartado por módulo de `main/`: responsabilidad, API, dependencias, usado por, dónde debe vivir | REQ-1, REQ-2 |
| `02-shared-y-preload.md` | Igual para `shared/` y `preload/`; camino del audio de un deck | REQ-1, REQ-2, REQ-4 |
| `03-renderer.md` | Igual para `renderer/`; módulos duplicados o mal situados | REQ-1, REQ-2 |
| `04-vistas-y-componentes.md` | 4 vistas, plantilla de deck, mezclador, librería, panel de AutoMix, ajustes, diálogos: estructura, IDs, estado, eventos | REQ-3 |
| `05-ipc-y-persistencia.md` | Tabla canal → manejador → llamador, rutas `app://`, claves de `localStorage` y `userData` con su dueño | REQ-4 |
| `06-qa.md` | Matriz componente × (lógica, visual, QA) con huecos marcados | REQ-5 |
| `07-deuda.md` | Desviaciones priorizadas (impacto, esfuerzo, cambio SDD que la resolvería) | REQ-9 |
| `modulos.json` | Registro máquina (ver contrato) | REQ-8 |
| `referencias/*.png` | Capturas de referencia aprobadas | REQ-6 |

### Comprobación visual (REQ-6)
`scripts/visual-check.js` lanza la app en silencio (`scripts/headless.js`, `YTDJ_SELFTEST`, volumen maestro 0) con una autoprueba que captura vistas fijas a 1280×720 (Mezcla, Librería, Automix, Ondas, deck con stems, ajustes, menú del deck cuando exista) con audio de demostración y datos deterministas. La comparación se hace dentro de Electron (`nativeImage.toBitmap()`), sin dependencias nuevas: porcentaje de píxeles con diferencia por canal > 8/255; falla si supera 0,5 % por captura. `--approve <nombre>` copia la captura actual a `referencias/`. En CI solo se compara en Linux (las otras plataformas renderizan texto distinto); los demás sistemas generan las capturas como artefacto.

### Pruebas de la documentación (REQ-8)
`scripts/test-arquitectura.js` (modos `registry`, `ipc`, `docs`):
- `registry`: cada `.js` de `main/`, `shared/`, `preload/`, `renderer/` está en `modulos.json`; ningún módulo del registro apunta a un archivo inexistente; las dependencias declaradas coinciden con los `require`/`import` reales.
- `ipc`: cada `ipcMain.handle/on` de `main/main.js` está en `05-ipc-y-persistencia.md`.
- `docs`: cada archivo de `docs/arquitectura` existe y cita solo archivos existentes.

### Dominios SDD (REQ-7)
Se crean `fx`, `stems`, `sampler-midi`, `jog`, `genres`, `export`, `updater` y `settings` con spec y design al archivar este cambio (`## Domain deltas`, `ADDED`); se corrigen los `paths:` de `video`, `install` y `platform`. Cada dominio nuevo referencia su módulo del registro.

## Contratos

`modulos.json`:

```json
{
  "renderer/automix.js": {
    "capa": "renderer",
    "dominio": "automix",
    "responsabilidad": "Motor de AutoMix: cola, transiciones, ajuste de tempo y movimientos de FX",
    "api": ["AutoMix"],
    "depende": ["renderer/mixplan.js", "renderer/recipes.js", "renderer/fxcues.js"],
    "dom": [],
    "persiste": ["localStorage:alyssdj:automix"],
    "debeVivir": "renderer/automix.js",
    "qa": { "logica": "test-automix.js", "visual": "visual-check:automix", "arranque": "test-salida.js ui" }
  }
}
```

`qa.*` puede ser `null` (hueco explícito, listado en `06-qa.md`). `debeVivir` distingue lo que hoy está en otro sitio (por ejemplo, el cableado de `#amv-*` de `app.js`).

## Visual Spec

No cambia la interfaz de la aplicación. La única salida visual son las capturas de referencia: 1280×720, tema oscuro, audio de demostración, reloj fijo (sin animaciones: movimiento reducido activado) y datos deterministas.

## Amendments

## Domain deltas
### fx
#### ADDED spec: Efectos por deck
THE SYSTEM SHALL ofrecer a cada deck tres ranuras de efecto en serie (shared/fx.js, renderer/fxchain.js, fxpanel.js, fxpresets.js, fxpad.js, fxcues.js) cuyo modelo es puro y se prueba sin audio; WHEN una ranura está apagada THE SYSTEM SHALL no montar sus nodos.
#### ADDED design: Módulos del dominio
`shared/fx.js` (constructores Web Audio y `loop`), `renderer/fxchain.js` (modelo), `renderer/fxpanel.js` y `fxpad.js` (interfaz), `renderer/fxpresets.js` (presets en `alyssdj.fxpresets`), `renderer/fxcues.js` (cues musicales para AutoMix). Detalle en docs/arquitectura/02-shared-y-preload.md y 03-renderer.md.
### stems
#### ADDED spec: Separación de stems
THE SYSTEM SHALL separar una pista local en voz, batería, bajo y resto con HTDemucs (ONNX) en un proceso hijo de baja prioridad, eligiendo GPU o CPU según un sondeo cacheado, y mostrar el estado en la interfaz sin bloquear la mezcla.
#### ADDED design: Módulos del dominio
`main/stems.js` (almacén y cola), `main/stems-worker.js` (proceso hijo), `main/stems-device.js` (selector de dispositivo), `shared/stems-dsp.js` (pre y posproceso) y `renderer/stems.js` (estado en la interfaz). Detalle en docs/arquitectura/01-main.md.
### sampler-midi
#### ADDED spec: Sampler y controladoras MIDI
THE SYSTEM SHALL ofrecer un sampler de ocho pads (sonidos de fábrica o propios) y aprendizaje MIDI que enlaza un control físico con cualquier control registrado, sin depender de la pantalla.
#### ADDED design: Módulos del dominio
`renderer/sampler.js`, `renderer/midi.js` y `renderer/controls.js` (registro común de controles que usan la interfaz, el teclado y MIDI).
### jog
#### ADDED spec: Jog y scratch
WHEN el usuario arrastra el plato de un deck cargado con archivo local THE SYSTEM SHALL mover la posición con la velocidad del gesto, con núcleo de lectura fraccionaria probado sin audio.
#### ADDED design: Módulos del dominio
`shared/scratch-math.js` (lectura de buffer), `shared/scratch-worklet.js` (AudioWorklet) y `shared/scratch.js` (controlador en el hilo principal).
### genres
#### ADDED spec: Géneros por pista
THE SYSTEM SHALL guardar etiquetas de género de texto libre por pista, aparte del análisis, y permitir filtrar la librería por ellas.
#### ADDED design: Módulos del dominio
`main/genres.js` (almacén en `userData/genres.json`) y `renderer/genres.js` (mapa id → etiquetas en la interfaz).
### export
#### ADDED spec: Exportar la librería
WHEN el usuario exporta una lista THE SYSTEM SHALL escribir M3U8, CSV o Rekordbox XML con lógica pura y sin Electron.
#### ADDED design: Módulos del dominio
`main/export.js` (formatos) y el canal `lib:export` de `main/main.js`.
### updater
#### ADDED spec: Actualizaciones
THE SYSTEM SHALL consultar solo la API pública de releases de GitHub, avisar de una versión nueva sin interrumpir la reproducción y permitir descargarla, omitirla o posponerla.
#### ADDED design: Módulos del dominio
`main/updater.js` (comprobación y estado) y `renderer/update-ui.js` (aviso en la barra superior).
### settings
#### ADDED spec: Ajustes persistentes
THE SYSTEM SHALL guardar los ajustes en `userData/settings.json` con valores por defecto, ofrecerlos en un diálogo de siete páginas con búsqueda por texto y aplicar al instante lo que no necesite reinicio.
#### ADDED design: Módulos del dominio
`main/settings.js` (almacén y valores por defecto), `renderer/settings-ui.js` (búsqueda pura) y el diálogo `#settings` de `renderer/index.html`.
### ui
#### ADDED spec: Mapa de arquitectura mantenido por pruebas
THE SYSTEM SHALL mantener en docs/arquitectura un registro por módulo (modulos.json) y documentos generados, y fallar la integración continua si un módulo, canal IPC o cita de archivo diverge del código, y si una de las seis capturas de referencia cambia más del 0,5 % de sus píxeles.
#### ADDED design: Herramientas del mapa
`scripts/arquitectura-lib.js` (lectura del código), `arquitectura-gen.js` (escribe registro y documentos), `test-arquitectura.js` (registry, ipc, docs) y `visual-check.js` con `visual-check-selftest.js` (comparación dentro de Electron, `--approve` para aceptar un cambio intencionado).

## Amendments
### A1 · 2026-11-03
Cambio: `sdd archive` crea los dominios nuevos con los `paths:` de este cambio y solo suma a los de los dominios existentes; los `paths:` obsoletos de `video`, `install` y `platform` no se pueden recortar desde un cambio.
Motivo: «los archivos de dominio cambian solo con `sdd archive`». Tras archivar hay que revisar `sdd drift` y, si lista archivos sin cubrir, abrir un cambio retro que asigne los `paths:` correctos.
Afecta: REQ-7 (cobertura de dominios; la limpieza de rutas queda como seguimiento).
