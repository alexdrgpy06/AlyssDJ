---
change: 2026-10-31-automix-decks-compactos
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-10-31-automix-decks-compactos

## Enfoque
- `AutoMix.emit` ya notifica; `app.js` pone `body.classList.toggle('am-compact', on || panelOpen)`.
- `styles.css`: bajo `body.am-compact` el `.deck` oculta `.bank-tabs/.bank` (excepto hot cues), reduce `.jog` y `.cover`, apila info en una línea; la rejilla principal pasa a `auto 1fr` con `#automix-panel` en `minmax(40vh, 1fr)`.
- Interacción con perfiles de pantalla: el modo compacto de AutoMix se suma al perfil de la ventana.
- Prueba e2e con la app: medir alturas de `.deck` (< 55% del valor normal) y del panel (≥ 40% de la ventana) con AutoMix activo y volver al valor original al detener.

## Contratos
Clase `am-compact` en `body`.

## Visual Spec
Capturas antes/después en `docs/img`.

## Amendments
