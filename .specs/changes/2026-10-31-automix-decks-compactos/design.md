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

## Domain deltas
### automix
#### ADDED spec: decks compactos con AutoMix
WHILE AutoMix está activo o su vista abierta THE SYSTEM SHALL mostrar los decks y el mezclador compactos y dar a la vista de AutoMix al menos el 40% de la altura de la ventana.
### ui
#### ADDED design: clase am-compact
`body.am-compact` reduce plato, oculta los bancos de funciones y compacta el mezclador; se activa desde `syncCompact` con el evento `alyss:tab` y el estado de AutoMix.
