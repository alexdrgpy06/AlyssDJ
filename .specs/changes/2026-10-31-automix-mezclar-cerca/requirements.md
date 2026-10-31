---
change: 2026-10-31-automix-mezclar-cerca
type: feature
domains: [automix]
paths: [renderer/mixplan.js, renderer/automix.js, renderer/app.js, scripts/test-mix-now.js]
commits: []
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Requirements · 2026-10-31-automix-mezclar-cerca

## Contexto
«Mezclar ahora» (Mayús + →) hoy arranca la transición de inmediato, sin mirar dónde está la pista que suena ni dónde conviene entrar en la siguiente: puede cortar a mitad de un compás. Se quiere que busque el punto de salida y el de entrada más cercanos que sean musicalmente buenos.

## Requisitos
### REQ-1: Salida más cercana
WHEN el usuario pulsa «Mezclar ahora» THE SYSTEM SHALL elegir como salida el punto más cercano por delante de la posición actual (al menos 1 s) entre los candidatos de la pista (automáticos y editados) y los límites de frase de 8 beats de su rejilla, y no esperar más de 12 s.
### REQ-2: Entrada coherente
WHEN la salida está elegida THE SYSTEM SHALL entrar en la siguiente por su punto de entrada (editado o automático), alineada a su rejilla de beats con la fase de la saliente, e igualar el tempo dentro de ±8%.
### REQ-3: Transición adaptada al tiempo disponible
THE SYSTEM SHALL fijar la duración en compases enteros, hasta la duración configurada pero nunca más allá del final de la pista, y con un mínimo de 4 beats.
### REQ-4: Sin análisis, lo más cercano posible
IF la pista que suena o la siguiente no tiene BPM THEN THE SYSTEM SHALL hacer un fundido corto de inmediato.
### REQ-5: Feedback
WHILE se espera el punto elegido THE SYSTEM SHALL mostrar en la vista de AutoMix cuánto falta («mezclando en 3,2 s · salida en frase») y permitir cancelar con una nueva pulsación de Mayús + →… o con un botón «Cancelar».

## Fuera de alcance
Cambiar el estilo de la transición y el cálculo de salidas automáticas.
