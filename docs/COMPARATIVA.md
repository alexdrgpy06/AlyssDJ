# AlyssDJ frente a Rekordbox, djay y Mixxx

Comparación de funciones hecha a partir de lo que ofrecen estos programas en sus versiones de escritorio (de memoria del autor; conviene contrastarla con las versiones que uses). Estado en AlyssDJ:

- ✅ ya estaba
- 🆕 añadido en esta ronda
- ⏳ pendiente (viable)
- ❌ no previsto / no viable con la arquitectura actual

## Tabla

| Área | Función | Rekordbox | djay Pro | Mixxx | AlyssDJ |
|---|---|:-:|:-:|:-:|:-:|
| **Decks** | Número de decks | 2–4 | 2–4 | 2–4 | 2 ⏳ (3–4) |
| | Forma de onda 3 bandas + vista general | ✓ | ✓ | ✓ | ✅ |
| | Zoom de la onda | ✓ | ✓ | ✓ | 🆕 (Ctrl + rueda) |
| | Jog / scratch con el ratón | ✓ | ✓ | ✓ | ✅ (bend y búsqueda) |
| **Análisis** | BPM, beatgrid y tonalidad automáticos | ✓ | ✓ | ✓ | ✅ |
| | Editar la rejilla | ✓ | ✓ | ✓ | 🆕 (SET GRID) + ◀ ▶ + TAP |
| | Rejilla de tempo variable | ✓ | ✓ | ✓ | ⏳ (hoy tempo constante) |
| | Ganancia automática | ✓ | ✓ | ✓ (ReplayGain) | ✅ |
| **Cues y loops** | Hot cues | 8 | 8 | 36 | ✅ 4 ⏳ (8, colores y nombres) |
| | Memory cues / tipos de cue | ✓ | ✓ | ✓ | ⏳ |
| | Loops automáticos y manuales | ✓ | ✓ | ✓ | ✅ + 🆕 ÷2 / ×2 |
| | Loop roll (slip) | ✓ | ✓ | ✓ | 🆕 |
| | Beat jump | ✓ | ✓ | ✓ | 🆕 (±1, 4, 8, 16) |
| | Cuantizar | ✓ | ✓ | ✓ | ✅ |
| **Mezcla** | Sync de tempo y fase, keylock | ✓ | ✓ | ✓ | ✅ |
| | EQ 3 bandas con kill, filtro, trim | ✓ | ✓ | ✓ | ✅ |
| | Curva de crossfader (suave / corte) | ✓ | ✓ | ✓ | ✅ |
| | Efectos | 15+ | 15+ | 20+ | 🆕 4 (eco, reverb, flanger, gate) ⏳ más |
| | Sampler | ✓ | ✓ | 64 slots | 🆕 8 pads (sonidos de fábrica o tus archivos) ⏳ bancos, loop |
| | Cambio de tono sin cambiar tempo (key shift) | ✓ | ✓ | ✓ | ⏳ (Web Audio no lo trae) |
| | Stems / Neural Mix | ✓ | ✓ | ✓ (stems) | ❌ (requiere modelos de IA) |
| **Salida** | Auriculares: PFL y salida separada | ✓ | ✓ | ✓ | ✅ + 🆕 volumen de auriculares |
| | Mezcla master/cue en los auriculares | ✓ | ✓ | ✓ | ❌ (los decks de YouTube suenan en procesos distintos) |
| | Grabar la mezcla | ✓ | ✓ | ✓ | 🆕 (Linux: captura la salida con ffmpeg) |
| | Emitir en directo (streaming) | — | ✓ | ✓ | ❌ |
| | Micrófono con ducking | ✓ | ✓ | ✓ | ⏳ |
| **Librería** | Buscar y ordenar | ✓ | ✓ | ✓ | ✅ + 🆕 orden por columnas |
| | Carpetas locales con etiquetas y carátulas | ✓ | ✓ | ✓ | ✅ |
| | Playlists / cajas propias | ✓ | ✓ | ✓ | ✅ importar de YouTube 🆕 ⏳ crear las tuyas |
| | Listas inteligentes | ✓ | ✓ | ✓ | ❌ |
| | Historial | ✓ | ✓ | ✓ | 🆕 |
| | Pistas compatibles (clave y BPM) | ✓ (Related) | ✓ (Match) | — | 🆕 resaltado + filtro |
| | Valoración, color y etiquetas propias | ✓ | ✓ | ✓ | ⏳ |
| **Automático** | AutoDJ / Automix | ✓ | ✓ | ✓ | ✅ con radio de YouTube, tempo, fase y estilos; 🆕 puntos de mezcla por estructura, orden por BPM/clave/energía y vista editable |
| **Streaming** | Servicios integrados | Beatport, Tidal, SoundCloud… | Spotify, Tidal, SoundCloud, Beatport… | — | ✅ YouTube Music Premium |
| **Video** | Video de las pistas | plugin | ✓ | — | ✅ ventana en otra pantalla y vista de video en AutoMix |
| **Control** | Controladoras MIDI | ✓ (mapeos incluidos) | ✓ (mapeos incluidos) | ✓ (muchos mapeos) | ✅ MIDI learn ⏳ mapeos incluidos y LEDs |
| | Atajos de teclado | ✓ | ✓ | configurables | ✅ ⏳ configurables |
| | Vinilo/CDJ con timecode | ✓ | ✓ | ✓ | ❌ |
| **Otros** | Temas / skins | — | ✓ | ✓ | ⏳ |

## Qué se hizo en esta ronda

1. **Efectos por deck** (eco sincronizado al BPM, reverb, flanger, gate rítmico), con cantidad y división del eco.
2. **Beat jump, loop roll, loop ÷2 / ×2, fijar rejilla y zoom de onda**: lo básico de cualquier CDJ que faltaba.
3. **Sampler de 8 pads** con sonidos sintetizados de fábrica (no hay que descargar nada) o archivos tuyos.
4. **Grabación de la mezcla** y **volumen de auriculares**.
5. **Librería**: orden por columnas, filtro "solo compatibles" e historial.
6. **Ayuda de atajos** dentro de la app (`?`) y esta documentación con capturas.

## Lo que sigue (por impacto)

1. **Más hot cues (8) con color y nombre, y memory cues.** Es lo que más se nota al preparar sets.
2. **Cajas propias** (crear playlists, arrastrar pistas, orden manual) y valoración/etiquetas.
3. **3.er y 4.º deck** para cargar la siguiente sin perder el deck en juego.
4. **Más efectos** (barrido de filtro, bitcrusher, phaser) y dos unidades de FX con salida compartida.
5. **Mapeos MIDI incluidos** para controladoras comunes y salida de LEDs.
6. **Micrófono con ducking.**
7. **Rejilla de tempo variable** para pistas en vivo o sin metrónomo.
8. **Separación en stems** para archivos locales (solo offline y con un modelo aparte; no es viable en el streaming de YouTube).

## Límites que vienen de usar YouTube Music

- Los decks de streaming son vistas independientes de YouTube Music: su audio sale por su propio proceso. Por eso **no se puede mezclar en un único bus** la salida de los dos decks (ni hacer cue-mix master/phones en los auriculares) y la **grabación captura la salida del sistema** en lugar de sumar los decks.
- Sin el archivo de audio no hay análisis completo: el BPM y la tonalidad de una pista de YouTube se obtienen con **Analizar** (yt-dlp), que es opcional.
- Las pistas locales no tienen ninguna de estas limitaciones.
