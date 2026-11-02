---
change: 2026-11-02-automix-visual
type: feature
domains: [ui]
paths: [renderer/viz.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/automix.js, scripts/**, docs/**, README.md, .github/**]
status: approved
rev: 1
approved_rev: 1
approved_hash: 02eff032f88f3b46675542455b177786d3079195b72395438828c403854a9617
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-automix-visual

## Contexto

Pedido de Alejandro: que la vista **Automix** (la inmersiva, grande) tenga algo visual «sin complicarla», válido para pistas locales y de stream. El vídeo se retiró en la v0.5.0 porque no funcionaba bien, así que se elige un **visualizador simple**: anillos que laten con el beat alrededor de la portada, coloreados por deck. Solo usa datos que existen para cualquier pista: el nivel de audio del deck (`st.level`), el BPM y la posición (del análisis o del tempo del deck) y la ganancia del canal; no hace falta espectro ni vídeo, y no toca el audio.

## Requisitos

### REQ-1: Anillos que laten con el beat
WHILE la vista Automix está visible y suena un deck THE SYSTEM SHALL dibujar, en un lienzo detrás de la portada, anillos concéntricos que salen de la portada y se expanden al ritmo del beat del deck (un ciclo por beat), con un pulso más marcado en el primer tiempo de cada compás de 4.
THE SYSTEM SHALL modular la intensidad (opacidad y grosor) con el nivel de audio del deck y con la ganancia de su canal.
THE SYSTEM SHALL colorear los anillos con el color del deck (A cian, B rosa).

### REQ-2: Igual para local y stream, y sin BPM
THE SYSTEM SHALL usar solo el nivel, el BPM efectivo y la posición del deck, de modo que se vea igual con pistas locales, guardadas o de stream.
IF el deck no tiene BPM THEN THE SYSTEM SHALL mostrar un anillo que «respira» con el nivel de audio, sin ritmo.
WHILE el deck está en pausa o sin pista THE SYSTEM SHALL mostrar los anillos quietos y atenuados.

### REQ-3: Transiciones
WHILE hay una transición entre dos decks THE SYSTEM SHALL dibujar los anillos de los dos decks a la vez, cada uno con la intensidad de la ganancia de su canal, de modo que el color pase de uno al otro con el crossfader.

### REQ-4: Control y movimiento reducido
THE SYSTEM SHALL ofrecer en la vista Automix un botón **Visual** (activado por defecto) que enciende o apaga el visualizador, y recordar la elección entre sesiones.
IF el sistema pide movimiento reducido (`prefers-reduced-motion`) THEN THE SYSTEM SHALL mostrar el visualizador estático (sin animación) y no consumir cuadros.
WHEN el visualizador está apagado THE SYSTEM SHALL ocultar el lienzo y no dibujar nada.

### REQ-5: Rendimiento
THE SYSTEM SHALL dibujar como máximo 30 cuadros por segundo y solo mientras la vista Automix, la ventana y el lienzo son visibles; fuera de eso detiene el bucle y no consume procesador.
THE SYSTEM SHALL no cambiar el audio, el estado de los decks ni la latencia de los controles.
THE SYSTEM SHALL dibujar un cuadro en menos de 8 ms de media con la ventana a 1600×960.

### REQ-6: Latido de la portada
WHILE el visualizador está activo y suena un deck THE SYSTEM SHALL aplicar a la portada una escala de hasta +1,5 % con el beat, proporcional al nivel.

### REQ-7: Verificación y documentación
THE SYSTEM SHALL cubrir con pruebas automáticas el cálculo de los anillos (fase, intensidad, color, sin BPM, pausa, transición), el control y la persistencia, el movimiento reducido, el rendimiento y la ausencia de desbordes a 1366×768; y actualizar la documentación y las capturas.

## Fuera de alcance

- Vídeo (local o de YouTube) y cualquier cosa que descargue o reproduzca vídeo.
- Analizador de espectro o barras de frecuencia (los decks de stream no ofrecen espectro).
- Visuales cargados por el usuario, modo proyector o pantalla completa.
- Letras, reconocimiento de escenas o efectos 3D.
