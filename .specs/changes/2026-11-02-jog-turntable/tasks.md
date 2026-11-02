---
change: 2026-11-02-jog-turntable
---
# Tasks · 2026-11-02-jog-turntable

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [ ] 1.1 Prueba de viabilidad: procesador de scratch sobre buffer, hacia atrás y memoria (REQ-2, REQ-3) @architect [verify: node scripts/test-jog.js math]
- [ ] 1.2 shared/scratch.js y worklet: reproductor sobre buffer con rampas (REQ-1, REQ-2, REQ-3, REQ-4) @coder [verify: node scripts/test-jog.js engine]
- [ ] 1.3 Plato: sujetar, scratch, soltar y respaldo sin buffer (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5) @ui [verify: node scripts/test-jog.js ui]
- [ ] 1.4 AutoMix respeta el deck sujeto y documentación (REQ-6) @coder [verify: node scripts/test-jog.js docs]
