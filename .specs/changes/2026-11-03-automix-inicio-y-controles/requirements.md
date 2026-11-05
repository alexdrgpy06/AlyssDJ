---
change: 2026-11-03-automix-inicio-y-controles
type: fix
domains: [automix, ui]
paths: [renderer/automix*.js, renderer/app.js, renderer/index.html, renderer/styles.css, scripts/test-automix-inicio.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: f7c23009182c3735af2495e9a1056813657469617b08e6b69131f9e8ef7f4ae4
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-automix-inicio-y-controles

## Contexto

Reproducido en la app (1280×720, decks con «Neon Drive» en A y «Night Pulse» en B, sin cola):
1. Sin pista en un deck, AutoMix solo avisa «usa “Radio” en la librería»; no hay en AutoMix un modo de **empezar desde una radio** (de la pista que suena, de una pista buscada o de una lista).
2. La vista Automix (inmersiva) muestra el estado pero no tiene iniciar, detener, mezclar ahora ni radio: solo «Abrir panel».
3. Al iniciar, la siguiente sale de la radio («SORNERO», sin análisis, entrada 0:00) y **se ignora la pista ya cargada en el otro deck** (Night Pulse, analizada, 128 BPM, compatible).
4. El panel de AutoMix queda cortado en la vista Librería: «Estilo» con «Bass + eco» recortado, «Rellenar con radio» y «Vaciar» sin forma de botón, y la cola y el buscador fuera de pantalla; en la barra superior «AutoMix · activo» e «Iniciar sesión» se parten en dos líneas.

## Requisitos

### REQ-1: Empezar desde una radio
WHEN el usuario pulsa «Radio» en AutoMix THE SYSTEM SHALL ofrecer como origen la pista que suena, la pista cargada en el otro deck, una búsqueda o la lista abierta, y WHEN elige uno THE SYSTEM SHALL cargar esa pista, llenar la cola con su radio (o con pistas compatibles de la librería si está en modo local o sin sesión) e iniciar AutoMix.

### REQ-2: Controles de reproducción en la vista Automix
WHILE la vista Automix está visible THE SYSTEM SHALL mostrar iniciar o detener, mezclar ahora, siguiente y el origen de la radio, con el mismo estado y las mismas acciones que el panel.

### REQ-3: La pista del otro deck cuenta
WHEN AutoMix elige la pista que sigue y el otro deck ya tiene una pista cargada que no ha sonado THE SYSTEM SHALL usarla como siguiente si su BPM y tonalidad son compatibles con la que suena, antes de buscar en la radio.

### REQ-4: Controles ordenados y completos a 1280×720
WHILE la ventana mide 1280×720 THE SYSTEM SHALL mostrar el panel de AutoMix sin recortes (todos los botones con su texto y forma, estilos sin cortar), con la cola visible o alcanzable con un desplazamiento propio, y la barra superior sin textos partidos en dos líneas.

## Fuera de alcance
Nuevas recetas de transición y cambios en el análisis de las pistas.
