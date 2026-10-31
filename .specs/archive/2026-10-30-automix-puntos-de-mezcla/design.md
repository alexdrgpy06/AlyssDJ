---
change: 2026-10-30-automix-puntos-de-mezcla
status: approved
rev: 1
approved_rev: 1
approved_hash: dcfd9551201f3c1429fec587d7688c9713879e6b4e04bae9fba0271a2f127729
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Design · automix-puntos-de-mezcla

## Enfoque
Dos piezas. (1) El análisis añade `mix` con la estructura de la pista. (2) Un módulo puro `renderer/mixplan.js` decide, con esos datos, **cuándo** salir, **dónde** entrar, **cuánto** dura y **qué pista** va después; `automix.js` solo lo aplica.

## Estructura (shared/analysis.js)
- Energía por beat: RMS de la banda grave+media en cada beat de la rejilla; por frase de 16 beats: media, normalizada 0–100 respecto a la mediana de la pista.
- `introEnd`: inicio de la primera frase con energía ≥ 60 % de la mediana. `outroStart`: inicio de la última frase de energía ≥ 60 % seguida solo de frases por debajo, o, si no cae la energía, la última frase que deje ≥ 32 beats hasta el final.
- `mixIn`: primer beat de la rejilla (inicio útil). `mixOut`: lista de candidatos `{ t, score }` en límites de frase: `outroStart` (mejor), los finales de frases de transición entre una frase fuerte y una floja (rotura) y, como último recurso, la frase final.
- Se guarda `analysis.mix = { version: 2, phraseBeats: 16, introEnd, outroStart, mixIn, mixOut: [...], phrases: [0..100], energy }`; `analysis.version` pasa a 2.

## mixplan.js (funciones puras)
- `planTransition(cur, next, cfg)` → `{ exitAt, enterAt, beats, seconds, style, tempo, warnings }`: `exitAt` = mejor candidato de `mixOut` que deje al menos `beats` de pista; duración en múltiplos de 4 beats a partir de `cfg.len`, recortada al tramo disponible; si no hay estructura, vuelve al final de la pista.
- `scoreTransition(cur, cand)` → número (menor es mejor): `3·|Δbpm %|` con doble/mitad, `+0/2/6` por tonalidad (misma o ±1 / relativa / incompatible), `+2·|Δenergía|/100`; `+100` si Δbpm > 8 %.
- `pickNext(cur, queue, pinned)`: ordena las listas por puntuación y respeta las fijadas.
- Límites: ajuste de pitch ±8 %; devolución del tempo en ≥ 12 s.

## Integración
- `automix.js`: `tick()` dispara en `cur.pos >= plan.exitAt` en lugar de `rem <= len + 1.2` cuando `cfg.optimalPoints`; la entrante arranca en `plan.enterAt`; tras cada cambio de cola o de pista que suena se recalcula el plan y se reordena con `pickNext`.
- Recalcular análisis viejos: si falta `mix`, `analysis:request(id, { file, force: true })` con el archivo guardado o local (sin descarga).
- UI: columnas BPM / Key / energía en la cola, "Δ +3.1 %" y avisos "salto de BPM", "mezcla en 3:12 · frase 24" en la tarjeta SUENA; marcas de entrada y salida en la vista general del deck.

## Decisiones
- **Frases de 16 beats:** es la unidad habitual de mezcla en música de baile; alinear a ella evita cortar frases a la mitad.
- **Puntuación simple y explicable:** pesos fijos visibles en el código, para ajustarlos con la escucha.
- **Sin estructura, se conserva el comportamiento actual:** nada se rompe con pistas no analizadas.

## Domain deltas
### automix
#### ADDED spec: Mezclar en puntos óptimos con el BPM siempre en cuenta
WHEN AutoMix prepara una transición THE SYSTEM SHALL salir de la pista que suena en su mejor punto (alineado a una frase, no necesariamente el final), entrar en el punto de entrada de la siguiente y durar compases enteros acotados al tramo disponible.
WHILE decide la siguiente pista THE SYSTEM SHALL puntuar las listas por BPM, tonalidad y energía y poner primero la mejor, respetando el orden que el usuario fijó a mano.
IF el salto de BPM supera el 8 % THEN THE SYSTEM SHALL preferir otra candidata y, si no la hay, mezclar largo con filtro sin forzar el tempo y avisar.
WHEN se iguala el tempo THE SYSTEM SHALL limitar el ajuste a ±8 % y devolver el tempo natural gradualmente.
#### ADDED design: Planificador de mezcla
`renderer/mixplan.js` (funciones puras: `planTransition`, `scoreTransition`, `pickNext`) decide salida, entrada, duración y orden; `automix.js` lo aplica en `tick()`; un análisis sin estructura se recalcula con el archivo ya guardado (`reuse`).
### analysis
#### ADDED spec: Estructura de la pista
WHEN una pista se analiza THE SYSTEM SHALL calcular frases de 16 beats con su energía, el fin de la intro, el comienzo del outro, un punto de entrada y puntos de salida candidatos.
WHEN el tempo detectado sea ambiguo (3:2 o 2:1) THE SYSTEM SHALL decidir con los golpes graves.
#### ADDED design: Estructura y tempo
`shared/structure.js` calcula la energía por beat (banda < 2 kHz) y por frase y deriva `introEnd`, `outroStart`, `mixIn` y `mixOut`; `analysis.mix` y `version: 2` se guardan con el análisis; `tempo()` afina cada candidato 3:2 y 2:1 y elige por la energía grave.
