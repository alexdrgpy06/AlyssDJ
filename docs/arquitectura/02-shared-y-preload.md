# 02 · Compartido y preload (`shared/`, `preload/`)

<!-- Generado por scripts/arquitectura-gen.js desde docs/arquitectura/modulos.json: no editar a mano (edita el registro y regenera). -->

`shared/` se carga como `<script>` en la interfaz (UMD: también se puede `require` en pruebas) y lo comparten el análisis, el motor de deck y los efectos. `preload/` es el puente: `preload/app.js` expone `window.api` a la interfaz y `preload/deck.js` corre dentro de YouTube Music.

11 módulos.

### `preload/app.js`

**Dominio:** app · **Líneas:** 141

Puente entre la UI (app://ui) y el proceso principal.

- **Depende de:** —
- **Lo usan:** —
- **Nota:** Un solo objeto `window.api` con todos los grupos: crece con cada función nueva.
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-export.js` · en la app `scripts/automix-claro-selftest.js`

### `preload/deck.js`

**Dominio:** audio · **Líneas:** 107

Corre dentro de music.youtube.com (mundo aislado). Toma el <video> del reproductor de YT Music, lo pasa por la cadena DSP del deck y obedece los comandos del deck. Nada sale de la página salvo el estado de reproducción (posición, nivel, metadata) hacia la UI.

- **Depende de:** `shared/deck-engine.js`
- **Lo usan:** —
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-stream-guard.js` · en la app `scripts/automix-claro-robust-selftest.js`

### `shared/analysis.js`

**Dominio:** analysis · **Líneas:** 330

Análisis offline de una pista ya decodificada (mono, float32): waveform 3 bandas, BPM + beatgrid, tonalidad, ganancia. Funciones puras: las usa el worker de la app y el CLI de pruebas.

| Exporta | Qué hace |
|---|---|
| `analyze` | — |
| `tempo` | — |
| `key` | — |
| `waveform` | — |
| `loudness` | ---------- Ganancia ---------- |
| `ANALYSIS_SR` | — |
| `_internals` | — |
| `combScore` | Puntuación de una rejilla: energía media de onset en los beats, maximizada sobre la fase. |

- **Depende de:** `shared/structure.js`
- **Lo usan:** `main/analysis-worker.js`, `main/analyze-cli.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/automix-add-selftest.js`

### `shared/deck-engine.js`

**Dominio:** audio · **Líneas:** 390

Motor de un deck sobre un HTMLMediaElement. Las dos fuentes lo comparten: - stream: el <video> de music.youtube.com (sesión Premium), dentro de la vista del deck - local: un <audio> con el archivo que bajó yt-dlp, dentro del renderer Lo que cambia entre ambas es el "adapter" (cómo se carga una pista y se lee su metadata).

| Exporta | Qué hace |
|---|---|
| `createDeckEngine` | — |

- **Depende de:** `shared/dsp-chain.js`, `shared/scratch.js`
- **Lo usan:** `preload/deck.js`, `renderer/index.html`
- **Pruebas:** lógica **sin prueba**

### `shared/dsp-chain.js`

**Dominio:** audio · **Líneas:** 186

Cadena de canal de un deck: trim → EQ 3 bandas → filtro bipolar → (fader → master) + (PFL → cue) + medidor. Se usa igual en la vista de YouTube Music (stream) y en el renderer (archivo local de yt-dlp).

| Exporta | Qué hace |
|---|---|
| `create` | — |
| `findSinkId` | — |

- **Depende de:** `shared/fx.js`
- **Lo usan:** `renderer/index.html`, `shared/deck-engine.js`
- **Pruebas:** lógica **sin prueba**

### `shared/fx.js`

**Dominio:** fx · **Líneas:** 500

Efectos de un deck (insert): tres ranuras en serie, cada una con un tipo a elegir entre Eco, Reverb, Flanger, Gate, Phaser, Crush, Filtro, Cinta, Reducer, Stutter, Brake, Transformer, Drive y Pitch, una cantidad (wet, 0–1) y un segundo parámetro propio (P, 0–1). Cada ranura: out = dry + efecto·wet. Solo se monta el efecto de una ranura mientras está activa (on y wet > 0); apagada, el audio pasa tal cual y no gasta CPU. Eco, Gate, Flanger y Phaser siguen el BPM del deck.

| Exporta | Qué hace |
|---|---|
| `delay` | — |
| `depth` | — |
| `osc` | — |
| `shaper` | — |
| `vg` | — |

- **Depende de:** —
- **Lo usan:** `renderer/index.html`, `shared/dsp-chain.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/automix-continuo-selftest.js`

### `shared/scratch-math.js`

**Dominio:** jog · **Líneas:** 47

Núcleo del scratch: lee un buffer estéreo con posición fraccionaria y velocidad variable (negativa incluida), con interpolación lineal y la velocidad suavizada para que no haya clics. Sin DOM ni audio: lo usan el worklet y las pruebas.

| Exporta | Qué hace |
|---|---|
| `SLEW_S` | Núcleo del scratch: lee un buffer estéreo con posición fraccionaria y velocidad variable (negativa incluida), con interpolación lineal y la velocidad suavizada para que no haya clics. Sin DOM ni audio: lo usan el worklet y las pruebas. |
| `makeState` | — |
| `render` | buf: { L, R: Float32Array }. Escribe n muestras en outL/outR y avanza el estado. Fuera del buffer devuelve silencio y deja la posición en el borde (la velocidad se anula para que no se acumule). |
| `SECONDS_PER_TURN` | Velocidad de la pista (muestras por muestra) a partir del giro del plato: 33⅓ rpm ⇒ 1,8 s de pista por vuelta. |
| `velFromDrag` | — |
| `bufferMiB` | Memoria de un buffer decodificado (dos canales Float32) en MiB. |

- **Depende de:** —
- **Lo usan:** `shared/scratch-worklet.js`
- **Pruebas:** lógica `scripts/test-jog.js`

### `shared/scratch-worklet.js`

**Dominio:** jog · **Líneas:** 33

AudioWorklet del scratch: reproduce el buffer con la velocidad que le manda el hilo principal.

- **Depende de:** `shared/scratch-math.js`
- **Lo usan:** —
- **Pruebas:** lógica **sin prueba**

### `shared/scratch.js`

**Dominio:** jog · **Líneas:** 99

Controlador del scratch en el hilo principal: decodifica el audio local, lo entrega al worklet y lo manda sujetar, mover a la velocidad del plato y soltar. Si algo falla (stream, sin worklet, pista enorme) `prepare` devuelve false y el deck usa el respaldo de freno y arranque suaves.

| Exporta | Qué hace |
|---|---|
| `create` | — |

- **Depende de:** —
- **Lo usan:** `renderer/index.html`, `shared/deck-engine.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/jog-selftest.js`

### `shared/stems-dsp.js`

**Dominio:** stems · **Líneas:** 214

Separación de stems con HTDemucs (ONNX): el preproceso y el posproceso de Demucs, sin ONNX ni DOM. El modelo recibe cada ventana en dos formas (onda `input` y espectrograma `x`) y devuelve la rama temporal y la de frecuencia; aquí se calcula la STFT, se suman las ramas con la iSTFT y se unen las ventanas con solape. La inferencia se inyecta (`infer`) para poder probar todo con un modelo falso. Salida por trozos ya finales: la memoria no crece con la duración.

| Exporta | Qué hace |
|---|---|
| `SR` | — |
| `W` | — |
| `HOP` | — |
| `NFFT` | — |
| `FQ` | — |
| `T` | — |
| `STEMS` | — |
| `spec` | STFT de Demucs (`_spec`) de una ventana estéreo [L, R] de W muestras → Float32Array [4, FQ, T] (canal = c·2 + re/im). |
| `ispec` | — |
| `normalizeStats` | Media y desviación de la mezcla (mono) para normalizar como `demucs.separate`. |
| `windowsFor` | Cuántas ventanas hacen falta para `length` muestras. |
| `separate` | Separa `mix` ([L, R] Float32Array, SIN normalizar). `infer({ input: Float32Array(2·W), x: Float32Array(4·FQ·T) })` → { time: Float32Array(4·2·W), freq: Float32Array(4·4·FQ·T) } (con `direct`: solo `time`, y `x` llega null). `onChunk(Float32Array)` recibe audio final intercalado de 8 canales (batería L R, bajo L R, resto L R, voz L R), en orden y sin huecos. `shouldStop()` cancela entre ventanas. |

- **Depende de:** —
- **Lo usan:** `main/stems-worker.js`
- **Pruebas:** lógica `scripts/test-stems.js`

### `shared/structure.js`

**Dominio:** automix · **Líneas:** 109

Estructura de una pista a partir de su rejilla: energía por frase de 16 beats, fin de la intro, comienzo del outro y puntos de mezcla candidatos. Funciones puras; las usa el análisis y las pruebas.

| Exporta | Qué hace |
|---|---|
| `structure` | — |
| `beatEnergies` | Energía (RMS) de la señal filtrada a < 2 kHz: refleja el bombo y el bajo, no los hats. |
| `PHRASE_BEATS` | — |
| `STRONG` | — |

- **Depende de:** —
- **Lo usan:** `shared/analysis.js`
- **Pruebas:** lógica **sin prueba**

