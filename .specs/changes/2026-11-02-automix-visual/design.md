---
change: 2026-11-02-automix-visual
status: approved
rev: 1
approved_rev: 1
approved_hash: aca70641d82140a054701cf73d1d79b27dbd83491141835378301c9db9caa1de
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-automix-visual

## Enfoque

Un lienzo detrás de la portada de la vista inmersiva, dibujado por un módulo con una parte pura (qué anillos y con qué intensidad) y una parte con DOM (el bucle de dibujo). No hay datos nuevos ni IPC: se leen `d.st.level`, `d.effBpm()`, `d.pos()`, `d.analysis.offset`, `d.channelGain()` y `d.st.playing` de los dos decks, igual para local y stream.

### Modelo puro — `renderer/viz.js` (REQ-1, REQ-2, REQ-3, REQ-6)
- `beatPhase(pos, bpm, offset)` → fase 0–1 dentro del beat; `beatInBar(pos, bpm, offset)` → 0–3.
- `deckRings({ level, gain, bpm, pos, offset, playing, reduced })` → `{ intensity, pulse, rings: [{ r, a, w }] }`, con `r` en 0–1 (0 = borde de la portada, 1 = radio máximo).
  - `intensity = playing ? (0,25 + 0,75·min(1, level)) · min(1, gain) : 0`.
  - Con BPM: 4 anillos; el anillo k está en `r = (k + fase)/4`, con `a = intensity · (1 − r)^1,5` (el primero entra con `min(1, fase·6)`), `w` base 1 y, en el primer tiempo del compás, `w ×1,8` y `a ×1,3` decayendo con la fase. `pulse = exp(−5·fase) · min(1, level) · min(1, gain)` (solo si suena).
  - Sin BPM: un anillo en `r = 0,3 + 0,2·level` con `a = 0,5·intensity`; `pulse = 0`.
  - En pausa o sin pista: 3 anillos quietos en `r = 0,25 / 0,5 / 0,75` con `a = 0,12`; `pulse = 0`.
  - `reduced`: igual que en pausa pero con la intensidad real y `fase = 0`; `pulse = 0` (estático).
- `vizScene(decks, { reduced })` → un `deckRings` por deck con su color (`'A'`/`'B'`); en una transición los dos dibujan a la vez y la intensidad de cada uno ya lleva su `channelGain`, así el color pasa de uno al otro con el crossfader. `pulseOf(scene)` = el mayor `pulse`, para la portada.

### Dibujo y bucle — clase `Visualizer` (REQ-4, REQ-5, REQ-6)
- `new Visualizer({ canvas, cover, getDecks, enabled, reduced })`; el lienzo ocupa toda la vista inmersiva (`position:absolute; inset:0; pointer-events:none; aria-hidden`), ajustado al tamaño con `devicePixelRatio ≤ 1,5`.
- El centro es el de la portada (`getBoundingClientRect`) y el radio máximo `0,55·min(ancho, alto)`; `r_px = radioPortada + r·(radioMax − radioPortada)`. Cada anillo: trazo con el color del deck (variables `--a`/`--b`, leídas una vez), opacidad `a`, grosor `1,5·w` px, más un halo (gradiente radial) muy tenue por deck.
- El nivel se suaviza (`lvl = max(nivel, lvl·0,88)`) para que el pulso no parpadee.
- Bucle con `requestAnimationFrame` limitado a 30 fps (se salta el cuadro si pasaron < 33 ms). `shouldRun()` = `enabled && body.dataset.view === 'automix' && !document.hidden && !reducedMotion`. Cuando no se cumple, el bucle se detiene (no se vuelve a agendar). Se rearranca desde `renderImmersive`, `visibilitychange`, el botón y el cambio de vista.
- Movimiento reducido (`matchMedia('(prefers-reduced-motion: reduce)')`): sin bucle; se dibuja un cuadro estático al entrar en la vista, al redimensionar y en cada `renderImmersive`.
- La portada recibe `transform: scale(1 + 0,015·pulse)` (solo cuando está activo; se quita al apagar o parar).
- `drawFrame()` está expuesto para medirlo (REQ-5: < 8 ms de media a 1600×960).

### Control y persistencia (REQ-4)
Botón `#imm-viz` «Visual» (`aria-pressed`) en `.imm-controls`; usa `AutoMix.cfg.visual` (booleano, por defecto `true`, guardado en `alyssdj:automix`). Apagado: el lienzo se oculta (`hidden`), no se dibuja y la portada vuelve a escala 1.

## Contratos

```js
// renderer/viz.js
beatPhase(pos, bpm, offset); beatInBar(pos, bpm, offset)
deckRings({ level, gain, bpm, pos, offset, playing, reduced }) // → { intensity, pulse, rings: [{ r, a, w }] }
vizScene(decks, { reduced })                                   // → [{ id, ...deckRings }]
pulseOf(scene)
new Visualizer({ canvas, cover, getDecks, isOn }) .start() .stop() .refresh() .drawFrame()
```

## Visual Spec

- Anillos finos (1,5 px) con el color de cada deck y un halo tenue; nunca tapan texto ni controles (están detrás, con opacidad máxima ≈ 0,6).
- El botón «Visual» usa el estilo de los demás de `.imm-controls` (`.btn.ghost` con estado activo neutro `--sel`).
- Contraste del texto sobre el fondo ≥ 4,5:1 con los anillos al máximo; a 1366×768 la vista sigue sin desbordar.

## Domain deltas
### ui
#### ADDED spec: Visual de la vista Automix
THE SYSTEM SHALL dibujar en un lienzo detrás de la portada anillos que se expanden una vez por beat (con más fuerza en el primer tiempo del compás de 4), con el color del deck (A cian, B rosa), intensidad según el nivel de audio y la ganancia del canal, los dos decks a la vez en las transiciones, un anillo que respira sin BPM y anillos quietos y tenues en pausa; la portada escala hasta +1,5 % con el beat.
#### ADDED spec: Control, movimiento reducido y rendimiento
THE SYSTEM SHALL ofrecer el botón «Visual» (activado por defecto, recordado en `AutoMix.cfg.visual`), mostrar el visual estático con `prefers-reduced-motion`, dibujar a ≤ 30 fps solo con la vista Automix, la ventana y el visual activos, y no cambiar el audio.
#### ADDED design: viz.js
`renderer/viz.js` exporta `beatPhase`, `beatInBar`, `deckRings`, `vizScene`, `pulseOf` (puros) y `Visualizer` (bucle con rAF limitado, cuadro estático solo cuando cambia algo visible en movimiento reducido).

## Amendments

### A1 · 2026-11-02
Cambio: en movimiento reducido el cuadro estático se redibuja solo cuando cambia el tamaño, qué decks suenan o su ganancia (no en cada refresco de 400 ms).
Motivo: REQ-4 pide no consumir cuadros; redibujar en cada refresco lo incumplía.
Afecta: REQ-4.
