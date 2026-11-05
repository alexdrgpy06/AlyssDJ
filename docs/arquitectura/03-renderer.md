# 03 · Interfaz (`renderer/`)

<!-- Generado por scripts/arquitectura-gen.js desde docs/arquitectura/modulos.json: no editar a mano (edita el registro y regenera). -->

Módulos que corren en la ventana: algunos son puros (sin DOM) y se prueban en Node; los que tocan el DOM se prueban dentro de Electron con autopruebas (`YTDJ_SELFTEST_MODULE`).

38 módulos.

### `renderer/app.js`

**Dominio:** ui · **Líneas:** 1271

Punto de entrada de la interfaz: crea los dos decks y el mezclador y cablea sesión, librería, AutoMix, sampler, grabación, vistas, ajustes, atajos y MIDI.

- **Depende de:** `renderer/automix-add.js`, `renderer/automix-compat.js`, `renderer/automix-entry.js`, `renderer/automix-origin.js`, `renderer/automix-profiles.js`, `renderer/automix-status.js`, `renderer/automix-timeline.js`, `renderer/automix.js`, `renderer/camelot.js`, `renderer/controls.js`, `renderer/deck.js`, `renderer/genres.js`, `renderer/knob.js`, `renderer/layout.js`, `renderer/library.js`, `renderer/midi.js`, `renderer/mixeditor.js`, `renderer/recipes.js`, `renderer/sampler.js`, `renderer/settings-ui.js`, `renderer/splits.js`, `renderer/stems.js`, `renderer/update-ui.js`, `renderer/views.js`, `renderer/viz.js`
- **Lo usan:** `renderer/index.html`
- **Guarda:** `localStorage:alyssdj:history`
- **Nota:** Cableado de todo: decks, mezclador, librería, AutoMix, ajustes y atajos en 1232 líneas; las vistas deberían tener un archivo cada una.
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-fxcues.js` · en la app `scripts/automix-claro-selftest.js`

### `renderer/automix-add.js`

**Dominio:** automix · **Líneas:** 147

Buscar y agregar desde la vista de AutoMix: resultados (YouTube Music + librería), sugeridas para continuar y su pintado.

| Exporta | Qué hace |
|---|---|
| `fmtPlays` | 856000000 → «856 M»; 135000 → «135 k»; 1200000000 → «1,2 B» |
| `AddPanel` | — |

<details><summary>Métodos con contrato (1)</summary>

| Método | Qué hace |
|---|---|
| `predicted(t)` | Posición que tendría si se agregara ahora (solo si ya está analizada). |

</details>

- **Depende de:** `renderer/camelot.js`, `renderer/mixplan.js`
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/automix-view-selftest.js`

### `renderer/automix-compat.js`

**Dominio:** automix · **Líneas:** 23

Compatibilidad de un elemento de la cola con el anterior: tres niveles y el motivo en palabras.

| Exporta | Qué hace |
|---|---|
| `LEVELS` | — |
| `compat` | prev/item: análisis ({ bpm, camelot, mix: { energy } }); item.cost opcional (edgeCost ya calculado); marks: { analyzed, file }. |

- **Depende de:** `renderer/camelot.js`, `renderer/mixplan.js`
- **Lo usan:** `renderer/app.js`, `renderer/automix.js`
- **Pruebas:** lógica `scripts/test-automix-claro.mjs`

### `renderer/automix-entry.js`

**Dominio:** automix · **Líneas:** 93

Tarjeta «SIGUE»: punto de entrada elegido para la pista que sigue (tiempo, compás y motivo) sobre una tira con la energía por frase. Arrastrar la línea (o ← → con el foco) elige otro compás y lo guarda como entrada editada de esa pista; «Auto» vuelve al cálculo automático.

| Exporta | Qué hace |
|---|---|
| `EntryStrip` | — |

<details><summary>Métodos con contrato (2)</summary>

| Método | Qué hace |
|---|---|
| `render(e, color)` | `e` es `state().entry` y `color` el del deck que entra. |
| `snap(t)` | Compás más cercano a `t` (rejilla de la pista), dentro de la pista. |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica **sin prueba**

### `renderer/automix-origin.js`

**Dominio:** automix · **Líneas:** 37

Desde dónde empezar AutoMix y qué pista del otro deck puede ser la siguiente. Funciones puras (sin DOM ni audio).

| Exporta | Qué hace |
|---|---|
| `radioOrigins` | Orígenes de radio disponibles. decks: { A, B } (con `track` y `st.playing`); list: pistas de la lista abierta; «Buscar» siempre está. |
| `otherDeckHead` | Pista del otro deck que puede ser la siguiente: otra distinta, analizada y sin salto brusco de tempo ni tonalidad en choque. |

- **Depende de:** `renderer/camelot.js`, `renderer/mixplan.js`
- **Lo usan:** `renderer/app.js`, `renderer/automix.js`
- **Pruebas:** lógica `scripts/test-automix-inicio.js`

### `renderer/automix-profiles.js`

**Dominio:** automix · **Líneas:** 28

Perfiles de AutoMix: un clic fija duración, estilo, orden y nivel de efectos. «Personalizado» no cambia nada.

| Exporta | Qué hace |
|---|---|
| `PROFILES` | Perfiles de AutoMix: un clic fija duración, estilo, orden y nivel de efectos. «Personalizado» no cambia nada. |
| `applyProfile` | — |
| `detect` | Perfil que describe la configuración actual: el que coincide en todas las claves, o `custom`. |
| `lastProfile` | — |

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:automix-profile`
- **Pruebas:** lógica `scripts/test-automix-claro.mjs`

### `renderer/automix-status.js`

**Dominio:** automix · **Líneas:** 35

Estado de AutoMix en una frase: fase, cuenta atrás y motivo. Función pura sobre `AutoMix.snapshot()`.

| Exporta | Qué hace |
|---|---|
| `PHASES` | — |
| `describe` | — |

- **Depende de:** `renderer/recipes.js`
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica `scripts/test-automix-claro.mjs`

### `renderer/automix-timeline.js`

**Dominio:** automix · **Líneas:** 188

Línea de tiempo de la próxima mezcla: la pista que sale (arriba) y la que entra (abajo) alineadas en el punto de mezcla, con el solape, los gestos de la receta y el cabezal. Se arrastra la salida, la entrada y el final del solape (duración).

| Exporta | Qué hace |
|---|---|
| `PRE` | — |
| `POST` | — |
| `geometry` | Geometría pura: tiempo relativo al punto de mezcla (u) ↔ píxel. |
| `hit` | Asa bajo el puntero: 'len' (final del solape), 'exit' (arriba) o 'in' (abajo); null si ninguna. |
| `Timeline` | — |

<details><summary>Métodos con contrato (2)</summary>

| Método | Qué hace |
|---|---|
| `vals()` | Valores efectivos (con el arrastre en curso aplicado). |
| `snap(kind, t)` | Compás (de la pista que corresponda) más cercano a t, dentro de la pista. |

</details>

- **Depende de:** `renderer/mixpreview.js`
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica **sin prueba**

### `renderer/automix.js`

**Dominio:** automix · **Líneas:** 1036

AutoMix: DJ automático. La cola sale de una lista o de la "radio" de YouTube Music (pistas parecidas a la actual); la siguiente se precarga en el deck libre y se mezcla sola: tempo y fase igualados (si hay BPM), fundido, bass swap o filtro.

| Exporta | Qué hace |
|---|---|
| `AutoMix` | — |
| `videoId` | — |
| `title` | — |
| `artist` | — |
| `thumb` | — |
| `duration` | — |
| `local` | — |

<details><summary>Métodos con contrato (24)</summary>

| Método | Qué hace |
|---|---|
| `exitMode()` | Modo de salida de la pista que suena. Si nunca se eligió, se deriva del ajuste heredado «puntos óptimos» (apagado = final de la pista), así lo guardado antes de existir el selector sigue valiendo. |
| `knob(deck, name, v)` | Controles reales de la UI: así los knobs se mueven solos y MIDI/UI ven lo mismo. |
| `skipNext()` | «Siguiente»: quita de la cola la pista que sigue; la mezcla irá a la que venía después. |
| `shuffle(rng = Math.random)` | «Barajar»: orden al azar de lo que no está fijado. No mueve lo fijado a mano ni la pista que ya se está preparando. |
| `useLocalSource()` | Con el modo local o el ámbito «Mi equipo», las sugerencias salen de la música del equipo ya analizada (BPM y tonalidad compatibles), no de la radio de YouTube Music. |
| `knownSongs()` | Canciones (no videoId) que ya sonaron, suenan o están en la cola: otra subida de la misma canción no se sugiere. |
| `addSmart(track, { next = false, analysis = null } = {})` | Agrega una pista. Analizada → va al hueco de menor coste de la cadena; sin analizar → al final, se analiza y se mueve sola. { next: true } la pone la siguiente. Devuelve { ok, index, moved, reason }. |
| `settleMoves()` | Cuando llega el análisis de una agregada sin analizar: dónde quedó (y de dónde se movió). |
| `analyzeSuggestions(list)` | Analiza en segundo plano (solo analiza, no guarda) las mejores sugeridas que aún no tienen BPM, de a una. |
| `prepareAhead(n = Infinity, maxParallel = 2)` | Analiza y guarda TODA la cola (no solo las próximas), de a 2 a la vez y en el orden de la cola. Las pistas ya guardadas quedan listas al instante y no ocupan uno de los 2 puestos. |
| `ensureStructure(t, a)` | Un análisis anterior sin estructura se recalcula con el archivo que ya está en el disco (sin volver a descargar). |
| `reorder({ force = false, manual = false } = {})` | Ordena la cola como una cadena (BPM suave, tonalidad, energía) a partir de lo que suena, respetando lo fijado a mano y la pista que ya se está precargando. Con `manual` ignora el interruptor y la regla de «al menos 3 analizadas». |
| `reorganizeNow()` | Botón «Reorganizar ahora»: ordena aunque el interruptor esté apagado y suelta lo que el orden manual había fijado. |
| `failHead(t, why)` | La cabeza de la cola no se pudo cargar (archivo roto, sin conexión…): se descarta y AutoMix sigue con la siguiente, explicándolo en la nota. |
| `maxLen()` | Duración máxima que se le da al plan: en Auto la receta decide (hasta 32 s); con un estilo fijo, la elegida. |
| `previewRecipe()` | Receta que se usaría con la mezcla planificada (para la vista); null si aún no hay plan o análisis de la siguiente. |
| `fxTrack(cur)` | Movimientos sobre los cues de la pista que suena (solo nivel «Marcado»): riser en las subidas y reverb en las roturas. |
| `entryOf(curAna)` | Plan de la transición con los análisis de las dos pistas (los del deck si ya están cargados). Plan de «Mezclar ahora»: la salida y la entrada más cercanas (frase de 8 beats, punto de la pista o editado). Entrada elegida para la pista que sigue (para la tarjeta «SIGUE»): el mismo `pickEntry` que usa el plan. |
| `timelineOf(curAna)` | Datos de la línea de tiempo de la próxima mezcla (o de la que está sonando, con el cabezal avanzando). |
| `mixNow()` | "Mezclar ahora": pasa ya a la siguiente pista lista; si aún no hay ninguna, se mezcla en cuanto la haya. |
| `startTransition(from, to, plan)` | `plan` es el resultado de planTransition (o, por compatibilidad, una duración en segundos). |
| `recipeStep(t, tm)` | Aplica los gestos de la receta en el instante `tm` (segundos de mezcla): EQ, filtro y crossfader directos; efectos por FxMoves. |
| `fxStep(t, p)` | Movimientos de efectos de la transición: empiezan por progreso o por posición de la saliente. |
| `glideTempoHome(deck, ms = HOME_MS)` | Tras mezclar, el tempo vuelve poco a poco al original de la pista para no acumular desvío entre pistas. |

</details>

- **Depende de:** `renderer/automix-compat.js`, `renderer/automix-origin.js`, `renderer/controls.js`, `renderer/fxcues.js`, `renderer/genres.js`, `renderer/mixplan.js`, `renderer/mixpreview.js`, `renderer/recipes.js`
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:alyssdj:automix`
- **Pruebas:** lógica `scripts/local-automix-test.mjs` · estática `scripts/test-jog.js` · en la app `scripts/automix-add-selftest.js`

### `renderer/camelot.js`

**Dominio:** library · **Líneas:** 28

Rueda Camelot: color por clave y compatibilidad armónica entre pistas.

| Exporta | Qué hace |
|---|---|
| `camelotColor` | — |
| `keysCompatible` | Misma clave, ±1 en la rueda, o la relativa (mismo número, otra letra). |
| `bpmCompatible` | BPM dentro de ±tol (también a mitad o doble de tempo). |

- **Depende de:** —
- **Lo usan:** `renderer/app.js`, `renderer/automix-add.js`, `renderer/automix-compat.js`, `renderer/automix-origin.js`, `renderer/deck.js`, `renderer/library.js`, `renderer/mixplan.js`, `renderer/recipes.js`
- **Pruebas:** lógica `scripts/test-local.js` · en la app `scripts/local-selftest.js`

### `renderer/controls.js`

**Dominio:** ui · **Líneas:** 13

Registro de controles: la UI, el teclado y MIDI actúan sobre los mismos ids. kind: 'button' → press(down) · 'range' → setNorm(0..1) · 'relative' → nudge(delta)

| Exporta | Qué hace |
|---|---|
| `controls` | Registro de controles: la UI, el teclado y MIDI actúan sobre los mismos ids. kind: 'button' → press(down) · 'range' → setNorm(0..1) · 'relative' → nudge(delta) |
| `register` | — |
| `press` | — |

- **Depende de:** —
- **Lo usan:** `renderer/app.js`, `renderer/automix.js`, `renderer/deck.js`, `renderer/midi.js`, `renderer/sampler.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/immersive-selftest.js`

### `renderer/deck.js`

**Dominio:** audio · **Líneas:** 1149

Un deck completo en la interfaz: carga la pista (streaming o archivo), motor de audio, ondas, cues, loops, tempo, stems, efectos y los controles de su plantilla DOM.

| Exporta | Qué hace |
|---|---|
| `Deck` | — |

<details><summary>Métodos con contrato (11)</summary>

| Método | Qué hace |
|---|---|
| `activateStems({ ch, kind })` | Activa los stems con la acción pedida ya aplicada ({ ch, kind: 'mute' \| 'solo' }). Cambia a ARCHIVO si hace falta. |
| `tickSaveOnPlay(dtMs)` | Una pista de YouTube que lleva 30 s sonando por streaming se guarda y analiza en segundo plano (si el ajuste está activo). |
| `mirrorFx(i, slot)` | Cambio en la cadena de efectos: al motor al instante y a disco (con retraso) si se recuerda entre sesiones. Una ranura con ruta «ambos» se copia a la misma ranura del otro deck (no hay un bus master común: ver efectos-ampliados, A1). |
| `applyResDefault()` | El valor por defecto de la resonancia cambió en Ajustes: vale para el doble clic y, si no se movió, para el canal. |
| `fxSet(slot, patch, owner = 'user')` | Interfaz para el AutoMix: cambio inmediato o con rampa lineal (segundos) de la ranura 0, 1 o 2. `owner` 'auto' marca el cambio como de AutoMix: si el usuario toca después la ranura, vuelve a 'user' y AutoMix la suelta. |
| `cue(down)` | CUE estilo CDJ: sonando → vuelve al cue y pausa; en pausa sobre el cue → preview mientras se mantiene; en pausa en otro punto → fija el cue ahí. |
| `phaseDiff(other)` | Desfase de fase respecto de otro deck, en beats (-0.5..0.5). Positivo = este deck va atrasado. |
| `matchTempoSmart(other, maxPct = 12)` | Iguala el tempo al del otro deck; si están a doble/mitad de tempo, usa la relación más cercana. |
| `movePlatter(deg, dt)` | `deg` grados girados en `dt` s: con buffer manda la velocidad de la pista; sin él, se busca en pasos. |
| `rollStart(beats)` | Loop roll: mientras se mantiene pulsado repite un trozo; al soltar, la pista sigue donde habría estado (slip). |
| `setBank(bank, toggle = false)` | Banco abierto ('' = ninguno): se recuerda por deck. Pulsar la pestaña abierta la cierra. |

</details>

- **Depende de:** `renderer/camelot.js`, `renderer/controls.js`, `renderer/fxchain.js`, `renderer/fxpanel.js`, `renderer/knob.js`, `renderer/source.js`, `renderer/waveform.js`
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:alyssdj.deck.bank.`, `localStorage:ytdj:track:`
- **Nota:** Mezcla el deck (audio, ondas, cues, loops, FX) con su DOM: el modelo y la vista deberían separarse.
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-fx.js` · en la app `scripts/automix-claro-robust-selftest.js`

### `renderer/fxchain.js`

**Dominio:** fx · **Líneas:** 113

Cadena de efectos de un deck: tres ranuras en serie. Modelo puro (sin DOM ni audio): el deck lo envía entero en cada mensaje `mix` y el motor (shared/fx.js) lo aplica.

| Exporta | Qué hace |
|---|---|
| `FX_TYPES` | Cadena de efectos de un deck: tres ranuras en serie. Modelo puro (sin DOM ni audio): el deck lo envía entero en cada mensaje `mix` y el motor (shared/fx.js) lo aplica. |
| `USES_DIV` | Qué usa cada tipo: división de beat (`d`) y qué mueve P. |
| `ROUTES` | — |
| `SLOTS` | — |
| `STORE` | — |
| `defaultSlot` | — |
| `defaultChain` | — |
| `clampSlot` | Devuelve una ranura válida; lo que falte o esté fuera de rango toma su valor por defecto. |
| `FxChain` | — |

<details><summary>Métodos con contrato (3)</summary>

| Método | Qué hace |
|---|---|
| `set(i, patch = {}, { fromRamp = false, owner = 'user' } = {})` | Cambia una ranura; cancela su rampa si el cambio toca los mismos parámetros que ella mueve. |
| `move(from, to)` | Mueve la ranura `from` a la posición `to` (el motor aplica `slots[i]` a su i-ésima etapa en serie, así que esto reordena la cadena). |
| `snapshot()` | Lo que viaja en el mensaje `mix`. |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/deck.js`, `renderer/fxpanel.js`, `renderer/fxpresets.js`
- **Guarda:** `localStorage:alyssdj.fx.`
- **Pruebas:** lógica `scripts/test-fx-ampliados.js`

### `renderer/fxcues.js`

**Dominio:** fx · **Líneas:** 184

Cues musicales de una pista (subida, caída, rotura) derivados de la energía por frase del análisis, y los «movimientos» de efectos que AutoMix hace sobre ellos. Funciones puras (sin DOM ni audio) salvo `FxMoves`, que mueve la cadena de efectos de los decks que le pasan.

| Exporta | Qué hace |
|---|---|
| `LEVELS` | Cues musicales de una pista (subida, caída, rotura) derivados de la energía por frase del análisis, y los «movimientos» de efectos que AutoMix hace sobre ellos. Funciones puras (sin DOM ni audio) salvo `FxMoves`, que mueve la cadena de efectos de los decks que le pasan. |
| `fxCues` | ana: { bpm, offset, mix: { phrases: [0–100 por frase], phraseBeats } } → [{ t, kind, strength, end? }] ordenado por t. |
| `planTransitionMoves` | Movimientos de una transición: eco de salida y reverb de rotura sobre la pista saliente. level: 'off' \| 'subtle' \| 'full' · cur: análisis de la saliente · plan: { exitAt, seconds } · style: estilo de la mezcla Cada movimiento: { id, name, deck: 'from', type, p, targetWet, tailMs, startP \| atPos/endPos, rampSeconds }. |
| `planTrackMoves` | Movimiento sobre cues de la pista que suena (solo nivel «full», fuera de transición). Se llama en cada ciclo y devuelve el movimiento que toca empezar ahora (o null). `lastEnd` es la posición donde acabó el anterior. |
| `FxMoves` | Reserva y devuelve ranuras de la cadena de efectos de los decks para los movimientos de AutoMix. Solo usa ranuras apagadas; si el usuario toca una que está usando, la suelta sin restaurar (manda el usuario). |

<details><summary>Métodos con contrato (4)</summary>

| Método | Qué hace |
|---|---|
| `claim(deck, want)` | want: { name, type, p } → índice de la ranura reservada o null (sin ranura libre) |
| `owned(deck, slot)` | ¿Sigue siendo de AutoMix? Si el usuario la tocó, se olvida (sin restaurar). |
| `release(deck, slot, afterMs = 0)` | Devuelve la ranura a como estaba, ya o tras `afterMs` (la cola del eco). |
| `sweep()` | Quita las reservas que el usuario tomó. |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/automix.js`, `renderer/mixplan.js`, `renderer/recipes.js`
- **Pruebas:** lógica `scripts/test-fx-ampliados.js` · en la app `scripts/fxcues-selftest.js`

### `renderer/fxpad.js`

**Dominio:** fx · **Líneas:** 64

Pad XY: X = cantidad (izquierda → derecha), Y = parámetro P (abajo → arriba). Ratón/táctil y teclado.

| Exporta | Qué hace |
|---|---|
| `PAD_STEP` | Pad XY: X = cantidad (izquierda → derecha), Y = parámetro P (abajo → arriba). Ratón/táctil y teclado. |
| `PAD_STEP_BIG` | — |
| `makeXYPad` | — |

- **Depende de:** —
- **Lo usan:** `renderer/fxpanel.js`
- **Pruebas:** lógica **sin prueba**

### `renderer/fxpanel.js`

**Dominio:** fx · **Líneas:** 166

Panel FX de un deck: tres ranuras (interruptor + tipo), cantidad y P de la ranura seleccionada y el pad XY.

| Exporta | Qué hace |
|---|---|
| `FX_LABEL` | — |
| `FX_GROUPS` | — |
| `mountFxPanel` | — |

- **Depende de:** `renderer/fxchain.js`, `renderer/fxpad.js`, `renderer/fxpresets.js`
- **Lo usan:** `renderer/deck.js`
- **Pruebas:** lógica **sin prueba**

### `renderer/fxpresets.js`

**Dominio:** fx · **Líneas:** 74

Presets de ranura: de fábrica y propios (en localStorage). Un preset es { name, type, wet, p, d }; aplicarlo no enciende la ranura.

| Exporta | Qué hace |
|---|---|
| `STORE` | — |
| `MAX_USER` | — |
| `FACTORY` | — |
| `FxPresets` | — |

<details><summary>Métodos con contrato (2)</summary>

| Método | Qué hace |
|---|---|
| `save(name, slot)` | Guarda la ranura con ese nombre (si ya existe uno propio, lo sustituye). Devuelve { ok, error? }. |
| `apply(chain, i, name)` | Aplica el preset a la ranura `i` de la cadena (sin encenderla). |

</details>

- **Depende de:** `renderer/fxchain.js`
- **Lo usan:** `renderer/fxpanel.js`
- **Guarda:** `localStorage:alyssdj.fxpresets`
- **Pruebas:** lógica `scripts/test-fx-ampliados.js` · en la app `scripts/fx-ampliados-ui-selftest.js`

### `renderer/genres.js`

**Dominio:** genres · **Líneas:** 116

Géneros de las pistas en la interfaz: mapa id → etiquetas (viene del almacén de main), chips, filtro y editor.

| Exporta | Qué hace |
|---|---|
| `genres` | — |
| `openGenreEditor` | Editor de etiquetas bajo una fila: Enter o coma añaden, Retroceso quita la última, Escape cierra. |
| `closeGenreEditor` | — |

<details><summary>Métodos con contrato (2)</summary>

| Método | Qué hace |
|---|---|
| `matches(id, selected)` | Alguna etiqueta de la pista está entre las elegidas (sin selección, todas pasan). |
| `chips(id, max = 3)` | Chips para una fila: hasta `max` y «+N». |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/app.js`, `renderer/automix.js`, `renderer/library.js`
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-generos.js` · en la app `scripts/generos-selftest.js`

### `renderer/index.html`

**Dominio:** ui · **Líneas:** 667

Documento HTML de la interfaz: estructura de las vistas, decks, mezclador, librería y diálogos.

- **Depende de:** `shared/fx.js`, `shared/dsp-chain.js`, `shared/scratch.js`, `shared/deck-engine.js`, `renderer/app.js`
- **Lo usan:** —
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-automix-claro.js`

### `renderer/knob.js`

**Dominio:** ui · **Líneas:** 75

Knob rotativo: arrastre vertical, rueda, doble clic = valor por defecto.

| Exporta | Qué hace |
|---|---|
| `makeKnob` | — |

- **Depende de:** —
- **Lo usan:** `renderer/app.js`, `renderer/deck.js`
- **Pruebas:** lógica **sin prueba**

### `renderer/layout.js`

**Dominio:** ui · **Líneas:** 35

Perfiles de diseño según el tamaño de la ventana: compacto (portátiles pequeños), normal y amplio (2K/4K, proyectores).

| Exporta | Qué hace |
|---|---|
| `MODES` | Perfiles de diseño según el tamaño de la ventana: compacto (portátiles pequeños), normal y amplio (2K/4K, proyectores). |
| `profileFor` | — |
| `scaleFor` | Escala de la interfaz en el perfil amplio: crece con la pantalla sin pasarse (1.15 – 1.6). |
| `resolve` | — |
| `applyLayout` | — |
| `watchLayout` | — |

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica `scripts/test-layouts.js` · en la app `scripts/automix-inicio-selftest.js`

### `renderer/library.js`

**Dominio:** library · **Líneas:** 758

Librería: búsqueda, Me gusta y playlists de YouTube Music + pistas ya analizadas.

| Exporta | Qué hace |
|---|---|
| `Library` | — |

<details><summary>Métodos con contrato (6)</summary>

| Método | Qué hace |
|---|---|
| `srcTags(r)` | Filas locales con sus etiquetas de fuente (Mi equipo · Analizada · Importada…). |
| `bindFilters()` | Filtros de BPM y tonalidad (los de género son los de la barra). Una pista sin análisis no pasa un filtro de BPM o tono. |
| `passesAnalysisFilters(r)` | ¿Pasa la fila los filtros de BPM y tonalidad? (los de género los aplica `render`). |
| `onPreview(e)` | Repinta solo la fila que empieza o termina; el avance mueve la barra sin tocar la tabla. |
| `reference()` | Deck de referencia para resaltar compatibles: el que suena al aire; si no, el primero con análisis. |
| `renderEmpty(rows)` | Estado vacío: qué pasa y qué hacer a continuación, según la fuente. |

</details>

- **Depende de:** `renderer/camelot.js`, `renderer/genres.js`, `renderer/mixpreview.js`, `renderer/playlists.js`, `renderer/preview.js`, `renderer/source.js`, `renderer/stems.js`
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:alyssdj.search.scope`
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-export.js` · en la app `scripts/automix-claro-robust-selftest.js`

### `renderer/midi.js`

**Dominio:** sampler-midi · **Líneas:** 88

MIDI: aprendizaje (clic en control + mover el control físico) y despacho a los controles registrados.

| Exporta | Qué hace |
|---|---|
| `Midi` | — |

- **Depende de:** `renderer/controls.js`
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:ytdj:midi`
- **Pruebas:** lógica **sin prueba**

### `renderer/mixeditor.js`

**Dominio:** automix · **Líneas:** 290

Editor de puntos de mezcla: ve y ajusta la entrada y hasta 6 salidas de una pista, y prueba la transición.

| Exporta | Qué hace |
|---|---|
| `MixEditor` | — |

<details><summary>Métodos con contrato (1)</summary>

| Método | Qué hace |
|---|---|
| `view()` | Lo que se muestra: la edición del usuario o, mientras no hay, los candidatos automáticos. |

</details>

- **Depende de:** `renderer/mixpreview.js`, `renderer/waveform.js`
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica **sin prueba**

### `renderer/mixplan.js`

**Dominio:** automix · **Líneas:** 413

Plan de mezcla (funciones puras): cuándo salir de la pista que suena, dónde entrar en la siguiente, cuánto dura la transición y qué pista conviene después. Los pesos están a la vista para ajustarlos escuchando.

| Exporta | Qué hace |
|---|---|
| `MAX_BPM_GAP` | — |
| `PITCH_LIMIT` | — |
| `HOME_MS` | — |
| `bpmGap` | Diferencia relativa de tempo necesaria para igualar `cand` a `cur`, mirando también doble y mitad. |
| `energyAt` | Energía (0..100) de la frase que contiene el instante t. |
| `scoreTransition` | Menor puntuación = mejor transición. `exitAt` es el instante de salida de `cur` (por defecto, su mejor candidato). |
| `pickNext` | Ordena la cola. Lo que el usuario colocó a mano (`pinned`) es un ancla: se queda en su posición. El resto se reparte por los huecos libres: primero las listas, de mejor a peor transición, y al final lo que aún no está listo, en su orden. No muta la entrada. |
| `edgeCost` | — |
| `orderChain` | Ordena la cola como una cadena que parte de `cur` y minimiza el coste total de las transiciones. `pinned` (lo que el usuario colocó a mano) es ancla: no se mueve y la cadena se ordena alrededor. Las pistas sin análisis (`analysisOf` sin BPM) quedan al final de los huecos libres, en su orden. Exacto hasta 8 pistas libres; más allá, voraz + mejora local con presupuesto de tiempo. No muta la entrada. Devuelve { queue, cost, scores (coste de llegar a cada pista), moved }. |
| `planNearest` | «Mezclar ahora»: la salida más cercana por delante (no inmediata a mitad de un compás) y la entrada de la siguiente. Candidatos de salida: los puntos de la pista (editados por el usuario o automáticos) y los límites de frase de 8 beats de su rejilla; gana el de menor tiempo ≥ pos + minLead que no obligue a esperar más de maxWait. La duración va en compases enteros (mínimo 4 beats) y nunca pasa del final. Sin BPM en alguna de las dos: fundido corto ahora mismo. Pura: no muta nada. |
| `entryCandidates` | Candidatos de entrada de `next` para una transición de `seconds`. Todos van en límite de frase y desde el primer compás con música. |
| `pickEntry` | Elige dónde entra `next`. `cur` es el análisis de la que sale, `exitAt` su salida y `seconds` lo que dura la transición. Un punto editado por el usuario manda; sin análisis se entra por el inicio. Pura. |
| `GENRE_BONUS` | ---------- candidatas: BPM, tonalidad, energía, estilo y popularidad ---------- |
| `POP_WEIGHTS` | — |
| `popScore` | 100 mil reproducciones → 0, 1000 millones → 1 (escala logarítmica). |
| `fitsWith` | ¿Encaja con `ref` (BPM dentro del 8% con mitad/doble y tonalidad compatible)? Sin análisis de alguna: se asume que sí. |
| `rankCandidates` | Ordena candidatas para continuar desde `ref` (análisis de la última pista de la cola o de la que suena). cands: [{ track: { videoId, artist, year, plays, fromRadio }, analysis? }] score = coste de transición − bonus de estilo − bonus de popularidad. Menor = mejor. Las que no encajan (salto de BPM > 8 % o tonalidad incompatible) van siempre DESPUÉS de las que encajan, sea cual sea su popularidad. |
| `bestInsertion` | Mejor hueco para insertar `track` en la cola: el de menor aumento del coste total de la cadena. Los primeros `lock` lugares (la pista ya precargada) y los huecos que partirían a una fijada no se tocan. No muta la entrada. |
| `EXIT_MODES` | Modos de salida de la pista que suena (como los modos de transición de un DJ automático): optimal: la mejor salida del análisis · intro-outro: al empezar el outro, con la duración del menor entre outro e intro outro-start: al empezar el outro, con la duración elegida · end: casi al final de la pista. |
| `MIN_TRANSITION` | — |
| `MAX_TRANSITION` | — |
| `introOutroSeconds` | Duración de la transición en «Outro y intro»: el menor entre lo que queda de outro y el intro de la entrante; si solo se conoce uno, ese; si ninguno, `fallback`. No pasa del outro de la propia entrante y se acota a [4, 48] s. |
| `planTransition` | Plan de la transición entre `cur` (suena, en `pos`) y `next`. cur/next: análisis ({ bpm, offset, mix, duration }). cfg: { len (s), exitMode, optimal (heredado), style }. |
| `songKey` | — |
| `cost` | — |
| `fits` | — |

- **Depende de:** `renderer/camelot.js`, `renderer/fxcues.js`
- **Lo usan:** `renderer/automix-add.js`, `renderer/automix-compat.js`, `renderer/automix-origin.js`, `renderer/automix.js`, `renderer/mixpreview.js`, `renderer/recipes.js`
- **Pruebas:** lógica `scripts/test-automix-add.js`

### `renderer/mixpreview.js`

**Dominio:** automix · **Líneas:** 71

Pre-escucha de una transición: los segundos previos a la salida de A y la entrada de B, con el mismo cruce que AutoMix. Va por la salida de auriculares (cue) si está configurada; si no, por la salida por defecto. `silent` es para las pruebas.

| Exporta | Qué hace |
|---|---|
| `fileUrl` | — |
| `previewPlan` | — |
| `startPreview` | — |

- **Depende de:** `renderer/mixplan.js`
- **Lo usan:** `renderer/automix-timeline.js`, `renderer/automix.js`, `renderer/library.js`, `renderer/mixeditor.js`, `renderer/preview.js`
- **Pruebas:** lógica `scripts/test-entrada.js`

### `renderer/playlists.js`

**Dominio:** library · **Líneas:** 370

Playlists locales: sección «Mis listas» en las fuentes, menú «Añadir a playlist», selección múltiple y barras de acciones. La librería monta una instancia (`library.pls`); aquí vive todo lo que antes no existía: crear, poner, sacar, ordenar y listas inteligentes.

| Exporta | Qué hace |
|---|---|
| `PlaylistsUI` | — |

<details><summary>Métodos con contrato (2)</summary>

| Método | Qué hace |
|---|---|
| `apply(data)` | Pinta la lista (`data` de `pl.get`) y ajusta las barras. |
| `afterRender()` | Tras pintar la tabla: lo seleccionado que ya no se ve deja de estar seleccionado. |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/library.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/playlists-selftest.js`

### `renderer/preview.js`

**Dominio:** library · **Líneas:** 112

Preescucha de la Librería: una sola pista a la vez, por los auriculares, sin pasar por los decks ni por el master. Usa el archivo local de la pista (nunca descarga nada); el modelo (`startAt`) es puro y se prueba sin audio.

| Exporta | Qué hace |
|---|---|
| `startAt` | Segundo donde empieza: punto de entrada de mezcla (o inicio de la rejilla) si cae dentro de la pista; si no, el 25 %. |
| `preview` | — |

- **Depende de:** `renderer/mixpreview.js`
- **Lo usan:** `renderer/library.js`
- **Pruebas:** lógica `scripts/test-preescucha.js` · en la app `scripts/automix-claro-selftest.js`

### `renderer/recipes.js`

**Dominio:** automix · **Líneas:** 132

Recetas de transición de AutoMix: cada estilo es una línea de tiempo de gestos sobre la rejilla de la pista que sale. Funciones puras (sin DOM ni audio): `chooseStyle` elige la receta según el análisis y `planRecipe` la convierte en gestos.

| Exporta | Qué hace |
|---|---|
| `STYLES` | — |
| `STYLE_LABEL` | — |
| `chooseStyle` | → { style, why }. Con un estilo fijo se respeta; con 'auto' decide el análisis (BPM, tonalidad, estructura). |
| `planRecipe` | Receta de `style` sobre la rejilla de la saliente. Devuelve { style, len, gestures }; `len` ≤ plan.seconds. Gesto: { id, deck: 'from'\|'to'\|'x', param: 'eqLow'\|'filter'\|'x'\|'fx', from, to, at, end, curve: 'lin'\|'ease'\|'step', fx? } `at`/`end` en segundos de mezcla (0 = salida de la saliente), siempre múltiplos del pulso. x: 0 = deck saliente, 1 = entrante. level: 'off' \| 'subtle' \| 'full' (REQ-7: 'off' quita los gestos de efecto). |
| `gestureValue` | Valor de un gesto en el instante t de la mezcla: null antes de empezar; `to` al terminar. Sirve al motor y a las pruebas. |
| `GESTURE_LABEL` | Etiqueta corta de un gesto para la vista. |

- **Depende de:** `renderer/camelot.js`, `renderer/fxcues.js`, `renderer/mixplan.js`
- **Lo usan:** `renderer/app.js`, `renderer/automix-status.js`, `renderer/automix.js`
- **Pruebas:** lógica `scripts/test-recipes.js`

### `renderer/sampler.js`

**Dominio:** sampler-midi · **Líneas:** 204

Sampler de 8 pads: sonidos sintetizados de fábrica (sin archivos) o tus propios audios. Sale por el dispositivo master.

| Exporta | Qué hace |
|---|---|
| `Sampler` | — |

- **Depende de:** `renderer/controls.js`
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:alyssdj:sampler`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/automix-inicio-selftest.js`

### `renderer/settings-ui.js`

**Dominio:** settings · **Líneas:** 51

Búsqueda de Ajustes: funciones puras (sin DOM) para filtrar opciones por texto.

| Exporta | Qué hace |
|---|---|
| `norm` | Búsqueda de Ajustes: funciones puras (sin DOM) para filtrar opciones por texto. |
| `settingsFilter` | rows: [{ pane, text }] → { panes: Set de secciones con resultados, hits: índices de las filas que coinciden } Todas las palabras de la consulta deben aparecer (en cualquier orden) en el texto de la fila. |
| `settingPatch` | Parche de ajustes que corresponde a un control del formulario (los tres de la salida de audio van juntos). |
| `sectionDefaults` | Parche con los valores por defecto de las opciones de una sección. |

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica `scripts/test-stems.js`

### `renderer/source.js`

**Dominio:** video · **Líneas:** 24

Fuente de una pista: archivo (local o copia guardada) o streaming. Función pura: la usan el deck y la librería. `forced` ('file' | 'stream' | null) es la elección manual del usuario para el deck actual.

| Exporta | Qué hace |
|---|---|
| `ORIGINS` | Fuente de una pista: archivo (local o copia guardada) o streaming. Función pura: la usan el deck y la librería. `forced` ('file' \| 'stream' \| null) es la elección manual del usuario para el deck actual. |
| `resolveSource` | — |
| `originChip` | Texto corto del origen en la fila de la librería. |

- **Depende de:** —
- **Lo usan:** `renderer/deck.js`, `renderer/library.js`
- **Pruebas:** lógica `scripts/test-sinvideo.js` · en la app `scripts/automix-inicio-selftest.js`

### `renderer/splits.js`

**Dominio:** ui · **Líneas:** 63

Divisores arrastrables entre ondas, decks y librería. Estado puro: la interfaz solo aplica los valores al <body>. Hay dos grados de libertad por vista: la altura de las ondas o la de la librería; manda el último que se movió.

| Exporta | Qué hace |
|---|---|
| `STORE` | Divisores arrastrables entre ondas, decks y librería. Estado puro: la interfaz solo aplica los valores al <body>. Hay dos grados de libertad por vista: la altura de las ondas o la de la librería; manda el último que se movió. |
| `SPLITVIEWS` | — |
| `STEP` | — |
| `STEP_BIG` | — |
| `clampSplit` | Recorta `px` a los límites de la zona para una ventana de `inner` px de alto. `fixed` es lo que ocupan la barra superior y la consola: ondas y librería se reparten el resto, y cada una deja a la otra su mínimo. |
| `SplitState` | — |

<details><summary>Métodos con contrato (1)</summary>

| Método | Qué hace |
|---|---|
| `active(view)` | Lo que se aplica: { which, px } de la zona que manda, o null si la vista usa su tamaño por defecto. |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:alyssdj.splits`
- **Pruebas:** lógica `scripts/test-vistas.js` · en la app `scripts/ajustes-selftest.js`

### `renderer/stems.js`

**Dominio:** stems · **Líneas:** 167

Stems manuales en la interfaz: estado compartido de las separaciones y textos. Sin DOM: lo usan el deck y la Librería. Orden de los botones: voz, batería, bajo, resto. `ch` es el stem en el archivo de 8 canales (batería 0, bajo 1, resto 2, voz 3).

| Exporta | Qué hace |
|---|---|
| `STEM_UI` | Stems manuales en la interfaz: estado compartido de las separaciones y textos. Sin DOM: lo usan el deck y la Librería. Orden de los botones: voz, batería, bajo, resto. `ch` es el stem en el archivo de 8 canales (batería 0, bajo 1, resto 2, voz 3). |
| `fmtEta` | — |
| `fmtSize` | — |
| `jobText` | Texto de un trabajo en curso: «Preparando… 37 %, ≈ 1:20». |
| `trackView` | Qué mostrar para una pista: 'off' (no disponible), 'none', 'work', 'ready', 'active', 'error'. |
| `errorText` | — |
| `StemsStore` | Estado compartido: lista de stems hechos, trabajos y errores por pista. |

<details><summary>Métodos con contrato (4)</summary>

| Método | Qué hace |
|---|---|
| `spaceLine(quotaGB = 5)` | «Espacio: 1,2 GB de 5 GB» para Ajustes. |
| `deviceLine()` | «Dispositivo: WebGPU · 14× tiempo real» para Ajustes. |
| `autoOn(mode = 'auto')` | ¿Preparar solos los stems? on/off lo decide el ajuste; auto, solo si ya hay una GPU comprobada. |
| `auto(id, priority, mode)` | Petición automática (sin avisos si falla: la pista puede no tener archivo local todavía). priority 0 = deck, 1 = siguiente. |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/app.js`, `renderer/library.js`
- **Pruebas:** lógica `scripts/test-stems.js` · en la app `scripts/playlists-selftest.js`

### `renderer/update-ui.js`

**Dominio:** updater · **Líneas:** 35

Pinta el aviso de actualización según el estado que manda el proceso principal.

| Exporta | Qué hace |
|---|---|
| `describe` | — |
| `renderUpdate` | — |

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/updater-selftest.js`

### `renderer/views.js`

**Dominio:** ui · **Líneas:** 60

Vistas de trabajo (como los modos de Mixxx o de djay): mezcla, librería, automix (inmersiva) y ondas. Máquina de estados pura: la interfaz solo aplica `view` y `waves` al <body>.

| Exporta | Qué hace |
|---|---|
| `VIEWS` | Vistas de trabajo (como los modos de Mixxx o de djay): mezcla, librería, automix (inmersiva) y ondas. Máquina de estados pura: la interfaz solo aplica `view` y `waves` al <body>. |
| `WAVES` | — |
| `STORE` | — |
| `ViewState` | — |

<details><summary>Métodos con contrato (4)</summary>

| Método | Qué hace |
|---|---|
| `set(view)` | Elección del usuario (selector, atajo o ajuste). |
| `enterAutomixTab()` | Abrir la fuente AutoMix de la librería pasa a la vista Librería; al salir vuelve a la anterior si nadie la cambió. |
| `effectiveWaves()` | Las ondas «en el deck» solo valen en Mezcla y Librería; Ondas y Automix usan su propia disposición. |
| `compact()` | Compacta los decks (plato pequeño, pads en una fila, mezclador reducido). |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Guarda:** `localStorage:alyssdj.view`
- **Pruebas:** lógica `scripts/test-sinvideo.js` · en la app `scripts/ajustes-selftest.js`

### `renderer/viz.js`

**Dominio:** automix · **Líneas:** 175

Visualizador de la vista Automix: anillos que laten con el beat. La parte pura (qué anillos y con qué intensidad) no toca el DOM; `Visualizer` los dibuja en un lienzo detrás de la portada.

| Exporta | Qué hace |
|---|---|
| `beatPhase` | Fase (0–1) dentro del beat y beat (0–3) dentro del compás de 4. |
| `beatInBar` | — |
| `deckRings` | r en 0–1 (0 = borde de la portada, 1 = radio máximo), a = opacidad, w = factor de grosor. |
| `vizScene` | decks: [{ id, level, gain, bpm, pos, offset, playing }] → un resultado por deck, con su color. |
| `pulseOf` | — |
| `Visualizer` | Dibuja los anillos en el lienzo detrás de la portada. Solo corre (a ≤ 30 fps) mientras la vista Automix, la ventana y el visualizador están activos; con movimiento reducido dibuja un cuadro estático cuando algo cambia. |
| `level` | — |

<details><summary>Métodos con contrato (1)</summary>

| Método | Qué hace |
|---|---|
| `refresh()` | Pone el bucle en el estado que toca: parado, un cuadro estático o animando. |

</details>

- **Depende de:** —
- **Lo usan:** `renderer/app.js`
- **Pruebas:** lógica `scripts/test-visual.js` · en la app `scripts/visual-check-selftest.js`

### `renderer/waveform.js`

**Dominio:** audio · **Líneas:** 199

Formas de onda: 3 bandas desde el análisis (yt-dlp) o mono "en vivo" construida mientras suena el stream.

| Exporta | Qué hace |
|---|---|
| `HOTCUE_COLORS` | — |
| `analysisWave` | — |
| `liveWave` | — |
| `recordLive` | — |
| `fitCanvas` | — |
| `drawScroll` | Vista desplazable centrada en la posición actual, con beatgrid, cues y loop. |
| `drawOverview` | Vista general de la pista completa. La parte estática se cachea en un canvas fuera de pantalla. |

- **Depende de:** —
- **Lo usan:** `renderer/deck.js`, `renderer/mixeditor.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/packaged-selftest.js`

