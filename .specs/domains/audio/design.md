---
domain: audio
paths: [shared/fx.js, shared/dsp-chain.js, renderer/deck.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/fxpad.js, main/settings.js, scripts/**, docs/**, README.md, .github/**]
last_change: 2026-11-02-fx-cadena
---
# audio · design

## fx.js, dsp-chain.js y mensaje mix

`shared/fx.js` (`create(ctx).set({slots,bpm})`, `get()`, `mounted()`, `TYPES`, `SLOTS`); `shared/dsp-chain.js` aplica `m.fx` y `m.res` y añade el nodo `comp` tras el filtro; el mensaje `mix` lleva `fx: [{type,on,wet,p}×3]`, `bpm` y `res` en lugar de `fxType/fxWet/fxDiv`.
