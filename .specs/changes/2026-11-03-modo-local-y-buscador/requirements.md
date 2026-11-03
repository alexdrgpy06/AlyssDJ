---
change: 2026-11-03-modo-local-y-buscador
type: feature
domains: [library, sources, ui]
paths: [main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/library.js, renderer/app.js, renderer/index.html, renderer/source.js, docs/**, scripts/test-*.js]
commits: []
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Requirements · 2026-11-03-modo-local-y-buscador

## Contexto

El buscador de la librería solo busca en YouTube Music (`lib:search`, requiere red). Alejandro quiere poder **usar la app en modo local** y que **el buscador no sea solo online**: buscar en lo que ya hay en el equipo (música local, guardadas, analizadas, playlists importadas) y poder trabajar sin conexión ni sesión. Hoy ya existen las fuentes Local, Importadas y Analizados, pero cada una se mira por separado y no hay búsqueda sobre ellas.

## Requisitos

### REQ-1: Buscar en todo lo local
WHEN el usuario escribe en el buscador THE SYSTEM SHALL buscar por título, artista, álbum y género en la música local, las pistas guardadas, las analizadas y las playlists importadas, y mostrar los resultados al instante (sin red), indicando de qué fuente viene cada uno.

### REQ-2: Elegir dónde buscar
THE SYSTEM SHALL ofrecer en el buscador un selector de ámbito — Todo, Mi equipo, YouTube Music — que se recuerde, con «Mi equipo» como valor si no hay conexión.

### REQ-3: Modo local explícito
THE SYSTEM SHALL ofrecer un ajuste «Modo local» que, activado, no hace ninguna petición de red de la app (búsqueda online, sesión de YouTube Music, comprobación de actualizaciones, descarga automática de herramientas) y lo indica con una marca visible en la barra superior.

### REQ-4: Caída elegante sin conexión
IF no hay conexión o la sesión caduca THEN THE SYSTEM SHALL pasar a mostrar solo lo local, decir «Sin conexión: mostrando tu equipo» y seguir funcionando con los decks, AutoMix y los stems sobre archivos.

### REQ-5: Filtros útiles
THE SYSTEM SHALL permitir filtrar los resultados locales por BPM (rango), tonalidad Camelot y género, reutilizando los datos del análisis.

### REQ-6: AutoMix también local
WHEN el modo local está activo o el ámbito es «Mi equipo» THE SYSTEM SHALL rellenar y sugerir pistas de AutoMix solo desde la música local analizada, en vez de la radio de YouTube Music.

### REQ-7: Rápido con bibliotecas grandes
THE SYSTEM SHALL responder a una búsqueda local en menos de 100 ms con 20 000 pistas indexadas.

### REQ-8: Privacidad
THE SYSTEM SHALL mantener la regla de que el renderer no recibe rutas arbitrarias (los resultados locales se identifican por id) y SHALL no enviar términos de búsqueda locales a ningún servidor.

## Fuera de alcance

- Reconocimiento de pistas por audio o por huella.
- Sincronizar la biblioteca con otros equipos.
