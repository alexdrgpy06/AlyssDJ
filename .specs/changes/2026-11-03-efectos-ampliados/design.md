---
change: 2026-11-03-efectos-ampliados
status: approved
rev: 1
approved_rev: 1
approved_hash: 86c3d6adc84ca1ffbd45ceffddb2f7ef4f4485ccf0ab1b8c6b0e4cb6ca084ba8
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Design · 2026-11-03-efectos-ampliados

## Enfoque

Todo sigue la arquitectura actual: `renderer/fxchain.js` es el modelo puro (ranuras que viajan enteras en cada mensaje `mix`) y `shared/fx.js` el motor Web Audio, que monta el efecto de una ranura solo mientras está activa. Se añaden tipos, parámetros, presets, orden y rutas sin cambiar ese reparto.

**Tipos nuevos** (REQ-1), cada uno un constructor más en `BUILD` de `shared/fx.js` con nodos nativos, sin AudioWorklet ni código de terceros:
- `tape`, delay de cinta: retardo sincronizado al BPM con saturación suave (`WaveShaper` tanh) y filtro paso bajo dentro de la repetición, más un leve vaivén (wow) con LFO. P = realimentación.
- `reducer`, reductor: bits (como `crush`) más un paso bajo que baja con P: aproxima la reducción de frecuencia de muestreo sin worklet.
- `stutter`, beat-repeat: captura una porción (1, ½, ¼ o ⅛ de beat) en un retardo con realimentación casi 1 y la repite; un temporizador con anticipación la renueva cada compás. P = longitud.
- `brake`, frenazo de vinilo: un retardo cuyo tiempo crece en rampa baja el tono como un plato que se para; se rearma cada compás. P = rapidez del frenazo.
- `transformer`: corte rítmico por beats con patrón de pasos (3-3-2, 1-1-1-1…) generado con anticipación. P = patrón.
- `drive`: saturación con ganancia previa (P) y filtro de tono.
- `pitch`: desplazador de tono ligero (±12 semitonos) por dos retardos modulados con diente de sierra y ventana triangular. P = semitonos, con el cero en el centro.

**Parámetros** (REQ-2): cada ranura gana `d`, la división de beat (índice 0–4: 1, ½, ¼, ⅛, tresillo), que usan `echo`, `tape`, `stutter`, `transformer` y `gate`; el resto la ignora. `P_HINT` y las etiquetas del panel dicen qué mueve P en cada tipo.

**Presets** (REQ-3): `renderer/fxpresets.js` (puro) trae presets de fábrica («Eco largo», «Barrido de filtro», «Roll de redoble», «Frenazo», «Cinta sucia») y guarda los del usuario en `localStorage` (`alyssdj.fxpresets`), con guardar y borrar. Un preset es `{ type, wet, p, d }`; aplicarlo no enciende la ranura.

**Instant FX** (REQ-4): mantener una tecla (Z, X, C, ranuras 1–3 del deck con el foco) o el pad enciende la ranura con una rampa de `wet` de 30 ms y, al soltar, otra de 60 ms hasta 0 antes de apagarla, para que no haya chasquidos. El motor ya suaviza los parámetros; aquí la rampa evita el salto de montar el efecto con `wet` alto.

**Orden y rutas** (REQ-5): `FxChain.move(from, to)` reordena las ranuras (el motor aplica `slots[i]` a su i-ésima etapa en serie, así que reordenar los datos reordena la cadena). Cada ranura tiene `route`: `deck` (solo este) o `both` (se copia también a la misma ranura del otro deck). No hay un bus master común en el motor actual —cada deck lleva su ganancia y se suman al salir—, así que «ambos» sustituye al envío al master (amendment A1). La vista del orden es la fila de ranuras con flechas ◀ ▶.

**Calidad y CPU** (REQ-6, REQ-8): pruebas con `OfflineAudioContext`: sin NaN, pico ≤ 1,6 con `wet` 1 en todos los tipos, sin salto mayor que el de la señal seca al cambiar de tipo y coste de render por tipo por debajo del 5 % del tiempo real; apagado, `mounted()` es `null`, los osciladores se paran y los temporizadores se cancelan (`fx.stop()` opcional en cada constructor).

**AutoMix** (REQ-7): `fxcues.js` ofrece `brake` al final de una caída (receta «En la caída») cuando el nivel de efectos es *Marcado* y hay una ranura libre, con el mismo `fxm` que el eco y la reverb.

## Contratos

```
slot = { type, on, wet, p, d, route }      // d: 0..4, route: 'deck' | 'both'
FxChain.move(from, to) → slots reordenadas ; set(i, patch) acepta d y route
preset = { name, type, wet, p, d }         // fxpresets.list() → fábrica + usuario ; save(name, slot) ; remove(name)
BUILD[type](ctx) → { in, out, nodes, osc, setP(p, beat, t, d), stop?() }
```

## Visual Spec

- Selector de tipo con los 14 efectos agrupados (Espacio: eco, cinta, reverb · Modulación: flanger, phaser, pitch · Ritmo: gate, stutter, transformer · Color: crush, reducer, drive, filtro · Freno: brake).
- Bajo los deslizadores Wet y P, una fila con la división de beat (cinco botones segmentados, deshabilitados si el tipo no la usa) y el selector de presets con «Guardar» y «Borrar».
- Cada ranura con ◀ ▶ para mover y un conmutador de ruta «Deck / Ambos»; la fila de ranuras es la vista del orden de la cadena.
- Los botones mantienen ≥ 26 px de alto y se leen con el foco del teclado.

## Amendments

### A1 · 2026-11-03
REQ-5 pide asignar ranuras «a un deck, al master o a ambos». El motor no tiene un bus master común (cada deck aplica su ganancia y se suman al salir), así que la ruta `both` copia la ranura a la misma ranura del otro deck y sustituye al envío al master. Afecta a REQ-5.

### A2 · 2026-11-03
Las teclas de Instant FX son **E, R, T** (deck A) y **U, I, O** (deck B): Z y X ya son play y cue del deck A. Afecta a REQ-4.

### A3 · 2026-11-03
El desplazador `pitch` usa dos retardos modulados con una rampa exacta en un `AudioBufferSourceNode` (el diente de sierra de `OscillatorNode` llega limitado en banda y desvía el tono ~9 %). El empalme entre voces deja el tono final a ±12 % de la octava pedida; se prueba con el pico dominante. Afecta a REQ-1.

## Domain deltas
### audio
#### ADDED spec: Siete efectos nuevos con coste acotado
THE SYSTEM SHALL ofrecer, además de los siete efectos de siempre, cinta, reducer, stutter, frenazo, transformer, drive y pitch, sincronizados al BPM del deck cuando proceda, con división de beat elegible (1, ½, ¼, ⅛, tresillo) en eco, cinta, gate, stutter y transformer; WHEN una ranura está apagada o con cantidad 0 THE SYSTEM SHALL no montar sus nodos ni dejar temporizadores; THE SYSTEM SHALL mantener cada tipo sin NaN, con pico por debajo de 1,6 con cantidad 1, sin saltos al cambiar de tipo y por debajo del 5 % del tiempo real de CPU.
#### ADDED design: Constructores nuevos en shared/fx.js
`BUILD` gana `tape`, `reducer`, `stutter`, `brake`, `transformer`, `drive` y `pitch`; `loop(ctx, fn)` agenda por ciclo con anticipación (temporizador en tiempo real, todo de una vez con `OfflineAudioContext`); cada constructor puede devolver `stop()` que `dispose` llama; `setP(p, beat, t, d)` recibe la división.
### ui
#### ADDED spec: Presets, orden, ruta e Instant FX
THE SYSTEM SHALL permitir, desde el botón ⋯ del panel FX, elegir la división de beat, la ruta (este deck o ambos decks), mover la ranura antes o después y aplicar, guardar y borrar presets (siete de fábrica y hasta 40 propios); WHEN el usuario mantiene E, R, T, U, I u O THE SYSTEM SHALL aplicar la ranura 1–3 del deck A o B con una rampa de entrada de 30 ms y quitarla con otra de 60 ms al soltar, sin tocar una ranura que ya estaba encendida ni actuar al escribir en un campo de texto.
#### ADDED design: fxpresets, move, route y mirrorFx
`renderer/fxpresets.js` (`FxPresets`, `FACTORY`) guarda en `alyssdj.fxpresets`; `FxChain.move`, `d` y `route` en el modelo; `fxpanel.js` monta el popover `.fx-pop` y `hold(i, down)`; `Deck.mirrorFx` copia las ranuras con ruta `both` al otro deck.
### automix
#### ADDED spec: Frenazo en la caída
WHEN la receta es «En la caída», el nivel de efectos es «Marcado» y la transición dura al menos 8 s THE SYSTEM SHALL frenar la pista que sale en los últimos 4 pulsos usando una ranura libre; IF no hay ranura libre THEN THE SYSTEM SHALL omitirlo y anotarlo.
