---
change: 2026-10-31-automix-vista-video
status: approved
rev: 1
approved_rev: 1
approved_hash: 1dc4e1ed7e886259e829ca0c188dc73e34eb5d409425eb85a0b1bff6ededc221
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-automix-vista-video

## Enfoque

Un interruptor «Vista» (botón en la cabecera de la vista AutoMix y atajo `V` con la vista abierta) pone `body.am-stage`. Con esa clase, CSS oculta `.console` (decks, mezclador) sin sacarlos del DOM, así que el audio, los bucles y el estado de los decks no se tocan. En su lugar aparece `#stage`: dos teselas (A y B) encima de la cola de AutoMix.

La decisión de qué mostrar en cada tesela vive en una función pura, `pickMedia`, en `renderer/ministage.js`, para poder probar la regla «el video es el correcto» sin Electron. Cada tesela tiene su propio `<video>` con un `LocalVideo`; no se reutiliza el del deck oculto.

**Garantía de video correcto:** el deck guarda `videoKey` (el id de pista para el que se resolvió `videoSrc`). `pickMedia` solo devuelve `video` si `videoKey === track.videoId`, `source === 'local'` y hay `videoSrc`; el deck vacía `videoSrc` y `videoKey` en cuanto se carga otra pista, antes de la consulta asíncrona. Además, la tesela recuerda el `videoKey` que montó y, si cambia, quita el `src` en el mismo fotograma, así nunca queda un video viejo bajo un título nuevo.

**Al aire:** peso de cada deck = `playing ? channelGain() * xf : 0`; la tesela con mayor peso lleva `.air`, la otra `.wait`. Con ambos pesos > 0,15 (mezcla en curso) ambas llevan `.air`.

**Tamaño:** `--stage-w` (ancho de cada tesela, 160–560 px, alto por `aspect-ratio: 16/9`). Un asa en la esquina inferior derecha de la franja cambia el valor con arrastre de puntero; `[` y `]` lo cambian de 20 en 20 px. Se guarda en `localStorage` junto con si la vista estaba activa (`stage` y `stageW`), con try/catch.

**Sincronía:** `MiniStage.tick(now)` se llama desde el bucle de `app.js` y, cada 250 ms por tesela, aplica `LocalVideo.apply({t, playing, rate, at})` con los datos del deck (misma lógica que la miniatura del plato).

## Contratos

```js
// renderer/ministage.js
pickMedia({ trackId, videoKey, videoSrc, source, frameUrl, frameAgeMs, miniVideo })
  -> { kind: 'video', src } | { kind: 'frame', src } | { kind: 'cover', label?: 'Solo audio' }
airWeights(decks[{playing, gain, xf}]) -> [{ air: bool }]
clampWidth(px) -> number   // 160..560
```

Reglas de `pickMedia`: `miniVideo === false` → `cover` sin etiqueta; `videoKey !== trackId` o sin `videoSrc` con `source === 'local'` → `cover` con «Solo audio»; `source === 'stream'` con fotograma de menos de 1500 ms → `frame`; en otro caso `cover`.

Persistencia: `localStorage['alyssdj.stage'] = {"on":bool,"w":number}`.

## Visual Spec

- Franja `#stage` sobre la cola, fondo `--bg`, borde inferior `--line`, teselas centradas con 12 px de separación; 16 px de margen lateral en ventanas estrechas (las teselas se apilan por debajo de 520 px de ancho).
- Tesela: video o portada a 16:9, esquinas de 8 px, letra del deck (A/B) arriba a la izquierda sobre fondo semitransparente, título (1 línea, elipsis) y artista abajo con degradado, tiempo restante a la derecha, barra de progreso de 3 px en el borde inferior.
- `.air`: borde de 2 px del color del deck y brillo suave; `.wait`: opacidad 0,6. Transición de 200 ms solo en opacidad y borde (respeta `prefers-reduced-motion`).
- Etiqueta «Solo audio»: píldora pequeña abajo a la derecha, texto de 11 px, contraste ≥ 4,5:1.
- Asa de tamaño: 16×16 px con área táctil de 32×32, cursor `nwse-resize`, `aria-label="Cambiar tamaño de las miniaturas"`; el botón «Vista» tiene `aria-pressed`.
- Con `am-stage` activo también se aplica el compacto de AutoMix a la biblioteca para que la cola tenga todo el alto restante.

## Domain deltas
### automix
#### ADDED spec: Vista de video sin decks grandes
WHEN el usuario activa «Vista de video» en la pestaña AutoMix THE SYSTEM SHALL ocultar los decks y el mezclador, mostrar una miniatura por deck con título, tiempo restante y progreso, y resaltar el deck al aire; al desactivarla o salir de la pestaña SHALL restaurar la consola sin perder el estado de los decks.
#### ADDED design: Vista de video (MiniStage)
`body.am-stage` oculta `.console` y `.waves` sin sacarlos del DOM; `#stage` muestra dos teselas. `airWeights` usa fader² × crossfader (sin volumen general) y resalta ambas con mezcla en curso (> 0,15 en los dos).
### video
#### ADDED spec: Miniatura de video correcta y redimensionable
WHILE una miniatura de la vista de video muestra video THE SYSTEM SHALL reproducir solo el video cuyo id coincide con la pista cargada en el deck, sincronizado con el audio; IF no coincide o la pista no tiene video real THEN SHALL mostrar su portada («Solo audio»). El ancho de cada miniatura SHALL poder cambiarse entre 160 y 560 px en 16:9 y recordarse; el doble clic abre la ventana de video del deck.
#### ADDED design: videoKey y pickMedia
El deck guarda `videoKey` (id de la pista a la que pertenece `videoSrc`) y lo vacía al cargar otra pista; `pickMedia` (renderer/ministage.js) solo devuelve `video` si `videoKey === trackId` y el deck suena desde archivo. Tamaño y estado se guardan en `localStorage['alyssdj.stage']`.
### ui
#### ADDED design: Franja #stage
Teselas 16:9 con borde del color del deck al aire (`.air`) y opacidad 0,6 en espera; asa de 32 px (`role=slider`, flechas y `[` `]`); por debajo de 520 px de ancho se apilan.

## Amendments
