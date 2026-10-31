---
change: 2026-10-31-automix-buscar-y-agregar
type: feature
domains: [automix, library]
paths: [main/ytm-library.js, .github/**, main/main.js, main/ytm-library.js, preload/app.js, docs/**, renderer/**, scripts/**, renderer/automix.js, renderer/mixplan.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, scripts/test-automix-add.js, docs/**]
commits: [2a8658a, e2d35a7]
status: approved
rev: 1
approved_rev: 1
approved_hash: 5078252991447b273ef965ca16e07cadd0a537d9a37a13417964069671c5558e
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
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
### REQ-6: Popularidad
WHEN AutoMix llena la cola desde la radio de YouTube Music o genera sugerencias THE SYSTEM SHALL considerar la cantidad de reproducciones de cada candidata, junto con BPM, tonalidad, energía y estilo (misma radio, mismo artista, año cercano), de modo que entre candidatas de mezcla comparable gane la más popular.
IF una candidata popular no encaja (salto de BPM mayor al 8% o tonalidad incompatible) THEN THE SYSTEM SHALL no ponerla por delante de una que sí encaja.
### REQ-7: Ver y controlar la popularidad
THE SYSTEM SHALL mostrar las reproducciones de cada resultado y sugerida («856 M»), obtenerlas de la búsqueda o de la ficha de la pista de YouTube Music sin bloquear la interfaz (de a 3 como máximo, con caché de 30 días) y ofrecer «Priorizar lo popular» (activado) con peso Poco, Medio o Mucho.

### REQ-8: Sin duplicados
THE SYSTEM SHALL no agregar una pista que ya esté en la cola ni la que suena, y avisarlo.

## Fuera de alcance
Reordenar por género o estado de ánimo, y sugerencias de pistas fuera de YouTube Music y la librería local.
