---
change: 2026-10-31-automix-buscar-y-agregar
type: feature
domains: [automix, library]
paths: [renderer/automix.js, renderer/mixplan.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, scripts/test-automix-add.js, docs/**]
commits: []
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Requirements · 2026-10-31-automix-buscar-y-agregar

## Contexto
Para añadir a la cola de AutoMix hay que ir a la librería, buscar y volver. Se quiere buscar y agregar desde la propia vista de AutoMix, que la app vea dónde conviene cada tema (analizando) y reorganice la cola en consecuencia, y que sugiera qué iría a continuación.

## Requisitos
### REQ-1: Buscar desde AutoMix
WHEN el usuario escribe en el buscador de la vista de AutoMix THE SYSTEM SHALL mostrar resultados de YouTube Music, de la librería local y de las pistas ya analizadas, sin salir de la vista.
### REQ-2: Agregar
WHEN el usuario pulsa «Agregar» (o Enter) en un resultado THE SYSTEM SHALL añadirlo a la cola y ofrecer «A continuación» para ponerlo el siguiente.
### REQ-3: Dónde agregar
WHEN la pista agregada ya está analizada THE SYSTEM SHALL insertarla en la posición de menor coste total de la cadena y decir en qué lugar quedó; WHEN no lo está THE SYSTEM SHALL ponerla al final, analizarla y moverla a su mejor posición en cuanto llegue el análisis, avisando «movida de 8 a 3».
### REQ-4: La cola se adapta
WHEN se agrega o se quita una pista THE SYSTEM SHALL recalcular el orden de las no fijadas, sin mover la pista que suena ni la ya precargada.
### REQ-5: Sugerencias de qué sigue
WHILE AutoMix tiene pistas THE SYSTEM SHALL mostrar hasta 6 sugerencias para continuar (de la radio de YouTube Music y de lo analizado en la librería) ordenadas por coste de transición desde el final de la cola, analizando en segundo plano las mejores, con «Agregar» en cada una.
### REQ-6: Sin duplicados
THE SYSTEM SHALL no agregar una pista que ya esté en la cola ni la que suena, y avisarlo.

## Fuera de alcance
Reordenar por género o estado de ánimo, y sugerencias de pistas fuera de YouTube Music y la librería local.
