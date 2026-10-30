---
project: AlyssDJ
status: approved
rev: 1
approved_rev: 1
approved_hash: bcec9320feceed6fb8179c472fb040e40a90c815e3e4abba87787daec2744f44
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Constitution · AlyssDJ

## Stack
- Electron 45 + Node 22. Proceso principal en CommonJS (`main/`, `preload/`, `shared/`); UI en ES modules sin bundler (`renderer/`).
- Audio con Web Audio (una cadena DSP por deck en `shared/`); análisis offline en un worker (`main/analysis-worker.js`).
- Herramientas externas: yt-dlp (se descarga solo a `bin/`) y ffmpeg (sistema o `ffmpeg-static`).
- Sin dependencias de runtime fuera de Electron; `npm start` comprueba herramientas antes de abrir.

## Principios
- Nada se descarga de YouTube sin que el usuario lo pida (Analizar). Las instalaciones de herramientas sí son automáticas.
- El renderer nunca recibe rutas arbitrarias del disco: pide archivos locales por id (`/localfile/<id>`).
- Todo lo nuevo se prueba en silencio (volumen maestro 0) con `YTDJ_SELFTEST` y con audio sintético de `scripts/`.
- La documentación (`docs/`) y sus capturas se regeneran con scripts; se actualizan con cada cambio de UI.
- Sin pistas ni claves de usuario en el repositorio.

## Límites
- Siempre: validar con `node --check` / pruebas de autoprueba antes de dar algo por hecho; informar de lo que no se pudo verificar (p. ej. sesión Premium real).
- Preguntar antes: leer datos de otros programas del usuario (cookies del navegador), publicar el repo, cambiar la forma de reproducir YouTube.
- Nunca: guardar contraseñas, enviar cookies o datos de sesión a otro destino que YouTube/Google, añadir firmas de agente en commits.

## Tokens visuales
- Superficies `#05070b` → `#181f2d`; texto `#e9edf5`, secundario `#9ba6b8`.
- Deck A `#22c9ff`, deck B `#ff4f93`; play `#3df08e`, cue `#ffb324`, error `#ff5566`.
- Tipografía: Inter / sistema; números en JetBrains Mono con cifras tabulares.
