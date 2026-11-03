---
domain: sources
paths: [main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/library.js, renderer/app.js, renderer/index.html, renderer/source.js, docs/**, scripts/test-*.js]
last_change: 2026-11-03-modo-local-y-buscador
---
# sources · spec

## Modo local sin red

WHILE el modo local está activo THE SYSTEM SHALL bloquear toda salida a la red (búsqueda y radios en línea, descarga de herramientas y modelos, actualizaciones, análisis que requiere descargar audio y peticiones de las ventanas web) con el mensaje «Modo local: sin red», dejar intacto todo lo que ya está en el equipo y mostrar la insignia «Modo local».
