---
change: 2026-11-01-rediseno-interfaz
---
# Tasks · 2026-11-01-rediseno-interfaz

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Quitar miniaturas de video, tiles, teclas V [ ] y frames (REQ-1) @coder [verify: node scripts/test-rediseno.js video-removed]
- [x] 1.2 Ventana de video por medio de deck: nunca la página de YouTube Music de un deck vacío o sin video (REQ-2) @coder [verify: node scripts/test-rediseno.js video-media]
- [ ] 2.1 Tokens y componentes únicos: botón, segmentado, interruptor, deslizador, vacío, diálogo, movimiento reducido (REQ-3, REQ-8) @ui [verify: node scripts/test-rediseno.js tokens]
- [ ] 3.1 Barra en tres grupos, cabecera de deck unificada y mezclador alineado (REQ-3, REQ-4) @ui [verify: node scripts/test-rediseno.js shell]
- [ ] 3.2 Librería con panel de fuentes y barra de herramientas (REQ-5) @ui [verify: node scripts/test-rediseno.js sources]
- [ ] 3.3 AutoMix en cuatro grupos con interruptores (REQ-6) @ui [verify: node scripts/test-rediseno.js automix]
- [ ] 3.4 Ajustes por secciones con navegación lateral (REQ-7) @ui [verify: node scripts/test-rediseno.js settings]
- [ ] 4.1 Pruebas existentes a la nueva estructura, foco, contraste y objetivos de clic (REQ-8, REQ-9) @coder [verify: node scripts/test-rediseno.js e2e]
- [ ] 4.2 Documentación, capturas y lista de CI (REQ-9) @coder [verify: node scripts/test-rediseno.js docs]
