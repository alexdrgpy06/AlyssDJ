---
change: 2026-10-31-automix-cola-organizada
---
# Tasks · 2026-10-31-automix-cola-organizada

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [ ] 1.1 orderChain: cadena óptima con fijadas (REQ-2, REQ-3, REQ-4, REQ-7) @coder [verify: node --experimental-default-type=module scripts/test-queue-order.js chain]
- [ ] 1.2 Analizar toda la cola y reordenar al llegar análisis (REQ-1, REQ-5) @coder [verify: node --experimental-default-type=module scripts/test-queue-order.js prepare]
- [ ] 1.3 Controles y transparencia en la vista (REQ-6) @ui [verify: node scripts/test-queue-order.js e2e]
