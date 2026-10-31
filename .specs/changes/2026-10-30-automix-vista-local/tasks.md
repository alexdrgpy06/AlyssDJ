---
change: 2026-10-30-automix-vista-local
status: draft
rev: 1
---
# Tasks · automix-vista-local

- [x] 1.1 Cola editable en el motor: mover, a continuación, quitar, vaciar, añadir, también con transición en curso (REQ-2) @coder [verify: node --experimental-default-type=module scripts/test-automix-view.js queue]
- [x] 1.2 Estado por pista y preparación: análisis y guardado por adelantado, carga en LOCAL, espera de 20 s y salto (REQ-5, REQ-6, REQ-7) @coder [verify: node --experimental-default-type=module scripts/test-automix-view.js prepare]
- [x] 1.3 Mezclar ahora y progreso de la transición (REQ-3, REQ-4) @coder [verify: node --experimental-default-type=module scripts/test-automix-view.js mixnow]
- [x] 1.4 Vista AutoMix como pestaña de la librería, con atajo Mayús + → (REQ-1, REQ-2, REQ-3, REQ-4, REQ-7) @ui [verify: node --input-type=module --check < renderer/app.js && node --input-type=module --check < renderer/library.js]
- [~] 1.5 Prueba de punta a punta en la app: cola de pistas guardadas, cambios al vuelo y mezcla (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7) @coder [verify: node scripts/test-automix-view-e2e.js] {claim: alex@alex-pc 2026-10-30T20:58:50-03:00}
- [ ] 1.6 Guía de AutoMix y capturas actualizadas (REQ-1) @pm [verify: grep -q "Mezclar ahora" docs/04-automix.md]
