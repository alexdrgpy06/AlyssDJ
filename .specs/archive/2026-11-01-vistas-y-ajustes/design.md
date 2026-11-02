---
change: 2026-11-01-vistas-y-ajustes
status: approved
rev: 1
approved_rev: 1
approved_hash: 6c34359af7131d5a8d85be077911ee5946834b202f8b52a78d207abea81f242a
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Design · 2026-11-01-vistas-y-ajustes

## Enfoque

Todo es interfaz del renderer; no se toca el audio ni el proceso principal salvo para guardar ajustes ya existentes.

### Divisores (REQ-1, REQ-2)
- Módulo puro `renderer/splits.js` (`SplitState`): por vista guarda `{ last: 'waves'|'lib', waves: px|null, lib: px|null }`. Métodos `drag(view, which, px, limits)`, `reset(view)`, `resetAll()`, `clamp`, `toJSON`. Los límites los calcula la interfaz según la altura de la ventana (ondas 90–45 % de la altura; librería 150 px–55 %).
- Dos grados de libertad, no tres: el divisor ondas/decks fija la altura de las **ondas** (la librería absorbe el resto); el divisor decks/librería fija la altura de la **librería** (las ondas absorben el resto). Manda el último que se arrastró; el otro valor se conserva pero no se aplica.
- Se aplican con variables CSS en `body` (`--split-waves`, `--split-lib`) y clases `data-split="waves|lib"`; las plantillas `grid-template-rows` de Mezcla y Librería usan la variable cuando existe y caen al valor actual si no. La consola (decks y mezclador) sigue con altura automática.
- Cada divisor es un `<div class="splitter" role="separator" tabindex="0" aria-orientation="horizontal">` dentro de `.waves` (borde inferior) y de `.library` (borde superior), posicionado en absoluto, con captura de puntero. Doble clic = `reset(view)`. Flechas = ±8 px, Mayús ±32 px.
- Persistencia: `localStorage['alyssdj.splits']` por vista (junto a `alyssdj.view`). Al aplicar se recorta a los límites sin reescribir el valor guardado; al cambiar el tamaño de la ventana se vuelve a aplicar.

### Ajustes (REQ-3, REQ-4)
- Secciones: General (diseño, ondas grandes, «Restablecer vistas», actualizaciones), Audio, Decks (rango de pitch, curva del crossfader), Librería y música, MIDI, Herramientas y cuenta. Las opciones que hoy están en «Herramientas» (actualizaciones, mantenimiento) pasan a General o a Herramientas y cuenta según su tema.
- Buscador `#set-search` sobre el menú: filtra las filas `label`/`h4` por texto (etiqueta + ayuda, sin tildes ni mayúsculas) con `settingsFilter(query, items)` (función pura en `renderer/settings-ui.js`). Con resultados se muestran las secciones que los contienen, agrupadas; sin resultados aparece `.empty` «Sin resultados» con botón «Limpiar».
- Guardado al cambiar: cada control dispara `change` → `saveSetting(name, value)` → `window.ytdj.settings.set({[name]: value})`; se confirma con un `role="status"` «Guardado» que se apaga a los 1,5 s. Si el IPC falla se restaura el valor anterior y se escribe el motivo junto al control. El guardado del evento `close` del diálogo desaparece (el botón queda «Listo»). Se conserva el efecto lateral que hoy tiene cada opción (`applyLayout`, `applyRouting`, `applyXf`, `setWaves`, `checkTools`).
- «Restablecer sección»: botón por sección con `confirm`; usa una tabla `SECTION_DEFAULTS` (nombres → valor por defecto, tomados de `main/settings.js` por IPC `settings:defaults`) y aplica solo esa sección.
- La última sección usada se guarda en memoria (no en disco) para la sesión.

## Contratos

```js
// renderer/splits.js
new SplitState(saved)            // saved: { [view]: {last, waves, lib} }
splits.get(view)                 // → { last, waves, lib }
splits.drag(view, which, px)     // which: 'waves' | 'lib'
splits.reset(view); splits.resetAll(); splits.toJSON()
clampSplit(which, px, innerHeight) // → px dentro de [min, max]
// renderer/settings-ui.js
settingsFilter(query, rows)      // rows: [{pane, text}] → { panes:Set, hits:[...] }
```
IPC nuevo: `settings:defaults` → objeto con los valores por defecto (los de `main/settings.js`).

## Visual Spec

- Divisor: 6 px de alto de zona de agarre sobre una línea de 1 px (`--line-2`); al pasar el ratón o con foco la línea sube a 3 px con el color neutro de selección (`--sel`), cursor `row-resize`; nunca usa cian/rosa (son de la identidad de deck).
- Mientras se arrastra se muestra la altura en px junto al puntero.
- Buscador: campo con icono de lupa arriba del menú de secciones, `type=search`, atajo `/` o Ctrl+F dentro del diálogo. Coincidencias resaltadas con `mark` de fondo neutro.
- Confirmación «Guardado»: texto pequeño `--ok` en la esquina del encabezado, sin desplazar el diseño.
- Contraste ≥ 4.5:1; foco visible en divisores y buscador; mínimo 1366×768 sin desbordes.

## Domain deltas
### ui
#### ADDED spec: Divisores de vistas
THE SYSTEM SHALL mostrar en Mezcla y Librería un divisor bajo las ondas y otro sobre la librería, arrastrables, con doble clic para restablecer y flechas (8 px; Mayús 32 px); el divisor de ondas fija su altura y el de librería la suya (manda el último movido, la zona contraria absorbe el resto), con mínimos de 90 px (ondas) y 150 px (librería) y sin desbordar la ventana; cada vista guarda su tamaño en `alyssdj.splits` y se recorta a la ventana sin perder el valor guardado.
#### ADDED spec: Ajustes por secciones con búsqueda
THE SYSTEM SHALL organizar Ajustes en General, Audio, Decks, Librería y música, MIDI y Herramientas y cuenta; ofrecer un buscador (/ o Ctrl+F; Esc limpia) que filtra por etiqueta y ayuda sin tildes ni mayúsculas y muestra «Sin resultados»; recordar la última sección durante la sesión.
#### ADDED spec: Guardado al cambiar y restablecer
WHEN el usuario cambia una opción THE SYSTEM SHALL guardarla al instante y mostrar «Guardado»; IF falla THEN restaura el control y explica el motivo; «Restablecer sección» (con confirmación) y «Restablecer vistas» devuelven sus valores por defecto.
#### ADDED design: SplitState y helpers de Ajustes
`renderer/splits.js` (`SplitState`, `clampSplit(which, px, inner, fixed)`), `renderer/settings-ui.js` (`settingsFilter`, `settingPatch`, `sectionDefaults`); IPC `settings:defaults`; `settings.set` escribe antes de actualizar la caché.

## Amendments

### A1 · 2026-11-02
Cambio: las coincidencias de la búsqueda no se resaltan con `mark`; se ocultan las opciones que no coinciden y se atenúan las secciones sin resultados.
Motivo: el filtrado ya deja visibles solo las coincidencias; el resaltado no aporta y complica el DOM de las etiquetas.
Afecta: REQ-3 (sin cambio de comportamiento).

### A2 · 2026-11-02
Cambio: el máximo de cada zona es lo que deja libre la barra y la consola sin quitar el mínimo a la otra zona (además del 45 % / 55 % de la ventana), calculado desde el DOM.
Motivo: con solo el porcentaje, ondas + consola + librería podían superar la ventana y desbordar.
Afecta: REQ-1 (límites por zona).

### A3 · 2026-11-02
Cambio: `settings.set` en el proceso principal escribe el archivo antes de actualizar la caché en memoria.
Motivo: con el guardado inmediato, un fallo de disco dejaba la memoria distinta del archivo; ahora el valor anterior se conserva.
Afecta: REQ-4 (reversión en error).
