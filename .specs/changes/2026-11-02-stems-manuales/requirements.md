---
change: 2026-11-02-stems-manuales
type: feature
domains: [audio, library, ui, platform]
paths: [main/stems.js, main/stems-worker.js, main/main.js, preload/app.js, shared/deck-engine.js, shared/stems-player.js, renderer/deck.js, renderer/stems.js, renderer/library.js, renderer/styles.css, renderer/index.html, package.json, scripts/test-stems*.js, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: d5a6fcbdc10f7ab20b115de76a8127f91c3472e6256cec22bab5261a9582249b
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-stems-manuales

## Contexto

Los DJ de referencia (djay con Neural Mix, Serato, Rekordbox) permiten aislar o quitar voz, batería, bajo e instrumentos de una pista. En AlyssDJ será una acción **manual** sobre archivos locales ya disponibles (nunca en vivo sobre streaming): el usuario pide separar una pista, la app trabaja en segundo plano y después el deck puede silenciar o aislar cada stem. El spike (`~/Documents/Knowledge/01_Projects/AlyssDJ/spike-stems.md`) probó HTDemucs en ONNX con `onnxruntime-node` en CPU: ~1,7× tiempo real y ~1 GB de RAM con la sesión ajustada; no probó la calidad auditiva con música real ni Electron empaquetado.

## Requisitos

### REQ-1: Separar una pista a petición
WHEN el usuario pide «Stems» sobre una pista disponible como archivo local THE SYSTEM SHALL separarla en cuatro stems (voz, batería, bajo y resto) en segundo plano, sin bloquear la interfaz ni los decks, y guardarlos en el almacén de la aplicación para no repetir el trabajo.

### REQ-2: Progreso y cancelación
WHILE se separa una pista THE SYSTEM SHALL mostrar el progreso y el tiempo restante estimado en la fila y en el deck donde esté cargada, y WHEN el usuario cancela THE SYSTEM SHALL detener el trabajo y borrar lo parcial.

### REQ-3: Una a la vez y sin pisar la mezcla
THE SYSTEM SHALL procesar una sola pista a la vez (las demás esperan en cola) con prioridad baja, de modo que el audio de los decks no se corte ni se distorsione, y SHALL limitar su memoria a unos 1,5 GB.

### REQ-4: Modelo bajo demanda
WHEN el modelo no está en el equipo THE SYSTEM SHALL pedir permiso al usuario indicando nombre, origen y tamaño (~210 MB) antes de descargarlo, verificar su SHA-256 y guardarlo en el almacén; el instalador no lo incluye.

### REQ-5: Aislar o quitar stems en el deck
WHEN una pista cargada tiene sus stems THE SYSTEM SHALL ofrecer en su deck un control por stem para silenciarlo o aislarlo (solo), con transición suave sin chasquidos, y WHEN no los tiene THE SYSTEM SHALL ofrecer separarla desde ahí.

### REQ-6: Coherencia con el deck
WHILE los stems están en uso THE SYSTEM SHALL mantener el mismo tempo, posición, loops, cues, EQ, filtro y efectos del deck que con la pista completa, y el pitch con keylock SHALL comportarse igual.

### REQ-7: Estado visible en la Librería
THE SYSTEM SHALL marcar en la Librería qué pistas ya tienen stems y permitir borrarlos para liberar espacio, indicando cuánto ocupan.

### REQ-8: Fallos claros
IF la separación falla (sin memoria, archivo ilegible, modelo corrupto o sin espacio) THEN THE SYSTEM SHALL decirlo en una frase con la causa y dejar la pista completa funcionando como antes.

## Fuera de alcance

- Separar pistas de streaming o en vivo, y separación automática en lote.
- Exportar los stems como archivos o mezclarlos en AutoMix (queda para otro cambio).
- Aceleración por GPU (CUDA, DirectML, CoreML): primera versión solo CPU.
- Más de 4 stems o modelos alternativos.
