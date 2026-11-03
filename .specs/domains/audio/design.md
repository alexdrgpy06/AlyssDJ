---
domain: audio
paths: [shared/fx.js, shared/dsp-chain.js, renderer/deck.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/fxpad.js, main/settings.js, scripts/**, docs/**, README.md, .github/**]
last_change: 2026-11-02-stems-manuales
---
# audio · design

## fx.js, dsp-chain.js y mensaje mix

`shared/fx.js` (`create(ctx).set({slots,bpm})`, `get()`, `mounted()`, `TYPES`, `SLOTS`); `shared/dsp-chain.js` aplica `m.fx` y `m.res` y añade el nodo `comp` tras el filtro; el mensaje `mix` lleva `fx: [{type,on,wet,p}×3]`, `bpm` y `res` en lugar de `fxType/fxWet/fxDiv`.

## Procesador de scratch

`shared/scratch.js` y `scratch-worklet.js` leen un buffer decodificado con posición fraccionaria y velocidad con signo; `scratch-math.js` calcula la velocidad del arrastre; `deck-engine` expone las operaciones `scratch` prepare, hold, move y release.

## Motor de stems

`shared/stems-dsp.js` (STFT/iSTFT y ventanas por solape), `main/stems-worker.js` (decodifica con ffmpeg, ejecuta onnxruntime-node sin arena de memoria y codifica por trozos) y la operación `stems` de `shared/deck-engine.js` (segundo `<audio>` → `ChannelSplitter(8)` → cuatro mezcladores estéreo → ganancias → cadena del deck).
