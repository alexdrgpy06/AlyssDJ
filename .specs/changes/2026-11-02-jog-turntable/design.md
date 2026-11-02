---
change: 2026-11-02-jog-turntable
status: approved
rev: 1
approved_rev: 1
approved_hash: b23938b0df6fa2de1f51f3d691af68454eef4ac7106d58df876894d136089651
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-jog-turntable



## Enfoque

El `<audio>` no puede ir hacia atrás ni muy lento, así que el scratch usa un reproductor propio sobre el audio decodificado, solo mientras el plato está sujeto:

1. **`shared/scratch.js`** (+ worklet `shared/scratch-worklet.js`): `AudioWorkletProcessor` que lee un buffer estéreo `Float32Array` con posición fraccionaria, velocidad en muestras por muestra (negativa incluida) e interpolación lineal. Parámetros: `pos`, `vel`, `gain`, `run`. La velocidad se suaviza con un seguidor de pendiente (≈ 8 ms) para evitar clics. Lógica pura de rampas en `shared/scratch-math.js`, comprobable sin audio.
2. **Buffer**: al primer toque, `deck.scratch.prepare()` decodifica el archivo local (`decodeAudioData` sobre `/cache/...`, o la ruta local) en el contexto del deck y lo guarda hasta cambiar de pista; hasta que esté listo (REQ-5) el plato usa freno y arranque suaves. Memoria: ≈ 100 MB para 5 min estéreo; se libera al cargar otra pista.
3. **Enrutado**: el worklet se conecta a `chain.input`. Al sujetar, `src` (MediaElementSource) se desconecta de la cadena y el `<audio>` se pausa; el worklet arranca en la posición actual con la velocidad del deck y frena (REQ-1). Al soltar, el `<audio>` hace `seek` a la posición del worklet, se reanuda con una rampa de tasa de 0 a la del deck en ≈ 300 ms (REQ-3) y se reconecta `src`; en pausa no se reanuda (REQ-4).
4. **Plato** (`renderer/deck.js`): `pointerdown` sujeta (`hold()`), `pointermove` convierte el giro en velocidad (grados × segundos de pista por vuelta / dt, con 33 rpm ⇒ 1,8 s por vuelta) y el ángulo del plato sigue al puntero; `pointerup`/`pointercancel` suelta. Si el deck es de streaming o el buffer no está listo, el mismo gesto aplica `bend` a 0,06× (freno) y `seek` al soltar, con un aviso una sola vez (REQ-5).
5. **Coherencia** (REQ-6): mientras `deck.held`, `AutoMix` no inicia transiciones sobre él (`startTransition` y `mixNow` lo comprueban); al soltar se llama a `alignPhase` si había SYNC.
6. **Prueba de viabilidad primero** (tarea 1.1): con Electron en silencio, decodificar un audio de demostración, correr el procesador sobre un `OfflineAudioContext` con velocidad negativa y comprobar que la salida es la entrada invertida; y medir memoria y tiempo de decodificación. Si no se cumple, se enmienda el diseño antes de seguir.

## Contratos

- `scratch.prepare(url) → Promise<boolean>`, `scratch.hold(pos, vel)`, `scratch.move(vel)`, `scratch.release() → pos`.
- `deck.held: boolean` y `deck.scratchReady: boolean` visibles para AutoMix y la interfaz.
- Sin cambios de disco ni de IPC.

## Decisiones

- Buffer completo y no una ventana: más sencillo y fiable; el coste de memoria es aceptable para pistas de DJ y se libera al cambiar.
- Worklet propio y no `playbackRate` negativo, que Chromium no admite.
- Un único gesto para todos los casos: lo que cambia es el motor (buffer o respaldo), no la interacción.

## Visual Spec

El plato gira con el puntero mientras está sujeto y se detiene al pulsar (clase `.held`: borde de acento y cursor `grabbing`); sin sujeción, giro normal ligado al tempo. Aviso de respaldo en un toast único («Scratch solo con audio local»). Respeta «reducir movimiento» (el giro del plato se detiene, el audio no cambia). Foco visible y objetivo táctil del plato ≥ 120 px.

## Amendments
