---
domain: audio
paths: [shared/fx.js, shared/dsp-chain.js, renderer/deck.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/fxpad.js, main/settings.js, scripts/**, docs/**, README.md, .github/**]
last_change: 2026-11-03-stems-gpu-automaticos
---
# audio · spec

## Cadena de tres efectos por deck

THE SYSTEM SHALL ofrecer por deck tres ranuras de efecto en serie con tipo (eco, reverb, flanger, gate, phaser, crush, filtro), interruptor, cantidad y P; apagadas o con cantidad 0 dejan pasar el audio sin alterarlo y sin gastar procesador (el efecto solo se monta mientras la ranura está activa); el cambio de tipo hace un fundido de 30 ms.

## Parámetro P y sincronía

THE SYSTEM SHALL asignar a P: eco → división ¼/½/¾/1 beat y realimentación; reverb → tamaño (dos salas mezcladas); flanger y phaser → periodo 16…1 beats; gate → 1/½/¼ beat; crush → 12…3 bits; filtro → corte 120 Hz…18 kHz; y seguir el BPM del deck en eco, gate, flanger y phaser.

## Resonancia del filtro de canal

THE SYSTEM SHALL añadir `res` (0–1 → Q 0,707–8; 0,07 ≈ el Q 1,2 anterior) al filtro bipolar del canal, con ganancia compensadora por encima de ese Q y centro neutro con cualquier valor.

## Scratch en el plato

WHEN el usuario pulsa el plato de un deck THE SYSTEM SHALL detener la pista como un vinilo y, mientras lo arrastra, moverla con su mano (también hacia atrás) a razón de 1,8 s de audio por vuelta; al soltar SHALL reanudar y, con SYNC, realinear la fase.
IF no hay buffer decodificado (más de 15 min o sin archivo) THEN THE SYSTEM SHALL usar frenado y arranque con rampa y seek al arrastrar, avisando una vez.

## Preescucha sin interferir con la mezcla

WHILE no hay salida de auriculares configurada y un deck suena THE SYSTEM SHALL parar la preescucha y avisarlo, para que nunca suene por el master a la vez que una mezcla.

## Stems manuales

WHEN el usuario separa una pista local THE SYSTEM SHALL procesarla en segundo plano, de una en una y con prioridad baja, en un proceso hijo que guarda un FLAC de 8 canales (batería, bajo, resto, voz; L/R) con el modelo HTDemucs, sin cortar ni distorsionar lo que suena en los decks.
WHEN una pista con stems se activa en un deck THE SYSTEM SHALL reproducir el FLAC con una matriz de cuatro ganancias, permitiendo silenciar o aislar cada stem con transición de ≈ 15 ms, y conservar tempo, posición, loops, cues, EQ, filtro, efectos y keylock del deck.

## Stems en GPU con caída a CPU

WHEN hay un proveedor de GPU candidato en la plataforma (DirectML en Windows, CoreML en macOS arm64, CUDA o WebGPU en Linux) THE SYSTEM SHALL sondear una ventana sintética en ese proveedor y en CPU y usar la GPU solo si su salida coincide (SNR ≥ 40 dB) y es más rápida; IF el proveedor falla o su proceso muere THEN THE SYSTEM SHALL repetir la pista en CPU, marcar el dispositivo como malo hasta que cambie la versión de la app o del modelo e informar.

## Cambio sin salto a los stems

WHEN el usuario pulsa un stem de una pista con stems listos THE SYSTEM SHALL activarlos con el silencio o solo ya aplicado en una sola acción, con un fundido cruzado lineal de 40 ms desde la pista completa; WHEN no queda ningún stem silenciado o aislado THE SYSTEM SHALL volver a la pista completa con el mismo fundido.
