---
domain: stems
paths: [docs/arquitectura/**, scripts/test-arquitectura.js, .specs/domains/**]
last_change: 2026-11-03-arquitectura-documentada
---
# stems · spec

## Separación de stems

THE SYSTEM SHALL separar una pista local en voz, batería, bajo y resto con HTDemucs (ONNX) en un proceso hijo de baja prioridad, eligiendo GPU o CPU según un sondeo cacheado, y mostrar el estado en la interfaz sin bloquear la mezcla.
