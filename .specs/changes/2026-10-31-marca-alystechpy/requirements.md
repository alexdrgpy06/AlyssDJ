---
change: 2026-10-31-marca-alystechpy
type: feature
domains: [install, ui]
paths: [LICENSE, README.md, package.json, renderer/index.html, renderer/app.js, renderer/styles.css, docs/**, scripts/test-brand.js, main/main.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 43ddd7aaea661c69fb841cebf9924c597db5d0448f5591cd513e5b6046b44b44
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-marca-alystechpy

## Contexto
AlyssDJ es un software de **AlystechPY**, desarrollado por **Alejandro Ramírez**. Esa autoría debe figurar en la app, el instalador, la licencia y la documentación.

## Requisitos
### REQ-1: Acerca de
WHEN el usuario pulsa «Acerca de» (en Ayuda) THE SYSTEM SHALL mostrar el nombre, la versión, «Un software de AlystechPY · por Alejandro Ramírez», la licencia MIT y el enlace al repositorio.
### REQ-2: Metadatos de la app y los instaladores
THE SYSTEM SHALL declarar AlystechPY como organización y a Alejandro Ramírez como autor en `package.json`, y propagarlo a los instaladores (copyright, editor en Windows, categoría y descripción).
### REQ-3: Licencia y documentación
THE SYSTEM SHALL poner en LICENSE «Copyright (c) 2026 AlystechPY — Alejandro Ramírez» y en el README y la guía de instalación la autoría con el mismo texto.
### REQ-4: Barra superior
THE SYSTEM SHALL mostrar «by AlystechPY» discreto junto a la marca en la barra superior, sin quitar espacio a los controles en el perfil compacto.

## Fuera de alcance
Logotipo nuevo, dominio propio y cambiar el propietario del repositorio en GitHub.
