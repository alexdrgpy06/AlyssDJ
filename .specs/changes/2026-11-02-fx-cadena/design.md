---
change: 2026-11-02-fx-cadena
status: approved
rev: 1
approved_rev: 1
approved_hash: 81bd88dbfc57ee73abb4265389c2fe5693e918c97a793984b43593d88a076390
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-fx-cadena

## Enfoque

El audio de un deck pasa por `shared/dsp-chain.js` (trim → EQ → filtro → **efectos** → fader/PFL/medidor). Ese mismo código corre en el renderer (archivo local) y en la vista oculta de YouTube Music (stream), y recibe todo por mensajes `{type:'mix', …}`. Por eso el estado de los efectos vive en el renderer (modelo puro) y viaja entero en cada mensaje `mix`.

### Modelo en el renderer (REQ-1, REQ-2, REQ-5)
- `renderer/fxchain.js` (puro, sin DOM ni audio): `FX_TYPES = ['echo','reverb','flanger','gate','phaser','crush','filter']`, `defaultChain()`, `clampSlot()` y la clase `FxChain`: 3 ranuras `{type,on,wet,p}`, ranura seleccionada, `set(i, patch)`, `ramp(i, {wet,p}, seconds, {now, schedule})` (rampa lineal con reloj inyectable, se cancela si llega otro `set` de esa ranura), `snapshot()` (lo que se envía), `toJSON()/fromJSON()` (persistencia con valores inválidos → por defecto) y un `onChange` que dispara `deck.pushMix()`.
- Valores por defecto: ranura 1 `{echo, off, wet .5, p .5}`; ranuras 2 y 3 `{reverb, off, .5, .5}` y `{filter, off, .5, .5}`.
- `Deck` guarda `this.fxc = new FxChain(saved)` y expone `fxSet(slot, patch)` y `fxRamp(slot, target, seconds)` (REQ-5). Cargar una pista no toca la cadena. Persistencia en `localStorage['alyssdj.fx.<A|B>']` si el ajuste `fxRemember` está activo.
- Mensaje `mix`: se sustituyen `fxType/fxWet/fxDiv` por `fx: [{type,on,wet,p}×3]`; `bpm` y la nueva `res` (0–1) acompañan. El BPM efectivo sigue refrescando el mensaje cuando cambia más de 0,2.

### Motor de audio (REQ-1, REQ-2, REQ-4)
- `shared/fx.js` se reescribe: `create(ctx)` → `{input, output, TYPES, set({slots, bpm}), get()}`. Tres ranuras en serie; cada una: `in → dry → out` y `in → [efecto activo] → wet → out`. Solo está montado el efecto del tipo elegido (no los siete a la vez): al cambiar de tipo se monta el nuevo, se hace fundido de 30 ms y se desmonta el anterior (se detienen sus osciladores). Con la ranura apagada o `wet = 0` el camino húmedo está silenciado y `dry = 1`: el audio pasa igual.
- `dry` según el tipo: Eco y Reverb conservan el seco (`1 − 0,15·wet`); Flanger, Gate, Phaser, Crush y Filtro lo sustituyen (`1 − wet`, el flanger y el gate como hoy `1 − 0,5·wet`).
- Efectos y P: **Eco** P → división {¼, ½, ¾, 1} beat (por tramos) y realimentación 0,35–0,65; **Reverb** dos convolvers (sala 0,8 s y 3 s) mezclados por P (tamaño); impulsos generados una vez por contexto y compartidos; **Flanger** y **Phaser** P → periodo del LFO {16, 8, 4, 2, 1} beats sincronizado al BPM; **Gate** P → {1, ½, ¼} beat por ciclo; **Crush** `WaveShaper` con curva de 12…3 bits (la curva solo se recalcula al cambiar el entero); **Filtro** pasa-bajos Q 6 con corte 120 Hz…18 kHz (logarítmico). Con P = 0,5 el eco, el gate y el flanger se comportan como hoy.
- Resonancia (REQ-4): `m.res` 0–1 → Q = 0,707 + res·7,3 (0,07 reproduce el Q 1,2 actual) para `lp` y `hp` cuando el barrido está activo; se aplica una ganancia compensadora `1/sqrt(Q/0,707)` en la salida del filtro para que no suba el nivel.

### Interfaz (REQ-3, REQ-5)
- El panel FX del deck (`.fxpane`) pasa a: tres filas de ranura (interruptor «1/2/3», selector de tipo, deslizadores de cantidad y P, y un radio que elige la seleccionada) y a la derecha un **XY pad** (`renderer/fxpad.js`, `role="slider"`, flechas ±0,02, Mayús ±0,1, doble clic = 0,5/0,5). X = cantidad, Y = P (arriba = más) de la ranura seleccionada.
- Instant FX: al apretar el pad la ranura se enciende; con `fxHold` (ajuste) se apaga al soltar, y recupera el estado anterior si ya estaba encendida.
- El mezclador del deck añade un knob **RES** junto a FILTER (`res` 0–1, doble clic = el valor por defecto de Ajustes).
- MIDI (`controls.js`): ids `deck<X>.fx<n>On`, `.fx<n>Wet`, `.fx<n>P`, `deck<X>.res`; `fxOn`, `fxWet` y `fx.<tipo>` existentes se conservan apuntando a la ranura 1.

### Ajustes (REQ-6)
Sección nueva **Efectos y filtros** (`data-pane="fx"`) con `fxHold` (true), `fxRemember` (true) y `filterRes` (0,07). Se añaden a `main/settings.js` (valores por defecto) y entran en el buscador y en «Restablecer sección» por el mecanismo existente. Cambiar `filterRes` actualiza el valor por defecto del knob y, en los decks cuyo RES no se ha movido, el valor aplicado.

## Contratos

```js
// renderer/fxchain.js
FX_TYPES; defaultChain(); clampSlot(slot)
new FxChain(saved?, { onChange })
chain.set(i, { type?, on?, wet?, p? }); chain.select(i); chain.selected
chain.ramp(i, { wet?, p? }, seconds, { now, schedule })   // cancela la rampa previa de i
chain.snapshot()  // → [{type,on,wet,p} × 3]; chain.toJSON()/fromJSON()
// shared/fx.js
Fx.create(ctx).set({ slots: [{type,on,wet,p}×3], bpm })
// mensaje mix
{ type:'mix', …, fx:[…3], bpm, res }
```

## Visual Spec

- Panel FX: ranuras de 24 px de alto con el mismo estilo de controles (`--ctl-h`), tipo en `select`, deslizadores finos con `aria-label` «Cantidad ranura n» / «P ranura n»; la ranura seleccionada con borde neutro `--sel` (no cian/rosa, que son de deck).
- XY pad: cuadrado de 76–88 px, fondo `--inset`, cuadrícula tenue, cruz y punto en el color del deck; foco visible.
- Tras mantener el pad, la ranura vuelve a su estado (modo «mantener»).
- El panel cabe en las alturas de los bancos actuales a 1366×768 sin desbordar; si no cabe en el modo compacto, el pad se oculta y quedan las ranuras (nunca desborda).

## Amendments
