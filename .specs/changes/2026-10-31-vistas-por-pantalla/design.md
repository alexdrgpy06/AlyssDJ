---
change: 2026-10-31-vistas-por-pantalla
status: approved
rev: 1
approved_rev: 1
approved_hash: 320946c836bb7cd6d807b79ed893d5bf70b74bbe742d942ba4e472dcc4276eb3
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
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

## Domain deltas
### ui
#### ADDED spec: perfiles por tamaño de pantalla
WHEN cambia el tamaño de la ventana THE SYSTEM SHALL elegir el perfil compacto, normal o amplio según su tamaño, salvo que el usuario fije uno en Ajustes.
#### ADDED design: layout.js
`profileFor`, `scaleFor` y `resolve` son puros; `body[data-layout]` activa el CSS compacto (comparte reglas con `am-compact`) y el amplio escala con `zoom` según `--ui-scale`.
