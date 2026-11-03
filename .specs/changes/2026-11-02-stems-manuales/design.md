---
change: 2026-11-02-stems-manuales
status: approved
rev: 1
approved_rev: 1
approved_hash: 066e5e77bebd31c2944be11e9d886578c0b80ef22812cb2089a355513c9cefc5
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-stems-manuales

## Enfoque

Evidencias del spike (`~/Documents/Knowledge/01_Projects/AlyssDJ/spike-stems.md`): HTDemucs ONNX (`gridshiftstudio/htdemucs-ort`, 209 884 896 B, SHA-256 `09dc1655…c729`) en `onnxruntime-node` (CPU), ~1,7× tiempo real; con `enableCpuMemArena:false` y `enableMemPattern:false` el pico baja de 5 GB a ~1 GB. Además, un único `<audio>` con un FLAC de **8 canales** (4 stems × estéreo) entrega los 8 canales discretos al grafo de Web Audio en Electron (probado con WAV y FLAC): la sincronía, el keylock, los loops y el seek se heredan del elemento y no hace falta mantener cuatro elementos alineados.

### Separación (proceso principal + hijo)
- `shared/stems-dsp.js` (puro, sin ONNX ni DOM): `stft`/`istft` de Demucs (n_fft 4096, hop 1024, Hann, `normalized`, reflect, canal = c·2+re/im), `normalizeStats`, ventanas de 343 980 muestras con salto de 171 990 y pesos triangulares, y un `Separator` que recibe una función `infer(input, x) → { time, freq }` (la real usa ORT; las pruebas, una falsa). Emite audio **ya final** por trozos (todo lo anterior al inicio de la siguiente ventana), así la memoria no crece con la duración.
- `main/stems-worker.js` (hijo con `child_process.fork`, `ELECTRON_RUN_AS_NODE=1`): decodifica con ffmpeg a f32 estéreo 44,1 kHz, normaliza, ejecuta ORT con las opciones de memoria del spike y manda cada trozo por stdin a `ffmpeg -f f32le -ar 44100 -ac 8 -i - -c:a flac -sample_fmt s16` (orden de canales: batería, bajo, resto, voz; L/R de cada uno). Mensajes `{progress, etaS}`, `{done, bytes}`, `{error, code}`. El padre le baja la prioridad (`os.setPriority(pid, 10)`).
- `main/stems.js` (`StemStore`): almacén en `userData/stems/<id>.flac` + `index.json` (`{id: {file, bytes, at, model}}`), cola de una pista a la vez (REQ-3), cancelación (mata el hijo y borra `<id>.flac.part`), escritura a `.part` que se renombra al terminar, `remove(id)`, `usage()`. Límite: el límite de 1,5 GB es de diseño (sesión ORT sin arena + salida por trozos); el padre mata el hijo si su RSS supera 2 GB y devuelve `code: 'memoria'`. Pistas de más de 15 min se rechazan (`code: 'larga'`).
- **Modelo bajo demanda (REQ-4):** `ModelManager` en `main/stems.js`. Antes de descargar, el proceso principal abre un `dialog.showMessageBox` con nombre, origen (URL de huggingface) y tamaño (≈ 210 MB) y solo descarga si el usuario acepta; descarga a `userData/models/htdemucs.ort.part` con progreso, comprueba el SHA-256 y renombra; si no coincide borra y falla con `code: 'modelo'`.
- **Disponibilidad:** `StemStore.available()` intenta `require('onnxruntime-node')` y comprueba plataforma; `onnxruntime-node` 1.31 solo trae binarios para linux x64/arm64, win32 x64/arm64 y **darwin arm64** (no Mac Intel): allí el botón queda deshabilitado con «Stems no está disponible en este equipo» (REQ-8).
- **Empaquetado:** `onnxruntime-node` pasa a `dependencies`. Con `asar: false` no hace falta `asarUnpack`. Para que cada instalador lleve solo su plataforma se añaden filtros `files` por sistema (`!node_modules/onnxruntime-node/bin/napi-v6/!(win32)/**` en win, etc.); coste aproximado del instalador: Linux +48 MB, Windows +69 MB, macOS arm64 +45 MB.

### Reproducción en el deck
- `deck-engine` gana la operación `stems`: `on {url}` crea un segundo `<audio>` con el FLAC de 8 canales, copia `currentTime`, `playbackRate` y `preservesPitch`, espera `canplay`, lo arranca si el deck sonaba, lo conecta con `attach()` a través de una **matriz** (`ChannelSplitter(8)` → 4 `GainNode` estéreo vía `ChannelMerger` → `chain.input`) y pausa el original; `off` deshace el cambio; `gain {i, v}` aplica `setTargetAtTime` (≈ 15 ms) para evitar chasquidos (REQ-5). El estado del deck incluye `stems: {on, gains}`.
- Mientras los stems están en uso, el plato usa el respaldo sin buffer (freno/arranque suaves y búsqueda al arrastrar): el scratch con buffer decodifica el archivo original y no el de 8 canales.
- Mute/solo: cada stem es `mute` (ganancia 0) o `solo` (el resto a 0); varios solos se suman; `Ctrl/Mayús+clic` = solo, clic = mute.

### Interfaz
- **Deck:** una tira «STEMS» bajo los controles de loop con cuatro botones (Voz, Batería, Bajo, Resto). Sin stems: botón «Separar» (o «Preparando… 37 %, ≈ 1:20» con ✕ para cancelar). Con stems en el almacén pero sin activar: «Activar stems». Los botones tienen `aria-pressed`, etiqueta y no dependen solo del color.
- **Librería:** botón `data-act="stems"` por fila (⛓ «Stems»): separa, cancela o borra según el estado; chip «STEMS» en la fila con el tamaño en el `title`; un resumen en el menú Exportar/almacén («Stems: 4 pistas, 310 MB») con «Borrar todos». Las filas sin archivo local lo deshabilitan con ayuda.
- Avisos y errores por el toast existente, en una frase con la causa (REQ-8).

## Contratos

```js
// preload: window.ytdj.stems
status()                // → { available, why?, model: { present, bytes }, usedBytes }
list()                  // → { [id]: { bytes, at } }
request(id)             // encola; pide permiso de descarga si falta el modelo
cancel(id), remove(id), removeAll()
onEvent(fn)             // { id, stage: 'queued'|'model'|'progress'|'done'|'error'|'cancelled', progress?, etaS?, error?, code? }
// motor del deck
handle({ type: 'stems', op: 'on'|'off'|'gain', url?, i?, v? })
```

Archivo de stems: FLAC 16 bit, 8 canales, 44,1 kHz, mismo largo que la pista; canales 0–1 batería, 2–3 bajo, 4–5 resto, 6–7 voz.

## Visual Spec

- Tira de 4 botones del mismo ancho, alto 28 px (≥ 24 px de objetivo táctil), estilo «ghost» de los botones del deck; activo = relleno con el color del deck; silenciado = tachado y atenuado, con `aria-pressed="true"` y texto «Voz (silenciada)» en `title`.
- Progreso: barra fina de 3 px bajo la tira con el porcentaje y el tiempo restante en texto; sin animaciones salvo el avance real; respeta `prefers-reduced-motion`.
- Colores por stem solo como acento secundario (nunca como único indicador).

## Amendments
