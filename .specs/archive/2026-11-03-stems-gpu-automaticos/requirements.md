---
change: 2026-11-03-stems-gpu-automaticos
type: feature
domains: [audio, library, platform]
paths: [main/stems*.js, main/main.js, preload/app.js, shared/deck-engine.js, shared/stems-dsp.js, renderer/stems.js, renderer/deck.js, renderer/library.js, renderer/automix.js, package.json, scripts/test-stems*.js, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 06f02a9aa1794c6a499c809e44524a4e6bbc07bc3545eb219306da009e4107db
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-stems-gpu-automaticos

## Contexto

En v0.14.0 los stems funcionan, pero solo en CPU y a mano: hay que pulsar «Separar», esperar (~1,7× tiempo real en el spike) y luego «Activar». Alejandro quiere que usen **la GPU** y que sacar voz, batería, bajo o resto sea **seamless**: que al cargar una pista los stems ya estén o se preparen solos, y que quitar la voz sea un clic. El equipo de desarrollo tiene una RTX 3090, pero la app es multiplataforma (Linux, Windows, macOS), así que la aceleración debe elegirse según el equipo y caer a CPU si no hay. `onnxruntime-node` solo trae CPU en el paquete de Linux (sin bibliotecas CUDA ni cuDNN); el diseño decide cómo conseguir GPU sin romper el instalador (spike al empezar).

## Requisitos

### REQ-1: Usar la GPU cuando exista
WHEN el equipo dispone de un acelerador compatible THE SYSTEM SHALL separar los stems en la GPU, y WHEN no lo hay o falla al iniciarse THE SYSTEM SHALL separar en CPU como hasta ahora, sin error visible, indicando en el panel de Ajustes qué dispositivo se usa.

### REQ-2: Mucho más rápido que el tiempo real
WHEN la separación usa GPU THE SYSTEM SHALL terminar una pista de 4 minutos en menos de 60 s en una GPU de gama media o alta, y SHALL medirlo y mostrarlo (factor de tiempo real) en Ajustes para que el usuario sepa qué esperar.

### REQ-3: Sin aceleración, sin bloqueo
THE SYSTEM SHALL mantener los decks y el audio sin cortes ni saltos mientras se separa, tanto en GPU como en CPU, y SHALL no superar la memoria de vídeo ni la RAM disponibles (si no caben, cae a CPU o a un tamaño de bloque menor).

### REQ-4: Preparar los stems solos
WHEN el usuario carga una pista local en un deck, o una pista entra en la cola de AutoMix, THE SYSTEM SHALL ponerla en la cola de separación automáticamente (ajuste «Preparar stems solos», activado por defecto solo si hay GPU), dando prioridad a la pista del deck y a la siguiente de AutoMix.

### REQ-5: Stems siempre a un clic
WHEN una pista tiene stems THE SYSTEM SHALL permitir silenciar o aislar voz, batería, bajo o resto desde el deck sin pasos previos (sin «Activar»), y WHEN todavía se están preparando THE SYSTEM SHALL mostrar el progreso y aplicar la acción pedida en cuanto estén.

### REQ-6: Reproducir sin esperar
WHILE los stems de la pista cargada se están preparando THE SYSTEM SHALL dejar sonar la pista completa sin interrupción, y WHEN terminan THE SYSTEM SHALL cambiar a los stems en la misma posición, sin salto ni chasquido.

### REQ-7: Ocupar poco y limpiar
THE SYSTEM SHALL limitar el espacio que usan los stems (ajuste en GB, 5 por defecto), borrando primero los de pistas menos usadas, y SHALL informar de lo que ocupan.

### REQ-8: Modelo y permisos
THE SYSTEM SHALL conservar la regla de pedir permiso antes de descargar el modelo (y cualquier biblioteca de GPU adicional), indicando origen y tamaño, y SHALL no descargar nada si el usuario lo rechaza.

## Fuera de alcance

- Separar pistas de streaming en vivo.
- Más de cuatro stems o modelos distintos a HTDemucs.
- Usar los stems dentro de las transiciones de AutoMix (por ejemplo, quitar la voz de la saliente): cambio aparte.
