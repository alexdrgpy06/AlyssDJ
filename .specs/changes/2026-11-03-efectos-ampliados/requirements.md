---
change: 2026-11-03-efectos-ampliados
type: feature
domains: [audio, ui]
paths: [shared/fx.js, shared/dsp-chain.js, renderer/fxchain.js, renderer/fxpad.js, renderer/fxpanel.js, renderer/fxcues.js, renderer/deck.js, docs/**, scripts/test-fx*.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 0cbc54a3d130ed3646b06e45394bfefac5782c237c50753f1093c9e73b7b2de1
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-efectos-ampliados

## Contexto

La cadena de efectos (`shared/fx.js`, v0.8.0) trae siete tipos — eco, reverb, flanger, gate, phaser, crush y filtro — con 3 ranuras por deck, un pad XY y los gestos de AutoMix. Alejandro pide **más efectos y más opciones**. Referencias: djay y Mixxx (nombres y comportamiento públicos; sin copiar código GPL).

## Requisitos

### REQ-1: Más tipos de efecto
THE SYSTEM SHALL añadir, además de los siete actuales, estos efectos sincronizables al BPM: **delay de cinta** (eco con saturación y filtro en la repetición), **bitcrusher/reducer** de frecuencia de muestreo, **stutter/beat-repeat**, **reverse/brake** (frenazo de vinilo), **transformer** (corte rítmico por beats), **distorsión/saturación** y **pitch-shift/vocal** ligero.

### REQ-2: Parámetros útiles
THE SYSTEM SHALL ofrecer en cada efecto, además de Wet, un segundo parámetro propio (tiempo, color, feedback o profundidad según el efecto) y, cuando proceda, su división de beat (1, ½, ¼, ⅛ o triplete).

### REQ-3: Presets
THE SYSTEM SHALL ofrecer presets de ranura (por ejemplo «Eco largo», «Barrido de filtro», «Roll de redoble») y permitir guardar los propios y borrarlos.

### REQ-4: Instant FX
WHEN el usuario mantiene pulsada una tecla o pad de efecto THE SYSTEM SHALL aplicar el efecto con atenuación suave de entrada y salida, y soltarlo al soltar la tecla, sin chasquidos.

### REQ-5: Orden y rutas
THE SYSTEM SHALL permitir cambiar el orden de las ranuras de un deck y asignarlas a un deck, al master o a ambos, con vista del orden de la cadena.

### REQ-6: Calidad de audio
THE SYSTEM SHALL mantener el audio sin cortes, sin clipping al subir el Wet y sin saltos al cambiar de efecto, y SHALL probarlo con las autopruebas de audio sintético.

### REQ-7: AutoMix y efectos
WHEN un tipo de efecto nuevo es adecuado para una receta de transición (por ejemplo, freno al final de una caída) THE SYSTEM SHALL ofrecerlo a las recetas de AutoMix respetando el ajuste de nivel de efectos y las ranuras libres.

### REQ-8: Coste de CPU acotado
THE SYSTEM SHALL no usar más de un 5 % adicional de CPU por efecto activo en un equipo de referencia, y SHALL desactivar los nodos de un efecto cuando no esté en uso.

## Fuera de alcance

- Efectos VST/AU de terceros.
- Efectos por stem (por ejemplo, eco solo a la voz): cambio aparte.
