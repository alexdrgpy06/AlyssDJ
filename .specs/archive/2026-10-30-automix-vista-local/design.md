---
change: 2026-10-30-automix-vista-local
status: approved
rev: 1
approved_rev: 1
approved_hash: 5aefd6e594384c8a39d4b0a92934f9ed14e4761c1d5f926d151d971e856f32c9
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Design · automix-vista-local

## Enfoque
Sustituir el popover por una pestaña **AutoMix** de la librería (misma zona que las demás vistas) y darle al motor un estado por pista. El motor sigue en `renderer/automix.js`; la vista solo lee `snapshot()` y llama a sus métodos.

## Contratos
- Elemento de cola: `{ track, state: 'idle'|'queued'|'download'|'analyze'|'ready'|'error', progress, error }`; el estado sale de los eventos de `analysis:event` y del análisis ya existente.
- Motor: `move(i, to)`, `playNext(i)` (a la posición 0), `remove(i)`, `add(track)`, `clear()`, `mixNow()` (alias de `skip` con duración corta), `setCfg({ preferLocal, waitMs })`.
- Preparación: `prepare(item)` llama a `analysis:request(id, { save: true, meta })` para las 3 primeras pistas de YouTube de la cola; al estar lista (`analysis.saved`), el deck la carga en LOCAL (el deck ya lo hace con pistas guardadas).
- Espera: `ready(deck, track)` exige además `deck.source === 'local'` cuando `preferLocal`; tras 20 s sin estar lista se salta a la siguiente lista; si ninguna, mezcla por streaming con fundido.
- Vista: lista con asa para arrastrar, botones subir/bajar/a continuación/quitar, insignias de estado; cabecera con "Suena" y "Sigue", barra de progreso y botones Iniciar/Detener y Mezclar ahora; atajo Mayús + →.

## Decisiones
- **Pestaña en vez de popover:** deja la cola siempre visible mientras se mira la librería y los decks, y admite más pistas y controles.
- **Anticipación de 3 pistas:** suficiente para que haya archivo listo sin saturar la cola del analizador (que descarga de a una).
- **Nada de cancelar transiciones:** complica el audio y no se pidió.

## Domain deltas
### automix
#### ADDED spec: Vista de AutoMix con cola editable
WHEN el usuario abre AutoMix THE SYSTEM SHALL mostrar la pista que suena, la siguiente, la cola con el estado de cada pista y los controles, y permitir reordenar, quitar, añadir, fijar a continuación y mezclar ahora (Mayús + →) sin interrumpir la mezcla.
WHEN una pista de YouTube entra en la cola THE SYSTEM SHALL descargarla sin sesión, analizarla y guardarla con antelación y cargarla en modo LOCAL, esperando hasta 20 s y saltando a otra lista si no está a tiempo.
#### ADDED design: Pestaña AutoMix y preparación anticipada
La vista es una pestaña de la librería que lee `AutoMix.snapshot()`; el motor mantiene `prep` por pista a partir de los eventos del analizador, precarga solo pistas listas y retira de la cola la pista que entró (no «la primera») al terminar una transición.
