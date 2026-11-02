---
change: 2026-11-02-preescucha-libreria
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-11-02-preescucha-libreria

## Enfoque

Un módulo nuevo, `renderer/preview.js`, con un singleton `preview` que posee **un único** `HTMLAudioElement` (así REQ-3 se cumple por construcción: iniciar otra pista solo cambia su `src`). La Librería no sabe de audio: pide `preview.toggle(row, analysis)` y se repinta con los eventos del singleton.

- **Fuente:** `fileUrl(track, analysis)` de `mixpreview.js` (archivo local de la pista o copia guardada por el análisis). Sin URL → ▶ deshabilitado con ayuda (REQ-5); nunca se descarga nada.
- **Salida:** el elemento va por la salida de auriculares con `el.setSinkId(await YTDJChain.findSinkId(cueLabel))`, igual que el cue del DSP; sin `cueLabel` usa la salida por defecto (REQ-1). No pasa por los decks ni por el master.
- **Inicio:** `startAt(analysis, duration)` es una función pura: `mix.mixIn` ?? `offset` si existe y es < 90 % de la duración; si no, 25 % de la duración (REQ-2).
- **Una a la vez:** `toggle` en la misma pista la para; en otra, cambia `src` y arranca; al `ended` se para y se emite `end` (REQ-3).
- **Progreso y salto:** cada fila lleva `<div class="pv-bar"><i></i></div>` dentro de la celda del título; `preview` emite `tick` ~4 veces por segundo con `{id, t, dur}` y la Librería solo toca la barra de la fila activa (sin repintar la tabla). Pulsar la barra llama a `seek(frac)` (REQ-4).
- **Sin interferir:** un intervalo de 250 ms mientras suena: si no hay `cueLabel` y algún deck está sonando (`app.decks.A/B.st.playing`) la preescucha se para con un aviso; con auriculares configurados sigue (REQ-6). También se para al cerrar la ventana (`pagehide`).

## Contratos

```js
// renderer/preview.js
export function startAt(analysis, duration)          // → segundos
export const preview = {
  state: { id, playing, t, dur },                    // pista activa o null
  async toggle(track, analysis, { cueLabel, decks }) // → true si suena
  seek(frac), stop(),
  on(fn)                                             // fn({type:'start'|'tick'|'end', ...})
}
```

Atributos de la fila: botón `data-act="prev"` (clase `pv`, `.on` mientras suena, `disabled` sin archivo); barra `.pv-bar` con `--p` (0–1).

## Visual Spec

- El ▶ de preescucha va al **principio** de la celda de acciones, más pequeño que A/B, con el mismo estilo de botón ghost; en marcha cambia a ■ y toma el color de acento.
- La barra de progreso es una línea de 3 px en la base de la celda del título, acento al 100 %, pista al 15 %; al pasar el cursor crece a 6 px para facilitar el clic. Sin animaciones salvo el avance real.
- Deshabilitado: opacidad 0,35 y `title` «Solo por streaming: guarda la pista para preescucharla».
- Respeta `prefers-reduced-motion` (no hay transiciones propias).

## Amendments
