---
domain: audio
paths: [shared/fx.js, shared/dsp-chain.js, renderer/deck.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/fxpad.js, main/settings.js, scripts/**, docs/**, README.md, .github/**]
last_change: 2026-11-03-efectos-ampliados
---
# audio · design

## fx.js, dsp-chain.js y mensaje mix

`shared/fx.js` (`create(ctx).set({slots,bpm})`, `get()`, `mounted()`, `TYPES`, `SLOTS`); `shared/dsp-chain.js` aplica `m.fx` y `m.res` y añade el nodo `comp` tras el filtro; el mensaje `mix` lleva `fx: [{type,on,wet,p}×3]`, `bpm` y `res` en lugar de `fxType/fxWet/fxDiv`.

## Procesador de scratch

`shared/scratch.js` y `scratch-worklet.js` leen un buffer decodificado con posición fraccionaria y velocidad con signo; `scratch-math.js` calcula la velocidad del arrastre; `deck-engine` expone las operaciones `scratch` prepare, hold, move y release.

## Motor de stems

`shared/stems-dsp.js` (STFT/iSTFT y ventanas por solape), `main/stems-worker.js` (decodifica con ffmpeg, ejecuta onnxruntime-node sin arena de memoria y codifica por trozos) y la operación `stems` de `shared/deck-engine.js` (segundo `<audio>` → `ChannelSplitter(8)` → cuatro mezcladores estéreo → ganancias → cadena del deck).

## Variantes de modelo y proceso hijo

`main/stems-device.js` (`DeviceSelector`, `candidates`, `hasCuda`) decide y recuerda el dispositivo en `userData/stems/device.json`; `main/stems.js` define `MODELS = { cpu, gpu }` y `ModelSet`; la variante `gpu` (`mix` → `stems`, STFT dentro del grafo) se separa con `separate(..., { direct: true })`; el sondeo y la separación corren en `main/stems-worker.js` (mensajes `probe` y `start` con `provider` y `variant`).

## Constructores nuevos en shared/fx.js

`BUILD` gana `tape`, `reducer`, `stutter`, `brake`, `transformer`, `drive` y `pitch`; `loop(ctx, fn)` agenda por ciclo con anticipación (temporizador en tiempo real, todo de una vez con `OfflineAudioContext`); cada constructor puede devolver `stop()` que `dispose` llama; `setP(p, beat, t, d)` recibe la división.
