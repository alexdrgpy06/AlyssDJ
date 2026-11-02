---
domain: audio
paths: [shared/fx.js, shared/dsp-chain.js, renderer/deck.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/fxpad.js, main/settings.js, scripts/**, docs/**, README.md, .github/**]
last_change: 2026-11-02-fx-cadena
---
# audio · spec

## Cadena de tres efectos por deck

THE SYSTEM SHALL ofrecer por deck tres ranuras de efecto en serie con tipo (eco, reverb, flanger, gate, phaser, crush, filtro), interruptor, cantidad y P; apagadas o con cantidad 0 dejan pasar el audio sin alterarlo y sin gastar procesador (el efecto solo se monta mientras la ranura está activa); el cambio de tipo hace un fundido de 30 ms.

## Parámetro P y sincronía

THE SYSTEM SHALL asignar a P: eco → división ¼/½/¾/1 beat y realimentación; reverb → tamaño (dos salas mezcladas); flanger y phaser → periodo 16…1 beats; gate → 1/½/¼ beat; crush → 12…3 bits; filtro → corte 120 Hz…18 kHz; y seguir el BPM del deck en eco, gate, flanger y phaser.

## Resonancia del filtro de canal

THE SYSTEM SHALL añadir `res` (0–1 → Q 0,707–8; 0,07 ≈ el Q 1,2 anterior) al filtro bipolar del canal, con ganancia compensadora por encima de ese Q y centro neutro con cualquier valor.
