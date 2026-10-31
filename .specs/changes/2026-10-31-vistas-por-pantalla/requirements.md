---
change: 2026-10-31-vistas-por-pantalla
type: feature
domains: [ui]
paths: [renderer/styles.css, renderer/app.js, renderer/index.html, main/settings.js, docs/**, scripts/test-layouts.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: f8e6bd9ee0f7486a7da8764e4366646d32b19cade2e301e717d1c0dcfff41568
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-vistas-por-pantalla

## Contexto
La interfaz se diseñó para ~1600×960. En pantallas pequeñas (portátiles de 1366×768) o muy grandes (2K/4K, proyectores) los controles quedan apretados o pequeños.

## Requisitos
### REQ-1: Perfiles por tamaño
WHEN cambia el tamaño de la ventana THE SYSTEM SHALL elegir un perfil según su ancho y alto: «compacto» (<1280 de ancho o <780 de alto), «normal» y «amplio» (≥1920 de ancho), y aplicarlo sin recargar.
### REQ-2: Compacto usable
WHILE el perfil es compacto THE SYSTEM SHALL mostrar los dos decks, el mezclador y la librería sin barras de desplazamiento de página, reduciendo el espaciado y ocultando lo secundario (leyendas, textos de ayuda) pero no los controles.
### REQ-3: Amplio aprovecha el espacio
WHILE el perfil es amplio THE SYSTEM SHALL escalar la interfaz para que los controles no se vean pequeños.
### REQ-4: Elección manual
THE SYSTEM SHALL ofrecer en Ajustes «Diseño: Auto / Compacto / Normal / Amplio» y recordar la elección.

## Fuera de alcance
Interfaz táctil para móviles y diseños para ventanas menores de 1024×600.
