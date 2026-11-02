---
change: 2026-11-02-automix-recetas-dj
type: feature
domains: [automix]
paths: [renderer/mixplan.js, renderer/automix.js, renderer/fxcues.js, renderer/views.js, renderer/app.js, scripts/test-automix-*.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: c86c249eb795d73c10fa8745466ea344b09e00b6f4ccfb8660a73d67708741a4
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-automix-recetas-dj

## Contexto

Los estilos del AutoMix son hoy tres gestos fijos: «bass swap» corta el grave entrante y lo intercambia justo al 50 % del tiempo, «filtro» barre un filtro durante toda la mezcla y «fundido» solo mueve el crossfader. Los efectos (eco de salida, reverb de rotura, riser) se disparan por porcentaje de progreso o por una posición suelta. Un DJ no mezcla así: ordena los gestos sobre la rejilla (compases y frases de 16 tiempos), cambia el grave en la línea de frase, usa el eco o el corte seco cuando el tempo o la tonalidad no encajan, y aprovecha roturas y caídas para entrar. Todo eso se puede deducir del análisis que ya existe (BPM, rejilla, energía por frase, cues de subida, caída y rotura, intro y outro, tonalidad Camelot).

## Requisitos

### REQ-1: Cada estilo es una receta sobre la rejilla
THE SYSTEM SHALL describir cada transición como una línea de tiempo de gestos (EQ, filtro, volumen/crossfader, efecto) cuyos instantes de inicio y fin caen en tiempos de la rejilla de la pista saliente, con los cambios mayores en el inicio de compás o de frase.

### REQ-2: Bass swap en la línea de frase
WHEN el estilo es «bass swap» THE SYSTEM SHALL entrar con el grave entrante cortado, mezclar medios y agudos durante la mezcla, y hacer el intercambio de graves en un inicio de frase de la saliente (no en un porcentaje del tiempo), dejando al menos un compás de ambos graves limpios antes y después.

### REQ-3: Filtro con barrido por frases
WHEN el estilo es «filtro» THE SYSTEM SHALL barrer el paso alto de la saliente en sus últimas 8 o 16 pulsaciones y abrir el de la entrante desde la entrada, cerrando el barrido en el inicio de la frase donde la entrante toma el grave.

### REQ-4: Corte en la caída
WHEN la saliente tiene una rotura o final de frase y la entrante empieza en una caída o en su primera frase con energía alta THE SYSTEM SHALL poder hacer un corte seco en el inicio de compás, con cola de eco o reverb de la saliente, en lugar de un fundido largo.

### REQ-5: Eco de salida sincronizado
WHEN una transición usa eco de salida THE SYSTEM SHALL ajustar el retardo a una fracción del pulso (1/2 o 3/4) y lanzarlo en el primer tiempo del último compás de la saliente, cortando el canal en la línea de compás y dejando morir la cola.

### REQ-6: Elección automática según el análisis
WHEN el estilo es «auto» THE SYSTEM SHALL elegir la receta por pista a pista: bass swap con BPM compatible, tonalidad compatible y outro e intro largos; filtro con salto de BPM moderado; eco de salida o corte con salto de BPM grande, tonalidad en conflicto o sin rejilla; fundido simple si no hay análisis. La elección y su motivo SHALL verse en la nota de la mezcla.

### REQ-7: Los efectos respetan el nivel
IF el nivel de efectos es «apagado» THEN THE SYSTEM SHALL ejecutar solo los gestos de EQ y filtro del estilo; con «sutil» además el eco de salida y la reverb de rotura; con «marcado» también el riser en subidas.

### REQ-8: Receta visible
WHILE hay una mezcla planificada o en curso THE SYSTEM SHALL mostrar en la vista de AutoMix los gestos con su instante (compás de la mezcla) y cuál se está ejecutando.

### REQ-9: Comprobación sin audio
THE SYSTEM SHALL poder generar y validar la receta con una función pura (sin DOM ni audio), de modo que las pruebas comprueben que los gestos caen en la rejilla y que la elección automática cumple REQ-6.

## Fuera de alcance

- Nuevos efectos de audio (solo se usan los existentes: eco, reverb, phaser, filtro, EQ).
- Scratch o backspin (cambio `jog-turntable`).
- Aprender el gusto del usuario o estilos por género.
