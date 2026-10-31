---
change: 2026-10-30-automix-puntos-de-mezcla
status: draft
rev: 1
---
# Tasks · automix-puntos-de-mezcla

- [x] 1.1 Estructura en el análisis: energía por frase, fin de intro, comienzo del outro, puntos de salida y de entrada (REQ-1) @coder [verify: node scripts/test-mix-points.js structure]
- [x] 1.2 Planificador de transición: punto de salida, entrada, duración en compases acotada y vuelta al final sin estructura (REQ-2, REQ-3) @coder [verify: node --experimental-default-type=module scripts/test-mix-points.js plan]
- [x] 1.3 Puntuación y orden de candidatos por BPM, tonalidad y energía, límite de salto de BPM y pistas fijadas (REQ-4, REQ-5) @coder [verify: node --experimental-default-type=module scripts/test-mix-points.js pick]
- [x] 1.4 Motor: disparo en el punto de salida, entrada en su punto, transición larga con filtro ante saltos, límite de pitch y tempo gradual (REQ-2, REQ-3, REQ-5, REQ-6) @coder [verify: node --experimental-default-type=module scripts/test-mix-points.js engine]
- [x] 1.5 Recalcular análisis sin estructura sin volver a descargar (REQ-7) @coder [verify: node scripts/test-mix-points.js reanalyze]
- [x] 1.6 UI: BPM, tonalidad, energía y avisos en la cola, punto de mezcla planeado, marcas en la vista general e interruptor (REQ-8) @ui [verify: node --input-type=module --check < renderer/app.js && node --input-type=module --check < renderer/waveform.js]
- [~] 1.7 Prueba de punta a punta con pistas sintéticas de estructura conocida, guía y capturas (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8) @coder [verify: node scripts/test-mix-points-e2e.js] {claim: alex@alex-pc 2026-10-30T21:10:31-03:00}
