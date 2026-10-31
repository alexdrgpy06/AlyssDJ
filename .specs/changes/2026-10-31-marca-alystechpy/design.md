---
change: 2026-10-31-marca-alystechpy
status: approved
rev: 1
approved_rev: 1
approved_hash: dabc7cade40fd653868c9eea1b5beb065ec454d7f8de4f102dd7fefc3347e8f2
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
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

## Domain deltas
### install
#### ADDED spec: autoría AlystechPY
THE SYSTEM SHALL declarar a AlystechPY como organización y a Alejandro Ramírez como autor en la licencia, el paquete, los instaladores, la documentación y el diálogo «Acerca de».
### ui
#### ADDED design: Acerca de y marca
Diálogo `#about` con `app:info`, marca «by AlystechPY» en la barra superior (oculta en compacto) e identificador py.alystech.alyssdj.
