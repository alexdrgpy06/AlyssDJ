---
change: 2026-10-31-automix-decks-compactos
status: approved
rev: 1
approved_rev: 1
approved_hash: c732716d8230609e315d0fbe7c04d0c010657e2776bfd871f3abb501d98d32ea
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
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
