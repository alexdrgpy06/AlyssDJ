---
change: 2026-11-03-automix-entrada-inteligente
type: feature
domains: [automix]
paths: [renderer/mixplan.js, renderer/automix.js, renderer/recipes.js, renderer/mixeditor.js, shared/structure.js, shared/analysis.js, scripts/test-mix-*.js, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: e2256c88a007002e13bc43ad68569586fd1a3f8542bafb2fb563f1b493f2c368
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-automix-entrada-inteligente

## Contexto

Alejandro quiere mejorar el **punto de inicio de la pista que entra** («next in mix»). Hoy `planTransition` y `planNearest` usan `mixEdit.in` o `mix.mixIn` (primer compás con energía) o el offset de la rejilla; casi siempre la siguiente empieza en su intro, aunque el mejor punto pueda ser otro (la primera frase con voz, el primer drop, un punto con la misma energía que el que sale). El editor de puntos ya permite fijar a mano `in` y `out`; este cambio mejora la **elección automática** y la hace visible.

## Requisitos

### REQ-1: Candidatos de entrada
WHEN AutoMix prepara una transición THE SYSTEM SHALL evaluar varios puntos de entrada de la pista que sigue (inicio de la intro, inicio de la primera frase con energía, primer drop, y los marcados por el usuario) alineados a frase, y elegir el de mejor puntuación.

### REQ-2: Puntuación coherente
THE SYSTEM SHALL puntuar cada punto de entrada según la energía y la tonalidad relativas al tramo de salida, la distancia de BPM, que el tramo de entrada tenga la longitud pedida sin pasarse del final, y que no entre en medio de una frase.

### REQ-3: Lo del usuario manda
WHEN la pista siguiente tiene un punto de entrada editado a mano THE SYSTEM SHALL usarlo tal cual, sin sustituirlo por uno automático.

### REQ-4: Entrada visible antes de mezclar
THE SYSTEM SHALL mostrar en la tarjeta «SIGUE» de la vista de AutoMix el punto de entrada elegido (tiempo y compás) con una línea sobre la onda de la pista, y WHEN el usuario lo mueve THE SYSTEM SHALL guardarlo como punto editado de esa pista.

### REQ-5: Motivo en una frase
THE SYSTEM SHALL explicar en una frase por qué se eligió ese punto («entra con la primera voz, 16 compases», «salta la intro larga»).

### REQ-6: «Mezclar ahora» y «Siguiente» coherentes
WHEN el usuario pulsa «Mezclar ahora» o «Siguiente» THE SYSTEM SHALL usar el mismo criterio de entrada, con duración corta si hace falta, y nunca empezar la entrante en silencio ni en un corte.

### REQ-7: Sin análisis, comportamiento seguro
IF la pista siguiente no está analizada THEN THE SYSTEM SHALL entrar por el inicio de la pista como hasta ahora y avisarlo en la tarjeta.

## Fuera de alcance

- Cambiar el punto de salida de la pista que suena (ya cubierto por «modo de salida»).
- Mezclar por stems.
