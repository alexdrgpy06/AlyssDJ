---
change: 2026-10-30-automix-vista-local
type: feature
domains: [automix]
paths: [renderer/automix.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, renderer/deck.js, main/analyzer.js, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: fd50d65cae03d800641b3e915f000e6b5d6406e98cc76c16e95caed6e09d4ef8
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Requirements · automix-vista-local

## Contexto
El AutoMix vive en un panel pequeño con una cola de solo lectura. El usuario quiere una vista más controlable (lista, "siguiente" para saltar cuando el cambio sea bueno, y cambios al vuelo) y que las pistas de YouTube se analicen y se pongan en modo local siempre que se pueda: así se evitan los anuncios y hay BPM para sincronizar.

## Requisitos

### REQ-1: Vista de AutoMix
WHEN el usuario abre AutoMix THE SYSTEM SHALL mostrar una vista en el área de la librería con la pista que suena (con tiempo restante), la siguiente, la cola completa y los controles de iniciar o detener, mezclar ahora, estilo y duración.

### REQ-2: Cambios al vuelo
WHEN el usuario sube, baja, arrastra, quita, vacía, añade o fija "a continuación" una pista de la cola THE SYSTEM SHALL aplicarlo al instante, incluso con una transición en curso, sin interrumpir lo que suena.

### REQ-3: Mezclar ahora
WHEN el usuario pulsa "Mezclar ahora" (o el atajo Mayús + →) THE SYSTEM SHALL iniciar la transición hacia la siguiente pista lista, con una duración corta, y avisar si la siguiente aún no está lista.

### REQ-4: Progreso de la transición
WHILE hay una transición en curso THE SYSTEM SHALL mostrar su progreso, de qué deck a cuál se mezcla y si el tempo está igualado.

### REQ-5: Siempre analizar y usar el archivo
WHEN una pista de YouTube entra en la cola THE SYSTEM SHALL ponerla en la cola del analizador (descarga sin sesión, análisis y guardado en la librería local) con la mayor antelación posible y, cuando esté lista, cargarla en modo LOCAL, mostrando por pista su estado (en cola, bajando con porcentaje, analizando, lista o falló).

### REQ-6: Pista siguiente no lista
IF la siguiente pista no está lista cuando toca mezclar THEN THE SYSTEM SHALL esperar hasta 20 s, luego pasar a la siguiente de la cola que sí esté lista y, si ninguna lo está, mezclar la primera por streaming con fundido y avisarlo.

### REQ-7: Opción de usar streaming
THE SYSTEM SHALL ofrecer en la vista un interruptor "Analizar y usar archivo (evita anuncios)", activado por defecto, y con él apagado SHALL comportarse como hasta ahora.

## Fuera de alcance
- Cancelar una transición ya iniciada.
- Editar listas guardadas; la cola es de la sesión.
