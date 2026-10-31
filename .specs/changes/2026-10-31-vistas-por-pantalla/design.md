---
change: 2026-10-31-vistas-por-pantalla
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-10-31-vistas-por-pantalla

## Enfoque
- `renderer/layout.js`: `profileFor(w,h)` puro y `applyLayout()` que pone `document.body.dataset.layout = 'compact'|'normal'|'wide'` en `resize` (con rAF) y por el ajuste `layoutMode`.
- `styles.css`: variables de densidad por perfil (`--gap`, `--deck-pad`, `--ui-scale`); compacto oculta `.legend`, reduce `.jog` y paddings; amplio usa `zoom`/`font-size` escalado (`--ui-scale` 1.25).
- Ajustes: selector `layout-mode`, persistido en settings.
- Prueba: `scripts/test-layouts.js` (función pura) y captura de ventana a 1366×768, 1600×960 y 2560×1440 comprobando que `document.documentElement.scrollHeight <= innerHeight`.

## Contratos
`profileFor(w,h) -> 'compact'|'normal'|'wide'`; ajuste `layoutMode: 'auto'|'compact'|'normal'|'wide'`.

## Visual Spec
Tres perfiles; se generan capturas de cada uno en `docs/img`.

## Amendments
