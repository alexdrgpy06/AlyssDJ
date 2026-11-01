---
change: 2026-11-01-automix-modo-salida
status: approved
rev: 1
approved_rev: 1
approved_hash: 520fe0e88b76829a5cfac16ca3eb147d08f1b4fb2d1d0ee879de393cc5164ace
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Design · 2026-11-01-automix-modo-salida

## Enfoque

Todo es lógica de AutoMix en el renderer más controles nuevos; no cambian el audio, el análisis ni la cola de análisis. El plan de la transición sigue en una función pura (`planTransition`), que gana un parámetro de modo y un ayudante para la duración; la cola gana dos operaciones.

### Modo de salida (REQ-1, REQ-2)
`renderer/mixplan.js`:

```
EXIT_MODES = ['optimal', 'intro-outro', 'outro-start', 'end']
introOutroSeconds({ outroLen, introLen, fallback, nextOutroGap }) → segundos
  - candidatos = [outroLen, introLen] que sean > 0
  - base = menor de los candidatos; si no hay ninguno, `fallback` (la duración elegida)
  - si nextOutroGap > 0 (distancia de la entrada al outro de la propia entrante), base = min(base, nextOutroGap)
  - resultado acotado a [4, 48]
planTransition(cur, next, { len, exitMode, optimal /* heredado */, pos })
  mode = exitMode ?? (optimal === false ? 'end' : 'optimal')
```
- `edited` (puntos de salida editados por el usuario) sigue mandando en todos los modos salvo que no haya candidatos válidos por delante, como hoy.
- `end`: `endPlan()` actual. `optimal`: recorrido actual de `cur.mix.mixOut`.
- `outro-start` e `intro-outro`: único candidato `{ t: cur.mix.outroStart, kind: 'outro' }`; si falta `outroStart`, no hay BPM, el outro ya pasó (`t < pos - 0.25`) o no caben 8 beats, se usa `endPlan()` y se añade el aviso `sin outro marcado: sale al final`.
- En `intro-outro` la duración base es `introOutroSeconds({ outroLen: dur - outroStart, introLen: next.mix.introEnd - enterAt, fallback: len, nextOutroGap: next.mix.outroStart - enterAt })`; la regla de salto de BPM (filtro, ×1.5 hasta 48 s) se aplica sobre esa base. En `outro-start` la base es `len`.
- El plan devuelto incluye `mode` además de `exitAt`, `kind`, `seconds`, `warnings`.

`renderer/automix.js`: el ajuste pasa a `cfg.exitMode`. Un getter `exitMode()` devuelve `cfg.exitMode` o, si falta, deriva del ajuste heredado (`optimalPoints === false` → `end`, en otro caso `optimal`); así el ajuste guardado antes se traduce sin migrar el almacenamiento y las pruebas que usan `optimalPoints` siguen valiendo. `makePlan` pasa `exitMode` (con `quick` usa `end`, como hoy). `snapshot()` expone `exitMode`. Estado de la barra: con un plan listo se añade «· dura N s» a «AutoMix activo» y a «Mezclando en …».

### Saltar siguiente y barajar (REQ-3, REQ-4)
`AutoMix`:
- `skipNext()`: si `!on`, hay transición o `queue.length < 2` devuelve `false`; si no, quita `queue[0]` (la deja fuera de `pinned`), pone `note = «Saltada: <título>»`, avisa con toast y emite; el bucle de preparación ya recarga el deck libre cuando `queue[0]` cambia.
- `shuffle(rng = Math.random)`: guarda `undoStack` con la cola actual; fijas = `pinned` ∪ {la cabeza si ya se está preparando (`prep.state` en `download|analyze|ready`) o está cargada en el deck libre}; mezcla con Fisher–Yates solo los huecos libres, sin mover las fijas. Si `cfg.smartOrder` está activo lo apaga con `setCfg({ smartOrder: false })` y lo dice en `note`. Devuelve `true` si cambió el orden. «Deshacer» usa el `undoStack` existente (`undoReorder`).
- `snapshot()` añade `canSkip` (`on && !trans && queue.length >= 2`) y `canShuffle` (`queue.length >= 2`).

### Interfaz
- `index.html`: en el grupo Transición el interruptor `#amv-points` se sustituye por `<select id="amv-exit">` «Salir» con las cuatro opciones; en el grupo Cola se añaden `#amv-skip` («Saltar siguiente») y `#amv-shuffle` («Barajar») junto a Reorganizar y Deshacer; en la vista Automix, `#imm-skip`.
- `app.js`: `bindAutoMix` conecta `amv-exit` (`setCfg({ exitMode })`), `amv-skip`, `amv-shuffle` e `imm-skip`; `renderAutoMix` y `renderImmersive` refrescan el valor del selector y el estado deshabilitado.

## Visual Spec

- El selector «Salir» usa el estilo de selector existente (`select`, 28 px) con la etiqueta a la izquierda como «Duración»; las cuatro opciones llevan una explicación corta en `title`.
- Los botones nuevos son `btn sm` / `btn ghost sm` como los del grupo Cola; «Saltar siguiente» lleva el icono `i-skip`.
- Sin animaciones nuevas.

## Amendments
