---
change: 2026-10-31-automix-vista-video
type: feature
domains: [automix, video, ui]
paths: [renderer/**, scripts/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: e36f54c0642ce73ee0d845fc6c019f06c788a6a0cb9aa5e73c93e3f938487ea3
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-automix-vista-video

## Contexto

Con AutoMix activo los decks ya se compactan, pero siguen ocupando mucho espacio. Se quiere una vista de AutoMix sin los decks grandes, con una miniatura de video corriendo por cada deck, que se pueda redimensionar y que siempre sea el video de la pista que de verdad suena en ese deck.

## Requisitos

### REQ-1: Vista AutoMix sin decks grandes
WHEN el usuario activa «Vista AutoMix» THE SYSTEM SHALL ocultar los decks y el mezclador grandes y mostrar una franja con una miniatura por deck (A y B), con título, artista, tiempo restante y una barra de progreso, dejando la cola de AutoMix como contenido principal.
WHEN el usuario la desactiva THE SYSTEM SHALL restaurar la consola completa sin perder el estado de los decks (posición, loops, ganancia).

### REQ-2: El video mostrado es el correcto
WHILE una miniatura muestra video THE SYSTEM SHALL reproducir solo el video cuyo id coincide con la pista cargada en ese deck.
IF cambia la pista del deck o el video aún no corresponde a la pista cargada THEN THE SYSTEM SHALL mostrar la portada de la pista en vez de un video de otra pista.
WHILE un deck suena THE SYSTEM SHALL mantener su miniatura sincronizada con el audio (posición, pausa y velocidad, deriva máxima 80 ms).

### REQ-3: Qué deck está al aire
THE SYSTEM SHALL resaltar la miniatura del deck que está sonando y atenuar la del deck en espera; durante una mezcla ambas se ven y se resalta la que entra o sale según el volumen de cada canal.

### REQ-4: Tamaño ajustable
WHEN el usuario arrastra el asa de la franja o usa los atajos de teclado de la misma THE SYSTEM SHALL cambiar el tamaño de las miniaturas entre un mínimo y un máximo, manteniendo la proporción 16:9.
WHEN la app se reinicia THE SYSTEM SHALL recordar el tamaño elegido y que la vista estuviera activa.

### REQ-5: Pistas sin video
IF la pista de un deck no tiene video de verdad (solo portada, o aún no guardado) THEN THE SYSTEM SHALL mostrar su portada con la etiqueta «Solo audio».
IF la miniatura de video está desactivada en Ajustes THEN THE SYSTEM SHALL mostrar solo portadas.

### REQ-6: Ventana de video
WHEN el usuario hace doble clic en una miniatura THE SYSTEM SHALL abrir la ventana de video para ese deck, igual que el doble clic del plato.

## Fuera de alcance

- Cambiar cómo se descarga o elige el video (ya cubierto por «video-local»).
- Reproducir video de YouTube Music en streaming dentro de la miniatura; en modo stream se usan los fotogramas que ya llegan al deck.
