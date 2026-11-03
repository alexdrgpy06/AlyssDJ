# 01 · Proceso principal (`main/`)

<!-- Generado por scripts/arquitectura-gen.js desde docs/arquitectura/modulos.json: no editar a mano (edita el registro y regenera). -->

Todo lo que corre en Node/Electron sin DOM: ventanas, procesos hijos (yt-dlp, ffmpeg, stems), disco y red. La lógica pura (sin Electron) se prueba desde `scripts/test-*.js` sin abrir la app.

24 módulos.

### `main/analysis-backlog.js`

**Dominio:** analysis · **Líneas:** 203

Cola de análisis de listas: guarda en disco las pistas pendientes y se las va dando al Analyzer de a una, solo cuando este está libre (lo pedido a mano pasa primero) y mientras yt-dlp no esté bloqueado por la comprobación de bot.

| Exporta | Qué hace |
|---|---|
| `Backlog` | — |
| `STATES` | — |

<details><summary>Métodos con contrato (3)</summary>

| Método | Qué hace |
|---|---|
| `flush()` | Escritura atómica: archivo temporal y renombrar, para no dejar la cola a medias si se cierra la app. |
| `onAnalyzerEvent(ev)` | Eventos del Analyzer ({ id, stage, progress?, error? }). |
| `start()` | Arranque: retomar lo que quedó pendiente. |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica **sin prueba**

### `main/analysis-worker.js`

**Dominio:** analysis · **Líneas:** 10

Hilo de trabajo del análisis: recibe el audio decodificado de analyzer.js, llama a shared/analysis.js y devuelve la forma de onda, el BPM y la rejilla sin bloquear el proceso principal.

- **Depende de:** `main/decode.js`, `shared/analysis.js`
- **Lo usan:** —
- **Pruebas:** lógica **sin prueba**

### `main/analyze-cli.js`

**Dominio:** analysis · **Líneas:** 18

Uso: npm run analyze -- <archivo de audio> (prueba el análisis sin abrir la app)

- **Depende de:** `main/decode.js`, `shared/analysis.js`
- **Lo usan:** —
- **Pruebas:** lógica **sin prueba**

### `main/analyzer.js`

**Dominio:** analysis · **Líneas:** 193

Cola de análisis: yt-dlp → ffmpeg → análisis en worker → cache/<id>.json. Una pista a la vez para no competir con la reproducción en vivo.

| Exporta | Qué hace |
|---|---|
| `Analyzer` | — |

<details><summary>Métodos con contrato (3)</summary>

| Método | Qué hace |
|---|---|
| `setMixEdit(id, edit)` | Edición manual de los puntos de mezcla (null = volver al cálculo automático). Avisa a la interfaz. |
| `request(id, opts = {})` | opts: { meta: {title, artist, thumb}, force, keepAudio } |
| `registerSaved({ id, file, thumb, record })` | El archivo guardado entra al índice local (con etiquetas y carátula) y recibe una copia del análisis, así la pista local no se vuelve a analizar y no se duplica si ya estaba. |

</details>

- **Depende de:** `main/library-save.js`, `main/mixedit.js`, `main/ytdlp.js`
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-local.js`

### `main/auth-import.js`

**Dominio:** auth · **Líneas:** 121

Importa la sesión de YouTube Music desde un navegador instalado. Google bloquea el inicio de sesión dentro de Electron, así que se reutiliza la sesión que el usuario ya tiene en su navegador: yt-dlp (que sabe descifrar las cookies de cada navegador) las vuelca a un archivo temporal, se filtran las de youtube.com y google.com en memoria y se cargan en la sesión de la app. El temporal se borra siempre y los valores nunca se registran.

| Exporta | Qué hace |
|---|---|
| `BROWSERS` | Rutas de perfil relativas al HOME, por plataforma (yt-dlp lee las cookies de ahí). |
| `detectBrowsers` | — |
| `isYoutubeGoogle` | — |
| `parseNetscape` | Formato Netscape de yt-dlp: dominio, subdominios, ruta, seguro, expira, nombre, valor (las HttpOnly llevan el prefijo #HttpOnly_). |
| `toElectron` | — |
| `dumpCookies` | — |
| `importFromBrowser` | — |

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/login-flow-selftest.js`

### `main/decode.js`

**Dominio:** analysis · **Líneas:** 22

Decodifica cualquier archivo a PCM mono float32 con ffmpeg.

| Exporta | Qué hace |
|---|---|
| `decode` | — |

- **Depende de:** —
- **Lo usan:** `main/analysis-worker.js`, `main/analyze-cli.js`
- **Pruebas:** lógica **sin prueba**

### `main/export.js`

**Dominio:** export · **Líneas:** 113

Exportar la librería a otros programas (M3U8, CSV, Rekordbox XML). Lógica pura, sin Electron: la usan main.js y las pruebas.

| Exporta | Qué hace |
|---|---|
| `normalize` | Una pista lista para escribir. `rec` es el registro de análisis o la fila de una playlist; `ana` el análisis (si lo hay). `resolvePath(id, rec, ana)` devuelve la ruta del audio en el disco o ''. |
| `toM3u8` | — |
| `toCsv` | — |
| `toRekordbox` | — |
| `esc` | Escapa texto para XML 1.0 y quita los caracteres de control que no se admiten. |
| `fileUri` | file://localhost/ruta con cada segmento codificado (también rutas de Windows: C:\a\b → /C:/a/b). |
| `writeAtomic` | Escribe a un temporal y renombra: nunca deja un archivo a medias. |
| `safeName` | — |
| `FORMATS` | — |

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica `scripts/test-export.js` · en la app `scripts/export-selftest.js`

### `main/genres.js`

**Dominio:** genres · **Líneas:** 96

Géneros por pista: etiquetas de texto libre en userData/genres.json, aparte del análisis para que lo escrito a mano sobreviva a un reanálisis. Mapa id → { genres: string[], source: 'metadatos'|'archivo'|'manual' }. Lógica sin Electron.

| Exporta | Qué hace |
|---|---|
| `GenreStore` | — |
| `normalize` | "house; deep HOUSE / tech-house" → ['House', 'Deep House', 'Tech-house']. Quita vacíos y repetidos y limita a 5. |
| `tagFromFfmpeg` | Etiqueta «genre» del texto que imprime `ffmpeg -i` por stderr. |
| `MAX` | — |

<details><summary>Métodos con contrato (3)</summary>

| Método | Qué hace |
|---|---|
| `setManual(id, list)` | Lo escrito a mano manda. Lista vacía: quita lo manual y la pista vuelve a lo automático (si había). |
| `setAuto(id, list, source)` | Lectura automática: no pisa lo manual ni escribe si no hay nada. |
| `autoFromFile(id, file, ffmpeg, source)` | Lee la etiqueta de un archivo con ffmpeg (sin ffprobe) y la guarda como automática. |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-generos.js` · en la app `scripts/generos-selftest.js`

### `main/library-save.js`

**Dominio:** library · **Líneas:** 111

Lógica pura (sin Electron) de "guardar en la librería local": dónde se guarda, con qué argumentos de yt-dlp, cómo se encuentra lo ya guardado y cómo se limpian los parciales. La usan el analizador y las pruebas.

| Exporta | Qué hace |
|---|---|
| `ensureWritableDir` | Crea la carpeta solo si es realmente escribible. Comprueba antes el primer ancestro existente: un `mkdir -p` recursivo sobre rutas como /proc puede quedarse en bucle en el proceso principal y colgar toda la app. |
| `formatArgs` | Selección de formato: 'audio' = mejor audio por bitrate; 'any' = cualquier audio (aunque venga con video), para el reintento. |
| `defaultLibraryDir` | — |
| `withLibraryDir` | La carpeta de la librería de YouTube forma parte de las carpetas de música (sin duplicarse). |
| `wantsSave` | ¿Hay que descargar para guardar? Sí si la opción está activa (o se pidió expresamente) y aún no está guardada. |
| `saveArgs` | Argumentos de yt-dlp: mejor audio disponible, original sin convertir, etiquetas y carátula aparte. |
| `findSaved` | Archivo de audio ya guardado para un id de YouTube (el id va entre corchetes en el nombre). |
| `findThumb` | — |
| `cleanPartials` | Tras un fallo no deben quedar parciales de ese id (ni .part, ni .ytdl, ni la miniatura suelta). |
| `friendlyError` | — |
| `safeId` | — |

- **Depende de:** —
- **Lo usan:** `main/analyzer.js`, `main/main.js`, `main/ytdlp.js`
- **Pruebas:** lógica **sin prueba**

### `main/local-library.js`

**Dominio:** library · **Líneas:** 185

Música local: carpetas del disco y archivos sueltos. Índice persistente con título/artista/duración (vía ffmpeg).

| Exporta | Qué hace |
|---|---|
| `LocalLibrary` | — |
| `EXT` | — |

<details><summary>Métodos con contrato (4)</summary>

| Método | Qué hace |
|---|---|
| `scan(dirs)` | Añade/actualiza los archivos de las carpetas y lanza la lectura de etiquetas en segundo plano. |
| `register(p)` | Registra un archivo suelto (arrastrado a un deck) y espera a leer sus etiquetas para que el deck las muestre. |
| `setCover(id, src)` | Carátula externa (p. ej. la miniatura que bajó yt-dlp): se copia a la caché de carátulas y se borra el original. |
| `probe(p, id)` | ffmpeg -i imprime duración y etiquetas por stderr; así no hace falta ffprobe. |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica **sin prueba**

### `main/local-search.js`

**Dominio:** library · **Líneas:** 116

Búsqueda sobre todo lo que hay en el equipo: música local, análisis guardados, playlists importadas y géneros. Sin red y sin rutas: cada resultado se identifica por id. Los datos entran por `build(items)`; main los reúne.

| Exporta | Qué hace |
|---|---|
| `LocalSearch` | — |
| `keysCompatible` | Misma regla que renderer/camelot.js (la prueba comprueba que no se separen). |
| `norm` | Búsqueda sobre todo lo que hay en el equipo: música local, análisis guardados, playlists importadas y géneros. Sin red y sin rutas: cada resultado se identifica por id. Los datos entran por `build(items)`; main los reúne. |

<details><summary>Métodos con contrato (3)</summary>

| Método | Qué hace |
|---|---|
| `build(items)` | items: [{ videoId, title, artist, album, duration, thumb, local, bpm, camelot, genres: [], source }]. Una misma videoId de varias fuentes se fusiona: gana el dato presente y se acumulan las etiquetas de fuente. |
| `search(q, { bpm, key, compatKey = false, genres, limit = 200 } = {})` | q: texto (vacío = todo con los filtros). filtros: bpm [min,max], key (exacta o compatible), genres (alguno), onlyLocal. |
| `similar(videoId, limit = 10)` | Pistas analizadas parecidas a `videoId` (BPM ±6 % también a mitad/doble y tonalidad compatible), de más a menos cercana. |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica `scripts/test-local.js` · en la app `scripts/local-selftest.js`

### `main/main.js`

**Dominio:** app · **Líneas:** 705

Arranque de Electron: crea la ventana de la interfaz y las de los decks (YouTube Music), registra el protocolo app:// y todos los canales IPC, y enlaza los módulos de main/.

| Exporta | Qué hace |
|---|---|
| `loggedIn` | — |

- **Depende de:** `main/analysis-backlog.js`, `main/analyzer.js`, `main/auth-import.js`, `main/export.js`, `main/genres.js`, `main/library-save.js`, `main/local-library.js`, `main/local-search.js`, `main/net-gate.js`, `main/playlists.js`, `main/settings.js`, `main/stems-device.js`, `main/stems.js`, `main/tools.js`, `main/updater.js`, `main/ytdlp.js`, `main/ytm-library.js`
- **Lo usan:** —
- **Guarda:** `userData:analysis-queue.json`, `userData:genres.json`, `userData:local-index.json`, `userData:playlists-local.json`, `userData:playlists.json`, `userData:popularity.json`
- **Nota:** Mezcla arranque, ventanas, protocolo app:// y todos los canales IPC en un solo archivo (705 líneas): candidato a dividir por dominio.
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-export.js` · en la app `scripts/login-flow-selftest.js`

### `main/mixedit.js`

**Dominio:** automix · **Líneas:** 50

Ediciones manuales de los puntos de mezcla de una pista. Van en un archivo aparte (<id>.mixedit.json) para que volver a analizar la pista no las borre.

| Exporta | Qué hace |
|---|---|
| `sanitize` | Deja la edición en su forma canónica: entrada dentro de la pista y hasta 6 salidas sin repetir, en orden de preferencia. |
| `read` | — |
| `write` | edit = null restaura el cálculo automático. Devuelve la edición guardada (o null). |
| `MAX_OUTS` | — |

- **Depende de:** —
- **Lo usan:** `main/analyzer.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/mix-edit-selftest.js`

### `main/net-gate.js`

**Dominio:** platform · **Líneas:** 27

Modo local: si el ajuste `localMode` está activo, la app no hace ninguna petición de red. Todo punto que sale a internet pregunta aquí (búsqueda online, sesión de YouTube Music, actualizaciones, descarga de herramientas y modelos, yt-dlp).

| Exporta | Qué hace |
|---|---|
| `createGate` | — |
| `MESSAGE` | Modo local: si el ajuste `localMode` está activo, la app no hace ninguna petición de red. Todo punto que sale a internet pregunta aquí (búsqueda online, sesión de YouTube Music, actualizaciones, descarga de herramientas y modelos, yt-dlp). |

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica `scripts/test-local.js`

### `main/playlists.js`

**Dominio:** library · **Líneas:** 207

Playlists locales: listas manuales y listas inteligentes guardadas en `userData`. Lógica pura, sin Electron: la usan main.js y las pruebas. No toca nunca archivos de música; las pistas se guardan sin rutas (la ruta se resuelve al abrir la lista).

| Exporta | Qué hace |
|---|---|
| `PlaylistStore` | — |
| `SORT_KEYS` | — |

<details><summary>Métodos con contrato (4)</summary>

| Método | Qué hace |
|---|---|
| `add(id, tracks, { allowDup = false } = {})` | Añade al final sin repetir la pista en la misma lista, salvo `allowDup`. |
| `restore(id, removed)` | Deshace `remove`: cada pista vuelve a su posición original (de menor a mayor índice). |
| `reorder(id, videoIds)` | Orden manual: `videoIds` es el nuevo orden; las pistas que falten se quedan al final. |
| `fromCrate(crate, name)` | Copia una playlist importada de YouTube Music (`{ id, title, tracks }`) como lista local editable. |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica **sin prueba** · estática `scripts/test-playlists.js` · en la app `scripts/playlists-selftest.js`

### `main/selftest.js`

**Dominio:** platform · **Líneas:** 68

Autoprueba (YTDJ_SELFTEST=1): todo con los canales en 0, no suena nada. Escribe capturas y un informe JSON en YTDJ_SELFTEST_OUT.

| Exporta | Qué hace |
|---|---|
| `selftest` | — |

- **Depende de:** —
- **Lo usan:** —
- **Guarda:** `userData:selftest.json`
- **Pruebas:** lógica **sin prueba**

### `main/settings.js`

**Dominio:** settings · **Líneas:** 76

Ajustes persistentes en userData/settings.json.

| Exporta | Qué hace |
|---|---|
| `get` | — |
| `set` | — |
| `defaults` | — |

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Guarda:** `userData:settings.json`
- **Pruebas:** lógica `scripts/test-fx.js` · estática `scripts/test-local.js` · en la app `scripts/ajustes-selftest.js`

### `main/stems-device.js`

**Dominio:** stems · **Líneas:** 103

Selector de dispositivo para los stems: qué proveedor de ONNX Runtime usar (GPU o CPU), con sondeo y caché. El sondeo lo hace el proceso hijo (`stems-worker.js`, mensaje `probe`): separa una ventana sintética en el proveedor y en CPU, y devuelve { ok, rt, cpuRt, snr }. Aquí solo se decide y se recuerda: `userData/stems/device.json`.

| Exporta | Qué hace |
|---|---|
| `DeviceSelector` | — |
| `candidates` | Proveedores a intentar por plataforma, de más a menos deseable; `cpu` no se lista (es el último recurso). |
| `hasCuda` | ¿Están las bibliotecas de CUDA junto a onnxruntime-node? (el paquete no las trae: se instalan aparte) |
| `MIN_SNR` | — |
| `LABELS` | — |

<details><summary>Métodos con contrato (4)</summary>

| Método | Qué hace |
|---|---|
| `info()` | Resultado vigente sin sondear (para pintar Ajustes): { device, label, rt, probe }. |
| `select()` | Elige el dispositivo: usa la caché si es de esta versión de app y de modelo; si no, sondea de a uno en orden. |
| `markBad(provider, reason)` | El proveedor murió o dio error en una pista real: se descarta hasta que cambie la versión de la app o del modelo. |
| `noteRt(provider, rt)` | Velocidad medida en una pista real: sustituye a la del sondeo (más fiel, con música de verdad). |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Guarda:** `userData:device.json`
- **Pruebas:** lógica `scripts/test-stems.js`

### `main/stems-worker.js`

**Dominio:** stems · **Líneas:** 178

Proceso hijo de la separación de stems: decodifica la pista, ejecuta HTDemucs (ONNX) por ventanas y escribe un FLAC de 8 canales (batería, bajo, resto, voz; L y R de cada uno) por trozos. Se lanza con `child_process.fork` y habla por IPC. padre → hijo: { type: 'start', file, out, ffmpeg, model, maxSeconds, provider, variant } | { type: 'cancel' } { type: 'probe', model, provider } (sondeo: una ventana sintética en `provider` y en CPU) hijo → padre: { type: 'progress', progress, etaS, rssMB } | { type: 'done', bytes, rt } | { type: 'error', code, error } { type: 'probe', ok, rt, cpuRt, snr, error? } variant 'cpu': htdemucs.ort con la STFT fuera (entradas input + x); 'gpu': ONNX con la STFT dentro (mix → stems).

- **Depende de:** `shared/stems-dsp.js`
- **Lo usan:** —
- **Pruebas:** lógica **sin prueba**

### `main/stems.js`

**Dominio:** stems · **Líneas:** 329

Almacén de stems: una pista a la vez, en un proceso hijo de baja prioridad, con cancelación y límites. Guarda `userData/stems/<id>.flac` (8 canales: batería, bajo, resto, voz) y un índice `index.json`.

| Exporta | Qué hace |
|---|---|
| `StemStore` | — |
| `ModelManager` | Modelo bajo demanda: pide permiso, descarga a `.part`, verifica el SHA-256 y renombra. Una descarga a la vez. |
| `ModelSet` | Las dos variantes con la misma carpeta y el mismo flujo de permiso: path(v), present(v), ensure(v), status(). |
| `MODEL` | — |
| `MODELS` | Dos variantes del mismo modelo: `cpu` (formato ORT optimizado para CPU, STFT fuera del grafo) y `gpu` (ONNX sin optimizar, STFT dentro; el único que corre entero en CUDA/DirectML/CoreML/WebGPU). La de GPU solo se pide cuando hay un dispositivo útil. |
| `available` | ¿Puede esta instalación separar? Comprueba que onnxruntime-node trae el binario de esta plataforma (no hay para Mac Intel). |
| `probeDevice` | Sondeo de un proveedor en un hijo aparte: { ok, rt, cpuRt, snr } o { ok: false, error } (también si el hijo muere o tarda). |
| `MAX_SECONDS` | — |
| `MAX_RSS_MB` | — |

<details><summary>Métodos con contrato (4)</summary>

| Método | Qué hace |
|---|---|
| `touch(id)` | Marca una pista como usada ahora (se carga en un deck): los menos usados son los primeros en borrarse por cuota. |
| `trim(limitBytes, except = [])` | Cuota: borra primero los menos usados hasta caber en `limitBytes`, sin tocar `keep` (decks) ni `except` (la recién hecha). Devuelve los ids borrados y avisa con un evento 'trimmed'. |
| `request(id, file, priority = 2)` | Encola una pista. `file`: ruta del audio local. `priority`: 0 = pista de un deck, 1 = siguiente de AutoMix, 2 = el resto (por defecto). Una petición de menor número adelanta a las demás; a igual prioridad, por orden de llegada. Devuelve false si ya la tiene o ya está en marcha; pedir de nuevo una que espera la sube de prioridad. |
| `runChild(job, cur, part, model, plan)` | Lanza el hijo con un plan { provider, variant } y espera su resultado: { ok, bytes } \| { code, error }. |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Guarda:** `userData:index.json`, `userData:package.json`
- **Pruebas:** lógica `scripts/test-stems.js` · en la app `scripts/playlists-selftest.js`

### `main/tools.js`

**Dominio:** install · **Líneas:** 155

Herramientas externas que AlyssDJ necesita: yt-dlp (se descarga solo, binario oficial) y ffmpeg. Lo usan tanto scripts/setup.js (npm install) como la app al arrancar, así que no depende de Electron.

| Exporta | Qué hace |
|---|---|
| `ensureYtdlp` | Descarga el binario oficial de yt-dlp a `dir` si no hay ninguno utilizable. Devuelve { bin, version, installed }. |
| `findYtdlp` | Busca yt-dlp en las carpetas dadas (la propia del proyecto/app primero) y luego en el sistema. |
| `findFfmpeg` | ffmpeg: el configurado, el de bin/ (descargado por nosotros), el del sistema o el del paquete opcional ffmpeg-static. |
| `ensureFfmpeg` | — |
| `ffmpegUrl` | — |
| `maybeUpdate` | yt-dlp se rompe cuando YouTube cambia: si el binario es el nuestro y tiene más de STALE_DAYS, se actualiza solo. |
| `installHint` | — |
| `BIN_NAME` | — |

- **Depende de:** —
- **Lo usan:** `main/main.js`, `main/ytdlp.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/packaged-selftest.js`

### `main/updater.js`

**Dominio:** updater · **Líneas:** 93

Actualizaciones: comprueba si hay un release nuevo en GitHub (solo la API pública, sin enviar datos personales), avisa, y descarga e instala solo si el usuario lo acepta y no hay un deck sonando. En macOS sin firma solo avisa.

| Exporta | Qué hace |
|---|---|
| `createUpdater` | deps: { autoUpdater, settings, send, isPlaying, platform, isPackaged, now }. Todo inyectable para probarlo sin Electron. |
| `REPO` | — |
| `HOURS` | — |

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica `scripts/test-local.js` · estática `scripts/test-updater.js` · en la app `scripts/updater-selftest.js`

### `main/ytdlp.js`

**Dominio:** install · **Líneas:** 158

Descarga bajo demanda con yt-dlp. Nunca se llama sola: solo cuando el usuario pide "Analizar" (o activó "analizar al cargar en cue").

| Exporta | Qué hace |
|---|---|
| `download` | Descarga el audio de un videoId. 141 = AAC 256k (solo Premium con cookies); si no, el mejor disponible. |
| `downloadToLibrary` | Descarga directo a la librería local: mejor audio disponible, original sin convertir, etiquetas incrustadas y carátula en .thumbs (el índice local la recoge). Si falla, no quedan parciales. |
| `findYtdlp` | — |
| `setManagedDirs` | — |
| `cookieArgs` | yt-dlp va SIN sesión: las cookies de la cuenta son solo para el streaming de los decks. Con cookies, YouTube obliga a clientes web que hoy no entregan formatos de audio ("Requested format is not available"). Solo si el usuario lo pide a mano (opción avanzada) se usan las de un navegador. |
| `runtime` | — |
| `isFormatError` | — |
| `withFormatRetry` | Ejecuta `run(formato)`; si YouTube dice "formato no disponible", un solo reintento con la selección más abierta. |
| `FORMAT_ERROR` | — |
| `isBotError` | — |
| `botBlocked` | — |
| `resetBot` | — |
| `BOT_ERROR` | — |
| `BOT_COOLDOWN_MS` | — |

- **Depende de:** `main/library-save.js`, `main/tools.js`
- **Lo usan:** `main/analyzer.js`, `main/main.js`
- **Pruebas:** lógica **sin prueba** · en la app `scripts/login-flow-selftest.js`

### `main/ytm-library.js`

**Dominio:** library · **Líneas:** 275

Biblioteca de YouTube Music a través de la API interna (innertube) que usa la propia web, ejecutada dentro de una vista de music.youtube.com con tu sesión: búsqueda, "Me gusta", playlists.

| Exporta | Qué hace |
|---|---|
| `PAGE_CALL` | Se ejecuta en el main world de music.youtube.com (necesita window.ytcfg y las cookies de la página). |
| `parsePlays` | — |
| `YtmLibrary` | — |
| `parseSongs` | — |
| `parsePlaylists` | — |
| `parseRadio` | Radio de YouTube Music ("Iniciar radio"): cola infinita de pistas parecidas a la semilla. |

<details><summary>Métodos con contrato (1)</summary>

| Método | Qué hace |
|---|---|
| `popularity(videoId)` | Reproducciones de una pista (endpoint `player` de YouTube Music: videoDetails.viewCount). Caché de 30 días y 3 consultas a la vez. |

</details>

- **Depende de:** —
- **Lo usan:** `main/main.js`
- **Pruebas:** lógica **sin prueba**

