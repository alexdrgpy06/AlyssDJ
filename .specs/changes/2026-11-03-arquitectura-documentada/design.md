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
