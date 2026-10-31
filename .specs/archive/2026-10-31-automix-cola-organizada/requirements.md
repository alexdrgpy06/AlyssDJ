---
change: 2026-10-31-automix-cola-organizada
type: feature
domains: [automix]
paths: [docs/**, main/main.js, scripts/test-automix-view.js, scripts/test-mix-points.js, scripts/queue-order-selftest.js, renderer/automix.js, renderer/mixplan.js, renderer/index.html, renderer/styles.css, renderer/app.js, main/analyzer.js, scripts/test-queue-order.js]
commits: [448917f, 9686331]
status: approved
rev: 1
approved_rev: 1
approved_hash: 4b8435ab9a470e9434e8c5829c7551e20d3e1bc1d816749ed4401bac45cfd98b
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-automix-cola-organizada

## Contexto
Hoy AutoMix analiza solo las 3 pistas siguientes y reordena de forma voraz: ordena las listas por su transición con la pista actual, no como una cadena. En una cola larga el orden global no es bueno (el BPM salta, la tonalidad choca).

## Requisitos
### REQ-1: Analizar toda la cola
WHEN se añade una pista a la cola de AutoMix THE SYSTEM SHALL analizarla automáticamente (descarga sin sesión + análisis) sin esperar a que le toque, de a pocas a la vez (máximo 2 en paralelo) y priorizando las más cercanas en el orden.
### REQ-2: Orden por cadena
WHEN hay al menos 3 pistas analizadas en la cola THE SYSTEM SHALL ordenarlas como una cadena que parte de la pista actual y minimiza el coste total de las transiciones (diferencia de BPM incluidas mitad/doble, compatibilidad Camelot y energía), no solo la siguiente.
### REQ-3: Progresión suave
THE SYSTEM SHALL preferir órdenes en que el BPM cambie gradualmente (sin saltos de más del 8% entre pistas consecutivas cuando existan alternativas) y la energía suba o baje de forma continua.
### REQ-4: Lo manual se respeta
WHILE una pista esté fijada por el usuario THE SYSTEM SHALL mantenerla en su posición y ordenar solo alrededor de ella.
### REQ-5: Reordenar al llegar análisis
WHEN termina el análisis de una pista de la cola THE SYSTEM SHALL recalcular el orden de las pistas no fijadas, sin mover la pista que ya se está preparando para sonar a continuación.
### REQ-6: Control y transparencia
THE SYSTEM SHALL mostrar en la vista de AutoMix el estado de análisis de cada pista, el BPM, la tonalidad y la calidad de cada transición, un interruptor «Orden automático» y un botón «Reorganizar ahora» (y «Deshacer» el último reordenamiento).
### REQ-7: Rendimiento
WHILE la cola tiene hasta 100 pistas THE SYSTEM SHALL calcular el orden en menos de 200 ms.

## Fuera de alcance
Cambiar cómo se mezcla cada transición y ordenar por género o estado de ánimo.
