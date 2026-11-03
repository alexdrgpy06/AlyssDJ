---
change: 2026-11-03-automix-claro
status: approved
rev: 1
approved_rev: 1
approved_hash: 88598f014a22481cc0a784177d20f07b0c3535dd02491cdde5e92a0720d92b0f
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Design · 2026-11-03-automix-claro

## Enfoque

La claridad sale de cuatro módulos pequeños y puros, cada uno probable sin audio, y de enchufarlos en `renderAutoMix` (`renderer/app.js`) sin cambiar el motor:

- `renderer/automix-status.js` · `describe(snap)` convierte `AutoMix.snapshot()` en `{ phase, text, countdown, reason }`. Fases: `stopped` (Detenido), `playing` (Sonando), `preparing` (Preparando la siguiente), `waiting` (Esperando el punto de salida), `mixing` (Mezclando). El texto conserva las frases que ya usan las autopruebas («Mezclando A → B», «Mezclando en N s», «Detenido»).
- `renderer/automix-compat.js` · `compat(prev, item)` devuelve `{ level: 'good'|'ok'|'poor'|'unknown', why, marks }` con motivo en palabras (BPM, tonalidad, energía) y marcas `sin análisis` / `sin archivo`.
- `renderer/automix-profiles.js` · `PROFILES` (Suave, Club, Radio, Personalizado), `applyProfile(am, id)` y `detect(cfg)`; el último perfil se recuerda en `localStorage`.
- `renderer/automix-timeline.js` · `Timeline`, un `<canvas>` que dibuja, a partir de lo ya analizado (energía por frase), las dos pistas, el solape, salida, entrada, gestos de la receta y la posición, y permite arrastrar salida, entrada y duración.

**Robustez** (REQ-8) en `renderer/automix.js`: si la pista que sigue falla al cargar o se queda sin analizar, se descarta de la cabeza con una nota («Falló <título>: sigo con la siguiente») y se prepara la siguiente; si no hay ninguna lista, el deck actual sigue hasta el final en vez de quedarse parado. La nota viaja en `snapshot().note` y la línea de estado la muestra como motivo.

**Una sola vista de control** (REQ-7): los controles ya viven en la vista Automix (ver `interfaz-ordenada`); aquí solo se añade la tarjeta compacta de estado (`#amc`) que reutiliza `describe` en las demás vistas.

## Contratos

```
describe(snap) → { phase, text, countdown: number|null, reason: string }
compat(prev, item) → { level, why, marks: ['sin análisis'|'sin archivo'] }
applyProfile(am, id) → am.setCfg({ len, style, smartOrder }) + am.setFx(level)
Timeline.render(snap) ; eventos: onChange({ exitAt?, enterAt?, len? }) → analysis.setMixEdit / AutoMix.setCfg
```

Perfiles: Suave = 24 s, fundido, orden inteligente, efectos apagados; Club = 12 s, auto, orden inteligente, efectos sutiles; Radio = 32 s, fundido, orden de la cola, efectos apagados; Personalizado = lo que el usuario toque.

El «editor de la transición» del REQ-2 es la misma línea de tiempo montada en la tarjeta de la mezcla; se documenta como enmienda si cambia.

## Visual Spec

- Línea de estado: píldora con punto de color por fase (gris detenido, verde sonando, ámbar preparando/esperando, azul mezclando), texto en una frase y cuenta atrás en mono a la derecha.
- Línea de tiempo bajo la tarjeta de estado: 56 px, dos filas de barras de energía (saliente arriba, entrante abajo) con el color de cada deck, banda de solape translúcida, líneas de salida/entrada con asa, gestos de la receta como marcas finas y cabezal blanco. Foco visible; asas arrastrables y con ← →.
- Cola: el punto de calidad pasa a tres niveles con icono además de color (✓ / ~ / !), motivo en el título y marcas «sin análisis» / «sin archivo» como etiquetas pequeñas.
- Perfiles: grupo de cuatro botones junto a Estilo; el activo resaltado.
- Tarjeta compacta `#amc` en las demás vistas: fase, título que suena y cuenta atrás; clic abre la vista Automix.

## Amendments

## Domain deltas
### automix
#### ADDED spec: Estado, perfiles y robustez de AutoMix
THE SYSTEM SHALL describir en todo momento la fase de AutoMix (Detenido, Sonando, Preparando la siguiente, Esperando el punto de salida, Mezclando) con la cuenta atrás hasta la mezcla y el motivo de cualquier espera; WHERE el usuario elige un perfil (Suave, Club, Radio, Personalizado) THE SYSTEM SHALL fijar duración, estilo, orden y efectos con un clic y recordar el último; IF la pista que sigue no se puede abrir THEN THE SYSTEM SHALL descartarla, seguir con la siguiente de la cola sin silencio y explicarlo en el estado, o, si era la última, conservarla y avisar.
#### ADDED design: Módulos de estado, compatibilidad y perfiles
`renderer/automix-status.js` (`describe`), `renderer/automix-compat.js` (`compat`) y `renderer/automix-profiles.js` (`PROFILES`, `applyProfile`, `detect`); `AutoMix.failHead` descarta la cabeza que falla (`Deck.loadError` o excepción de `preload`) y `snapshot()` añade `timeline` y `compat` por elemento de la cola.
### ui
#### ADDED spec: Línea de tiempo de la mezcla
THE SYSTEM SHALL dibujar la próxima transición con la energía de la pista que sale y de la que entra, el solape, los gestos de la receta y la posición actual; WHEN el usuario arrastra la salida, la entrada o el final del solape (o usa ← → y Mayús + ← →) THE SYSTEM SHALL guardar el punto en el compás más cercano o la duración y mostrar al instante el efecto; WHERE las dos pistas son archivos locales THE SYSTEM SHALL permitir escucharla por los auriculares.
#### ADDED design: Timeline, compatibilidad en la cola y botón de la barra
`renderer/automix-timeline.js` (`Timeline`, `geometry`, `hit`) sobre `snapshot().timeline` (`AutoMix.timelineOf`); la cola pinta `compat` con ✓ ~ ! ? y etiquetas «sin análisis» / «sin archivo»; `#btn-automix` lleva `data-phase` y `#btn-automix-count` como tarjeta compacta en todas las vistas.
