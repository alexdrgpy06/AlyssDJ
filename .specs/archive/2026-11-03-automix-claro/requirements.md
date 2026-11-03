---
change: 2026-11-03-automix-claro
type: feature
domains: [automix, ui]
paths: [renderer/automix.js, renderer/automix-add.js, renderer/mixpreview.js, renderer/mixeditor.js, renderer/index.html, renderer/styles.css, docs/04-automix.md, scripts/test-automix*.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 2c861cdcf957c8accdf66ccd165d406b9f07b3a2d3f97ba477212a39855d462a
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-automix-claro

## Contexto

Alejandro pide mejorar **cómo funciona AutoMix, cómo se ve y más**. Hoy la lógica está repartida (`automix.js` ~950 líneas, `mixplan.js`, `recipes.js`, `automix-add.js`) y la interfaz tiene dos vistas con los mismos controles (la inmersiva y la fuente AutoMix de la librería), cuatro estados que se explican con texto («Detenido», «Esperando salida…»), un selector de salida con varios modos, estilos, duración, fx, popularidad y cola ordenable. Es potente pero cuesta entender qué está haciendo y por qué.

## Requisitos

### REQ-1: Estado comprensible
THE SYSTEM SHALL mostrar en todo momento una línea de estado con la fase actual (Sonando, Preparando la siguiente, Esperando el punto de salida, Mezclando, Detenido), el tiempo que falta para la mezcla y el motivo de cualquier espera.

### REQ-2: Línea de tiempo de la mezcla
THE SYSTEM SHALL dibujar una línea de tiempo con las ondas de la pista que sale y la que entra, el solape, el punto de salida y el de entrada, los gestos de la receta (graves, filtro, eco, fundido) y la posición actual, en la vista de AutoMix y en el editor de la transición.

### REQ-3: Control antes y durante
WHEN el usuario mueve la salida, la entrada, la duración o el estilo en la línea de tiempo THE SYSTEM SHALL aplicarlo a la siguiente mezcla (y a la actual si aún no ha empezado) y mostrar al instante el efecto sobre la receta.

### REQ-4: Previsualizar la transición
THE SYSTEM SHALL permitir escuchar por los auriculares (salida de preescucha) el tramo de la próxima transición antes de que ocurra.

### REQ-5: Cola con contexto
THE SYSTEM SHALL mostrar en cada elemento de la cola la compatibilidad con el anterior (BPM, tonalidad, energía) con una señal visual de tres niveles y el motivo, y marcar las pistas sin análisis o sin archivo.

### REQ-6: Perfiles de comportamiento
THE SYSTEM SHALL ofrecer perfiles de AutoMix — Suave, Club, Radio, Personalizado — que fijan duración, estilo, orden y nivel de efectos con un solo clic, y recordar el último usado.

### REQ-7: Una sola vista de control
THE SYSTEM SHALL tener una vista principal de AutoMix con todos sus controles (ver el cambio `interfaz-ordenada`) y una tarjeta compacta de estado en las demás vistas.

### REQ-8: Robustez
IF una pista falla al cargar, se queda sin analizar o se corta la conexión durante una mezcla THEN THE SYSTEM SHALL continuar con la siguiente disponible sin silencio prolongado y explicarlo en la línea de estado.

### REQ-9: Documentación y pruebas
THE SYSTEM SHALL actualizar `docs/04-automix.md` y las capturas, y cubrir los nuevos estados y la línea de tiempo con autopruebas headless.

## Fuera de alcance

- Mezclar usando stems (cambio aparte, tras `stems-gpu-automaticos`).
- Un modo con vídeo (retirado en v0.5.0).
