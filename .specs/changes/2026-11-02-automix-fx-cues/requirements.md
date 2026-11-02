---
change: 2026-11-02-automix-fx-cues
type: feature
domains: [automix, analysis, ui]
paths: [shared/structure.js, renderer/mixplan.js, renderer/fxcues.js, renderer/automix.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/deck.js, main/settings.js, scripts/**, docs/**, README.md, .github/**]
status: approved
rev: 2
approved_rev: 2
approved_hash: 9a6e238accbd912f47542ee2787722168e82bf5484b529ecd823a70d4acd6761
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-automix-fx-cues

## Contexto

Pedido de Alejandro: que el análisis vea **cues de cómo aplicar cosas interesantes a ciertos tiempos**, «como un DJ real», en AutoMix. Hoy AutoMix solo mueve el crossfader, el corte de graves o un filtro durante la transición (`renderer/automix.js`), y el análisis guarda por pista la energía de cada frase de 16 beats (`mix.phrases`), el fin de la intro, el inicio del outro y los puntos de salida. Con la cadena de efectos de la v0.8.0 (`Deck.fxSet`/`fxRamp`) ya se pueden automatizar efectos. Este cambio deriva de esa energía los momentos musicales (subida, caída, rotura) y hace que AutoMix los use con movimientos típicos de DJ (eco de salida, riser, reverb en una rotura). Todo se calcula con los análisis ya guardados: no hace falta volver a analizar.

## Requisitos

### REQ-1: Cues musicales derivados del análisis
THE SYSTEM SHALL derivar de la energía por frase de una pista una lista de cues `{ t, kind, strength }` ordenada por tiempo, alineados al comienzo de una frase de la rejilla, con tres tipos: **subida** (≥ 2 frases seguidas con la energía creciendo al menos un 25 % en total), **caída** (la frase donde la energía salta ≥ 30 % sobre la anterior, normalmente tras una subida o una rotura) y **rotura** (la frase donde la energía cae ≥ 30 % y queda así ≥ 1 frase).
IF la pista no tiene BPM, rejilla o menos de 4 frases THEN THE SYSTEM SHALL devolver una lista vacía y AutoMix se comportará como hasta ahora.
THE SYSTEM SHALL calcular los cues a partir de los análisis ya guardados, sin repetir el análisis, y dar el mismo resultado para la misma entrada.

### REQ-2: Nivel de efectos de AutoMix
THE SYSTEM SHALL ofrecer en el grupo Transición de AutoMix el selector **Efectos** con tres niveles: **Apagado** (comportamiento actual), **Sutil** (por defecto: solo movimientos de transición) y **Marcado** (además, movimientos sobre los cues durante la pista).
THE SYSTEM SHALL guardar el nivel con el resto de la configuración de AutoMix y aplicarlo desde la siguiente mezcla.

### REQ-3: Movimientos de transición (Sutil y Marcado)
WHILE hay una transición y el nivel no es Apagado THE SYSTEM SHALL aplicar un **eco de salida** a la pista saliente: en el último cuarto de la transición sube la cantidad de un eco sincronizado (de 0 a 0,6) y, al terminar la transición, deja que la cola del eco suene hasta 4 s y apaga la ranura.
WHERE el estilo de la transición es Fundido o Bass swap y la pista saliente tiene una rotura dentro de la ventana de la transición THE SYSTEM SHALL lanzar una **reverb de rotura**: sube la cantidad de una reverb durante esa frase y la apaga en el inicio de la siguiente.
THE SYSTEM SHALL no aplicar el eco de salida cuando la transición dura menos de 4 s o es «Mezclar ahora» sin salida a tiempo.

### REQ-4: Movimientos sobre cues (solo Marcado)
WHILE el nivel es Marcado y suena una pista (no hay transición) THE SYSTEM SHALL, ante una **subida** de la pista que suena, subir de 0 a 0,5 la cantidad de un phaser durante la subida y, en la **caída** que la sigue, apagarlo de golpe en el primer tiempo de la caída.
WHILE el nivel es Marcado THE SYSTEM SHALL, en una **rotura** de la pista que suena (fuera de transición), lanzar una reverb de rotura como en REQ-3.
THE SYSTEM SHALL aplicar como máximo un movimiento sobre cues a la vez y dejar al menos una frase entre uno y el siguiente.

### REQ-5: Seguridad y prioridad del usuario
THE SYSTEM SHALL usar solo ranuras de efecto libres (apagadas) del deck correspondiente y no tocar nunca una ranura que el usuario tenga encendida.
IF no hay ninguna ranura libre THEN THE SYSTEM SHALL omitir el movimiento y registrarlo en la nota de la mezcla.
WHEN el usuario cambia a mano una ranura que AutoMix está usando THE SYSTEM SHALL soltarla de inmediato y no volver a tocarla en ese movimiento.
WHEN AutoMix se detiene, se salta la pista, se cancela la mezcla o el movimiento termina THE SYSTEM SHALL devolver las ranuras que usó a su estado anterior (tipo, cantidad, P y apagadas) y no dejar efectos colgados.

### REQ-6: Visibilidad
THE SYSTEM SHALL mostrar en la nota de la mezcla y en la vista Automix el movimiento en curso («eco de salida», «riser», «reverb de rotura») y, en la barra de la transición, el nivel elegido.
WHEN el nivel es Apagado THE SYSTEM SHALL no mostrar ni aplicar ningún movimiento.

### REQ-7: Verificación y documentación
THE SYSTEM SHALL cubrir con pruebas automáticas la detección de cues (sintéticos y casos límite), el plan de movimientos (tiempos, niveles, ranuras libres), la ejecución y la limpieza de AutoMix, los ajustes y la interfaz; y actualizar la documentación y las capturas.

## Fuera de alcance

- Editar a mano los cues o verlos sobre la forma de onda (se pueden añadir después).
- Efectos en el sampler, en la salida maestra o en decks que no son los de AutoMix.
- Aprender del gusto del usuario o variar al azar los movimientos.
- Vídeo o visual en la vista Automix.
- Stems o separación de pistas.
