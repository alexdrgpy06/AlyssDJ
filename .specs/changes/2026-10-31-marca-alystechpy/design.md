---
change: 2026-10-31-marca-alystechpy
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-10-31-marca-alystechpy

## Enfoque
- `package.json`: `author { name: 'Alejandro Ramírez', url }`, `build.copyright`, `build.win.publisherName`, `build.nsis.shortcutName`, `build.linux.maintainer/vendor`, `homepage`; `appId` pasa a `py.alystech.alyssdj`.
- `renderer/index.html`: diálogo `#about` (lo abre un botón en Ayuda) con versión leída de `app.getVersion()` por IPC; marca «by AlystechPY» en `.brand` oculta en compacto.
- LICENSE, README (pie), docs/00-instalacion.md y docs/README.md con la autoría.
- Prueba `scripts/test-brand.js`: textos en LICENSE/README/package.json/HTML y el diálogo abierto en la app (versión visible).

## Contratos
IPC `app:info -> { name, version, org, author, license, repo }`.

## Visual Spec
Diálogo sencillo centrado con el logotipo (`build/icon.svg`), nombre, versión y créditos.

## Amendments
