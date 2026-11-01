---
change: 2026-11-01-automix-modo-salida
type: feature
domains: [automix, ui]
paths: [renderer/automix.js, renderer/mixplan.js, renderer/app.js, renderer/index.html, renderer/styles.css, scripts/**, docs/**, README.md, .github/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 15e68effc198a265c6d61162f361c3fc6436be55c5483bbec8797cbbd82acaa9
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Requirements · 2026-11-01-automix-modo-salida

## Contexto

El REA de Mixxx (AutoDJ: modos de transición `FullIntroOutro`, `FadeAtOutroStart`, `FixedFullTrack`, «Skip next» y barajar) mostró tres huecos en AutoMix: no se puede elegir **cuándo** sale la pista que suena (solo hay el interruptor «Mezclar en puntos óptimos»), la duración no se adapta al outro de la saliente y al intro de la entrante, y no hay forma rápida de saltar la pista que sigue ni de barajar la cola. El análisis ya guarda `introEnd`, `outroStart`, `mixIn` y los candidatos de salida de cada pista. Solo se toman ideas de Mixxx (GPL), nunca su código.

## Requisitos

### REQ-1: Modo de salida
THE SYSTEM SHALL ofrecer en el grupo Transición de AutoMix el selector «Salir» con cuatro modos, que sustituye al interruptor «Mezclar en puntos óptimos»:
- **Mejor punto** (por defecto): el comportamiento actual (salida candidata del análisis: frase de outro o rotura; si no hay, el final).
- **Outro y intro**: sale al empezar el outro de la pista que suena y la transición dura lo que dure el menor entre el resto de su outro y el intro de la entrante.
- **Inicio del outro**: sale al empezar el outro y la transición dura la duración elegida.
- **Final de la pista**: sale casi al final (el comportamiento actual con el interruptor apagado).
WHERE el usuario editó los puntos de salida de una pista THE SYSTEM SHALL seguir usando esos puntos en cualquier modo, como hasta ahora.
WHEN se abra la app con el ajuste anterior guardado THE SYSTEM SHALL traducirlo: «puntos óptimos» activado → Mejor punto; apagado → Final de la pista.
IF una pista no tiene outro marcado (sin análisis o sin BPM) THEN THE SYSTEM SHALL salir como en «Final de la pista» y avisarlo en la nota de la mezcla.

### REQ-2: Duración adaptada en «Outro y intro»
WHILE el modo es «Outro y intro» THE SYSTEM SHALL calcular la duración como el menor entre el outro restante de la saliente y el intro de la entrante (desde su punto de entrada hasta `introEnd`); si solo se conoce uno, usar ese; si no se conoce ninguno, usar la duración elegida.
THE SYSTEM SHALL mantener esa duración entre 4 y 48 segundos y no dejar que la transición pase del inicio del outro de la propia entrante.
THE SYSTEM SHALL mostrar en la barra de estado la duración que se usará en la mezcla pendiente.

### REQ-3: Saltar la siguiente
WHEN el usuario pulsa «Saltar siguiente» THE SYSTEM SHALL quitar de la cola la pista que sigue, de modo que la mezcla vaya a la que venía después, y avisar con su título.
WHILE hay una transición en curso o la cola tiene menos de dos pistas THE SYSTEM SHALL mantener el botón deshabilitado.
THE SYSTEM SHALL ofrecer ese botón también en la vista Automix.

### REQ-4: Barajar la cola
WHEN el usuario pulsa «Barajar» THE SYSTEM SHALL reordenar al azar las pistas no fijadas de la cola, sin mover las fijadas ni la que ya se está preparando, y permitir «Deshacer» con el botón existente.
IF «Orden automático» está activado THEN THE SYSTEM SHALL desactivarlo al barajar y decirlo, para que el orden elegido no se rehaga solo.

### REQ-5: Sin regresiones
THE SYSTEM SHALL mantener el resto de AutoMix (estilos, igualar tempo y fase, cola ordenada, puntos editados, radio, sugeridas) y los atajos, con pruebas, documentación y capturas actualizadas.

## Fuera de alcance

- Los modos de Mixxx que saltan el silencio (`FixedSkipSilence` y `FixedStartCenterSkipSilence`).
- «Fade now» inmediato (ya existe «Mezclar ahora», que busca el mejor punto cercano).
- Cambiar cómo se elige la siguiente pista o la puntuación de transiciones.
