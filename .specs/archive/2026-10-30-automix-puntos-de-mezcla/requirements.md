---
change: 2026-10-30-automix-puntos-de-mezcla
type: feature
domains: [automix, analysis]
paths: [shared/analysis.js, renderer/mixplan.js, renderer/automix.js, renderer/app.js, renderer/deck.js, renderer/waveform.js, renderer/index.html, renderer/styles.css, main/analyzer.js, scripts/**, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 09cf5790833413b221e020dd37609735654c720da7e706a365cc1d39a1af9e2e
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Requirements · automix-puntos-de-mezcla

## Contexto
AutoMix empieza la transición cuando faltan `duración + 1 s` para el final de la pista y toma como siguiente la primera de la cola, sin mirar cuánto cambia el tempo. Un DJ mezcla en los puntos donde la música lo permite (al empezar el outro o en una frase concreta, no necesariamente al final) y evita saltos bruscos de tempo, tonalidad o energía. Tras el análisis ya se conocen el BPM y la rejilla de cada pista; falta usar la estructura para elegir cuándo y con qué pista mezclar.

## Requisitos

### REQ-1: Estructura en el análisis
WHEN una pista se analiza THE SYSTEM SHALL calcular su estructura en frases de 16 beats alineadas a la rejilla (energía por frase, fin de la intro, comienzo del outro y puntos de salida candidatos) y guardar un punto de entrada y puntos de salida sugeridos junto al análisis.

### REQ-2: Mezclar en el punto de salida
WHEN AutoMix prepara una transición y la pista que suena tiene puntos de mezcla THE SYSTEM SHALL iniciarla en su mejor punto de salida (alineado a una frase), aunque no sea el final de la pista, y hacer entrar la siguiente en su punto de entrada.

### REQ-3: Duración en compases
THE SYSTEM SHALL dar a cada transición una duración de compases enteros, acotada por la duración elegida por el usuario y por el tramo disponible entre el punto de salida y el final de la pista que suena, alineando la fase de la entrante al beat.

### REQ-4: El BPM siempre cuenta
WHILE AutoMix decide la siguiente pista THE SYSTEM SHALL puntuar las pistas listas por diferencia de BPM (también a doble o mitad de tempo), compatibilidad de tonalidad y salto de energía, y poner primero la mejor, respetando las pistas que el usuario fijó con "a continuación".

### REQ-5: Sin saltos bruscos
IF el salto de BPM entre la pista que suena y una candidata supera el 8 % THEN THE SYSTEM SHALL preferir otra candidata lista y, si no la hay, hacer una transición larga con filtro sin forzar el tempo y avisarlo en la cola.

### REQ-6: Tempo gradual
WHEN se iguala el tempo THE SYSTEM SHALL limitar el ajuste a ±8 % y, tras la mezcla, devolver el tempo natural de forma gradual durante al menos 12 s.

### REQ-7: Análisis anteriores
WHEN una pista tiene un análisis sin estructura THE SYSTEM SHALL recalcularlo antes de usarla en AutoMix, sin volver a descargarla.

### REQ-8: Visible y desactivable
THE SYSTEM SHALL mostrar por pista de la cola su BPM, tonalidad y energía, la diferencia de BPM con la que suena, avisos de salto y el punto de mezcla planeado, y SHALL ofrecer un interruptor "Mezclar en puntos óptimos", activado por defecto, que apagado mezcla al final como hasta ahora.

## Fuera de alcance
- Detección de voces o letras, y mezcla armónica con cambio de tono.
- Rejillas de tempo variable.
- Aprender del gusto del usuario.
