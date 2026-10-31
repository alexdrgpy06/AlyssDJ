---
change: 2026-10-30-guardar-en-libreria-local
type: feature
domains: [library, analysis]
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 8678fb423ab4901629cabae26ad1e4530a89714923e8a6b8c77f9b5b22eed50a
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Requirements · guardar-en-libreria-local

## Contexto
Hoy "Analizar" descarga el audio de YouTube, lo analiza y lo borra (salvo "Conservar audio", que lo deja en una caché interna). Como el archivo ya se descargó, el usuario quiere conservarlo en su librería local, en la mejor calidad disponible, para reutilizarlo sin volver a descargar.

## Requisitos

### REQ-1: Guardar al analizar
WHEN el usuario analiza una pista de YouTube y la opción "Guardar en la librería local" está activa THE SYSTEM SHALL conservar el archivo descargado en la carpeta de la librería de YouTube, en la mejor calidad de audio que ofrezca YouTube, en lugar de borrarlo.

### REQ-2: Guardar al reproducir
WHEN una pista de YouTube lleva sonando más de 30 s por streaming y la opción "Guardar lo que reproduzca" está activa THE SYSTEM SHALL ponerla en la cola de descarga en segundo plano para guardarla y analizarla, sin interrumpir la reproducción.

### REQ-3: Aparece en la librería local
WHEN se guarda un archivo THE SYSTEM SHALL añadirlo a la pestaña Local con sus etiquetas (título, artista), carátula y el análisis ya calculado, sin volver a analizarlo ni duplicarlo si ya estaba.

### REQ-4: Se usa en vez del stream
WHEN una pista de YouTube ya tiene archivo guardado THE SYSTEM SHALL permitir reproducirla en modo LOCAL con el archivo (sin depender de YouTube) y mostrar que está guardada.

### REQ-5: Opciones y control del usuario
THE SYSTEM SHALL ofrecer en Ajustes dos interruptores independientes (guardar al analizar; guardar lo que reproduzca), una carpeta de destino editable y un botón para abrirla, y SHALL no descargar nada de YouTube si ambos están apagados salvo que el usuario pulse Analizar.

### REQ-6: Errores y espacio
IF la descarga falla o no hay espacio en disco THEN THE SYSTEM SHALL mostrar la causa, no dejar archivos parciales y continuar con la cola.

## Fuera de alcance
- Convertir a otro formato (se conserva el original: m4a u opus).
- Descargar playlists completas de una vez.
- Quitar archivos guardados desde la app (se borran en la carpeta).
