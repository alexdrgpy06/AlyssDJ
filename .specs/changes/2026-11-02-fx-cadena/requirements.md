---
change: 2026-11-02-fx-cadena
type: feature
domains: [ui, audio]
paths: [shared/fx.js, shared/dsp-chain.js, renderer/deck.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/fxpad.js, main/settings.js, scripts/**, docs/**, README.md, .github/**]
status: approved
rev: 1
approved_rev: 1
approved_hash: e4478b7a8a99487e81683aef1d750af034c80ff927e384aa22c663906f2787b5
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-fx-cadena

## Contexto

Pedido de Alejandro: «mejorar todo el tema de filtros y FX», con la versatilidad de djay (REA del 2026-11-01: hasta 3 efectos en cadena por deck, XY pad, Instant FX, Crossfader Fusion). Hoy cada deck tiene **un** efecto a la vez (eco, reverb, flanger o gate) con una sola perilla de cantidad (`shared/fx.js`) y el filtro es una perilla que barre pasa-bajos/pasa-altos sin resonancia ajustable. Este cambio mejora los efectos y el filtro y deja el motor listo para que `automix-fx-cues` los automatice (rampas programadas). Solo se toman ideas de djay a nivel público; no hay código ni recursos suyos.

## Requisitos

### REQ-1: Cadena de tres efectos por deck
THE SYSTEM SHALL ofrecer en cada deck una cadena de tres ranuras de efecto en serie (1 → 2 → 3), cada una con su tipo, interruptor, cantidad (*wet*, 0–1) y un segundo parámetro propio (*P*, 0–1).
THE SYSTEM SHALL ofrecer los tipos Eco, Reverb, Flanger, Gate, **Phaser**, **Crush** (reducción de bits) y **Filtro** (pasa-bajos resonante barrido), y permitir el mismo tipo en varias ranuras.
WHILE una ranura está apagada o su cantidad es 0 THE SYSTEM SHALL dejar pasar el audio sin alterarlo.
WHEN se cambia el tipo, el interruptor o los parámetros de una ranura THE SYSTEM SHALL aplicarlo sin chasquidos ni cortes del audio.
THE SYSTEM SHALL conservar el comportamiento actual por defecto: la ranura 1 con Eco, apagada, cantidad 0,5.

### REQ-2: Parámetro P por tipo
THE SYSTEM SHALL asignar a P un significado por tipo: Eco → división en beats (¼, ½, ¾, 1) con realimentación acorde; Reverb → tamaño; Flanger → velocidad; Gate → división rítmica; Phaser → velocidad; Crush → bits; Filtro → frecuencia de corte.
THE SYSTEM SHALL mantener la sincronía con el BPM del deck en Eco, Gate, Flanger y Phaser.

### REQ-3: XY pad
THE SYSTEM SHALL ofrecer en cada deck un pad XY táctil/ratón cuyo eje X controla la cantidad y cuyo eje Y controla P de la ranura seleccionada.
WHEN el usuario arrastra en el pad THE SYSTEM SHALL actualizar la ranura en vivo y activarla mientras mantiene pulsado.
WHERE el modo «Mantener» está activo THE SYSTEM SHALL apagar la ranura al soltar (efecto instantáneo); si no, la deja como quedó.
WHERE el pad tiene el foco THE SYSTEM SHALL permitir moverlo con las flechas y exponer sus valores con `role="slider"` y texto accesible.

### REQ-4: Filtro con resonancia
THE SYSTEM SHALL ofrecer en el mezclador de cada deck un control de **resonancia** del filtro del canal (Q de 0,7 a 8) además de la perilla de barrido existente.
THE SYSTEM SHALL mantener el barrido actual (izquierda pasa-bajos, derecha pasa-altos, centro neutro) y el valor por defecto de resonancia actual.
WHEN la resonancia sube THE SYSTEM SHALL evitar saturaciones audibles (ganancia limitada).

### REQ-5: Automatizable y controlable
THE SYSTEM SHALL exponer por deck una interfaz de código `fxSet(slot, {type,on,wet,p})` y `fxRamp(slot, {wet,p}, seconds)` para cambiar parámetros al instante o con una rampa lineal, que usará el AutoMix; la interfaz respeta los mismos límites y no deja valores fuera de rango.
THE SYSTEM SHALL registrar los controles nuevos (interruptor, cantidad y P de cada ranura, resonancia) para MIDI learn.
THE SYSTEM SHALL recordar la cadena de cada deck entre sesiones.
WHEN una pista nueva se carga en un deck THE SYSTEM SHALL conservar su cadena.

### REQ-6: Ajustes y compatibilidad
THE SYSTEM SHALL añadir a Ajustes la sección **Efectos y filtros** con: «Efectos instantáneos (mantener)» (por defecto activo), «Recordar la cadena entre sesiones» (por defecto activo) y «Resonancia del filtro por defecto»; con «Restablecer sección» y entrada en el buscador.
THE SYSTEM SHALL conservar el mapeo MIDI de los controles existentes (`fxOn`, `fxWet`, tipos) apuntando a la ranura 1.
IF el ajuste «recordar» está apagado THEN THE SYSTEM SHALL empezar cada sesión con la cadena por defecto.

### REQ-7: Verificación y documentación
THE SYSTEM SHALL cubrir con pruebas automáticas el motor de efectos (paso limpio con ranuras apagadas, cada tipo altera la señal, rampas, límites, ausencia de NaN), el pad, los ajustes y el MIDI de los controles; y actualizar la documentación y las capturas.

## Fuera de alcance

- Colocar efectos o filtros automáticamente en AutoMix (cambio `automix-fx-cues`).
- Crossfader Fusion, efectos de terceros (VST/AU) y efectos en el sampler o la salida maestra.
- Separación de pistas (stems).
- Más de 3 ranuras o enrutado en paralelo.
