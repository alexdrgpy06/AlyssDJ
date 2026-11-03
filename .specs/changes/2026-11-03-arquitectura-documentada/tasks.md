---
change: 2026-11-03-arquitectura-documentada
---
# Tasks · 2026-11-03-arquitectura-documentada

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [ ] 1.1 Registro `modulos.json` con todos los módulos y su prueba `registry` (REQ-1, REQ-8) @architect [verify: node scripts/test-arquitectura.js registry]
- [ ] 1.2 Documentos por capa: `01-main`, `02-shared-y-preload`, `03-renderer` con contrato de cada función pública (REQ-1, REQ-2) @architect [verify: node scripts/test-arquitectura.js docs]
- [ ] 1.3 Vistas y componentes con IDs, estado y eventos (REQ-3) @architect [verify: node scripts/test-arquitectura.js docs]
- [ ] 1.4 IPC, rutas `app://`, audio y persistencia documentados y comprobados contra `main.js` (REQ-4, REQ-8) @architect [verify: node scripts/test-arquitectura.js ipc]
- [ ] 1.5 Comprobación visual con referencias y `--approve` (REQ-6) @coder [verify: xvfb-run -a node scripts/visual-check.js]
- [ ] 1.6 Matriz de QA `06-qa.md` generada desde el registro, con los huecos marcados (REQ-5) @planner [verify: node scripts/test-arquitectura.js docs]
- [ ] 1.7 Deuda priorizada `07-deuda.md` (REQ-9) @planner [verify: test -s docs/arquitectura/07-deuda.md]
- [ ] 1.8 Dominios SDD nuevos y `paths:` corregidos, con `## Domain deltas` (REQ-7) @architect [verify: sdd check 2026-11-03-arquitectura-documentada]
- [ ] 1.9 Pruebas en CI (`ci.yml`) y enlace desde `docs/README.md` (REQ-8) @coder [verify: node scripts/test-arquitectura.js docs]
