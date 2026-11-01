---
change: 2026-11-01-rediseno-interfaz
status: approved
rev: 1
approved_rev: 1
approved_hash: cba0913efb8731e5030dbc944c6187bec650900b463088be35228f97cc24b224
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Design · 2026-11-01-rediseno-interfaz

## Enfoque

Rediseño por capas, de abajo arriba, sin tocar audio ni análisis: (1) quitar lo que sobra y arreglar la ventana de video; (2) sistema visual (tokens y componentes); (3) cada zona usando solo esos componentes; (4) pruebas, docs y capturas. El HTML y las clases que usan las pruebas y `deck.js`/`app.js` se conservan cuando es posible; lo que se mueve se mueve con su prueba.

### Video (REQ-1, REQ-2)
- Se borran `renderer/ministage.js`, `<section id="stage">`, `#amv-stage`, las reglas `.stage*`/`body.am-stage`, las teclas V, `[`, `]`, `Deck.setFrames`, el IPC `deck:frame` y `grabFrame` del preload, y `scripts/test-ministage.js`, `test-stage.js`, `stage-selftest.js`. Se mantiene `Deck.videoSrc/videoKey` (los usa la ventana de video). `localStorage['alyssdj.stage']` se ignora.
- Causa del NSYNC: `layoutVideo()` (main.js) hace visible la vista de YouTube Music de todo deck sin video local, aunque esté vacío o sea local sin video. Nuevo contrato: el renderer informa por deck el **medio** y main solo muestra la vista de streaming si el medio es `stream`.

### Contratos

```
video:deck-media  (renderer → main)  id: 'A'|'B',
  media: { kind: 'stream' }                         // pista de streaming cargada y lista
       | { kind: 'local', src: string }             // video local guardado de ESA pista
       | { kind: 'none', cover?: string, label: string }  // vacío o sin video
vwin:layout       (main → ventana de video)  { A: Tile|null, B: Tile|null }
  Tile = { x, y, width, height, src? , cover?, label? }
```
- `kind: 'stream'` solo si `source==='stream'`, hay `track` y el deck ya cargó esa pista (`expected` igual que el id cargado). En cualquier otro caso `none` con el texto «Sin pista» o «Sin video» y la portada si existe.
- `kind: 'none'` oculta la vista de streaming (`setVisible(false)`, `videoView off`) y `video.html` dibuja un fondo negro con portada atenuada y la leyenda.
- Compatibilidad: `video:deck-source` se mantiene como alias de `{kind:'local'|'none'}` mientras exista código que lo use; se elimina al terminar.

### Estructura (REQ-4, REQ-5)
```
┌ barra: [marca · sesión] ········ [AutoMix · Sampler · ● REC] ··· [MIDI · Video · ? · Ajustes] ┐
├ ondas A (cian) ─────────────────────────────────────────────────────────────────────────────┤
├ ondas B (rosa) ─────────────────────────────────────────────────────────────────────────────┤
├ consola ─ deck A ───────────┬─ mezclador ──────┬─ deck B ───────────┤
├ librería ─ fuentes │ barra de herramientas (búsqueda, acciones) │ tabla ───────────────────┤
```
- Barra: tres grupos separados por divisores; los botones de texto pasan a icono + etiqueta corta, el estado de herramientas (yt-dlp/ffmpeg) se mueve a Ajustes → Herramientas y solo aparece en la barra si falta algo.
- Cabecera de deck (patrón Mixxx/djay): portada 56 px a la izquierda; título y artista; fila de chips (fuente, estado de análisis); a la derecha BPM grande, tonalidad y pitch. Los tiempos pasan a la fila de la vista general. Igual en A y B (espejo horizontal solo del orden de columnas, no de la jerarquía).
- Mezclador: sin cambios funcionales; se alinea a la cuadrícula de 4 px, canales con etiqueta de color y VU junto al fader.
- Librería: `nav.tabs` pasa a `aside.sources` (columna de 168 px con icono + etiqueta + contador; 48 px solo iconos bajo 1100 px). `.tabs` deja de existir; el campo de búsqueda y las acciones por fuente pasan a `.lib-toolbar`. Los `data-tab` se conservan para no romper `library.show()`.
- AutoMix: `.am-controls` se divide en cuatro `<fieldset class="am-group">` con título. Los ids actuales (`amv-*`) se conservan.
- Ajustes: `<dialog id="settings">` con `nav.set-nav` a la izquierda y `section.set-pane[data-pane]` a la derecha; los `name=` de los campos no cambian, así que `settings.js` no cambia.

## Visual Spec

### Tokens
| Token | Valor |
|---|---|
| Espaciado | 4 · 8 · 12 · 16 · 24 · 32 (`--s-1`…`--s-6`) |
| Tipografía | 11 (etiquetas, mayúsculas con `.08em`) · 12 (secundario) · 13 (cuerpo) · 15 (títulos de pista) · 20 (títulos de panel) · 30 mono (BPM) |
| Radios | 4 (chips) · 6 (controles) · 10 (paneles) · 999 (píldoras y platos) |
| Elevación | 0 plano · 1 panel (`0 10px 30px #0008`) · 2 flotante (`0 18px 50px #000c`) |
| Superficies | las de la constitución (`#05070b` → `#181f2d`); sin degradados decorativos en paneles nuevos |
| Color | `--a` cian y `--b` rosa solo para identidad de deck; `--play` verde solo play/OK; `--cue` ámbar solo cue; `--warn`/`--err` estados. Acento de interfaz neutro (blanco azulado `#e9edf5` sobre `--raised-2`) para selección que no pertenece a un deck |
| Movimiento | 120 ms (estados), 200 ms (paneles), `ease`; todo bajo `@media (prefers-reduced-motion: reduce)` a 0 |

### Componentes
- **Botón**: primario (relleno acento del contexto), normal, fantasma, icono (28×28 mínimo). Altura 28 (32 en barra y diálogos). Estado foco: anillo 2 px `#8fd8ff`.
- **Segmentado** (`.seg`): un solo estilo; el elegido usa el acento del deck si está dentro de un deck y el acento neutro fuera.
- **Interruptor** (`.switch`) reemplaza los casilleros sueltos de AutoMix y Ajustes; etiqueta a la derecha, ayuda en `small`.
- **Deslizador**: pista 4 px, tirador 14 px, valor en `output` mono.
- **Estado vacío**: icono 24 px, frase corta, una acción.
- **Diálogo**: ancho 720 (ajustes) / 520 (resto), cabecera con título 20 px y cierre, pie con acciones a la derecha.

### Contraste y objetivos
Texto secundario `#9ba6b8` sobre `#0b0e14` = 7,6:1; mínimo `--faint` `#6d788b` solo para metadatos no esenciales (4,6:1 sobre `#05070b`). Objetivos de clic ≥ 28 px en consola y ≥ 32 px en barra y diálogos.

### Perfiles
`compact` (<1280×780): consola con una fila menos de pads; panel de fuentes en iconos. `normal`: como arriba. `wide` (≥1920): escala `--ui-scale` actual.

## Amendments
