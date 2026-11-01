# AlyssDJ

*Un software de **AlystechPY**, por Alejandro Ramírez.*

> **Instalar en Windows, macOS y Linux:** [docs/00-instalacion.md](docs/00-instalacion.md) · **Guías con capturas:** [docs/](docs/README.md) · [Comparativa con Rekordbox, djay y Mixxx](docs/COMPARATIVA.md)

DJ de dos decks con **YouTube Music Premium** y **tu música local**, con análisis de BPM, tonalidad y beatgrid.

## Instalación

Sin Node ni Git: descarga el instalador de Windows (`.exe`) o macOS (`.dmg`) desde [Releases](https://github.com/alexdrgpy06/AlyssDJ/releases) (no están firmados: ver [la guía](docs/00-instalacion.md#instaladores-sin-node-ni-git)). Desde el código:

```bash
npm install     # instala Electron y, solo, lo que falte (yt-dlp y ffmpeg)
npm start
```

`scripts/setup.js` corre en `npm install` (postinstall), antes de cada `npm start` y la app lo repite al abrirse:

- **yt-dlp:** si no hay uno utilizable, descarga el binario oficial de GitHub a `bin/` (o a la carpeta de datos de la app). Si es el propio y tiene más de 14 días, se actualiza solo, porque YouTube lo rompe seguido.
- **ffmpeg:** usa el del sistema; si no existe, descarga un ffmpeg estático a `bin/` (Windows x64, macOS y Linux). Si tampoco puede, avisa cómo instalarlo (Windows: `winget install Gyan.FFmpeg`).
- Ajustes → **Instalar / actualizar herramientas** repite la comprobación a mano. `npm run setup` hace lo mismo desde la terminal.

## Fuentes de audio

| | YouTube Music (stream) | YouTube Music analizado | Música local |
|---|---|---|---|
| Origen | Cada deck es una vista oculta de music.youtube.com con tu sesión Premium; su `<video>` pasa por Web Audio | yt-dlp baja el audio y se analiza | Carpetas del disco o archivos arrastrados a un deck |
| Cuándo se descarga/analiza | Nunca | Solo al pulsar **Analizar** (o con la opción de analizar al cargar en cue) | Nada se descarga; se analiza solo al cargar (se puede desactivar) |
| Formatos | — | — | mp3, flac, wav, m4a, aac, ogg, opus, aiff, wma |

El análisis de una pista de YouTube se aplica también al stream: beatgrid, BPM, tonalidad y forma de onda completa, SYNC y loops por beats. Si la rejilla queda corrida respecto del stream, usa ◀ ▶ (pasos de 5 ms; se guarda por pista). Sin analizar, el deck dibuja la onda mientras suena y **TAP** fija un BPM aproximado.

## Video

El plato de cada deck muestra la portada (el video no corre ahí para no gastar rendimiento). Con **Video** (arriba) o el botón del plato se abre una **ventana de video** con el video de YouTube Music que puedes mover a otra pantalla o proyector:

- **Mostrar:** Auto (sigue al deck que está al aire), A, B o A | B.
- **Pantalla:** eliges en cuál abrirla; **Completa** la pone a pantalla completa.
- El video es el mismo reproductor que suena en el deck, así que va sincronizado; cerrar la ventana no corta el audio.
- **Preferir el video musical** (experimental) cambia YouTube Music a la versión en video, que puede durar distinto que el audio.

## AutoMix (estilo radio de YouTube)

Botón **AutoMix** (arriba) o **Radio** en cualquier pista de la librería. La cola sale de la radio de YouTube Music (pistas parecidas a la que suena) o de una lista (**AutoMix de esta lista**, **+** para encolar). La siguiente se precarga en el deck libre y se mezcla sola:

- **Estilos:** Fundido (solo crossfader), Bass swap (los graves de la entrante entran a mitad) y Filtro (la saliente se cierra y la entrante se abre). Duración de 4 a 48 s.
- **Tempo y fase:** si ambas pistas tienen BPM, la entrante se iguala (también a doble/mitad de tempo, hasta ±12 %), se alinea y se corrige durante la mezcla; después vuelve poco a poco a su tempo natural. Las pistas locales tienen BPM siempre; las de YouTube solo si se analizaron (opción **Analizar la siguiente con yt-dlp**), si no se hace fundido.
- Si te vas a mano (pausar el deck, cargar otra pista), AutoMix espera; **Siguiente** fuerza la mezcla ya.

## Playlists

Fuente **Playlists**: tus listas de YouTube Music (con la sesión iniciada). **Importar mis playlists** copia todas (y Me gusta) a este equipo; quedan en la pestaña **Importadas**, disponibles sin conexión y para AutoMix.

## Uso

1. **Iniciar sesión** con tu cuenta de YouTube Music Premium. Sin sesión hay anuncios.
2. Busca, o usa *Me gusta*, *Playlists* o **Local** (*Añadir carpeta…*). Carga con **A**/**B**, arrastrando a un deck (también archivos del explorador) o con doble clic.
3. En la librería, las pistas analizadas muestran su tonalidad con color Camelot y se resaltan las **compatibles** con el deck en juego (clave armónica y BPM dentro de ±6 %).
4. **Ajustes:** salida master y de auriculares (dos dispositivos, o uno de 4 canales), cookies para yt-dlp, rango de pitch, curva del crossfader y carpetas de música.

**Decks:** el plato muestra la portada (carátula del archivo, o una generada) y gira con la pista; si la pista de YouTube tiene video, se ve ahí (sin girar). Doble clic en el plato abre la ventana de video.

**Controles:** CUE estilo CDJ, 4 hot cues (Shift o clic derecho borra), loops de 1 a 16 beats e IN/OUT/EXIT, SYNC de tempo y fase, keylock, cuantizado, nudge, jog wheel, EQ de 3 bandas con kill, filtro bipolar, trim con auto-gain, PFL, crossfader y master.

**Teclado:** deck A → Z play, X cue, 1–4 hot cues, Q sync, A/S nudge · deck B → M play, N cue, 7–0 hot cues, P sync, K/L nudge · ←/→ crossfader.

**MIDI:** *MIDI learn*, clic en un control (el jog es el plato) y mueve el control físico. El mapeo se exporta e importa desde Ajustes.

## Pruebas

```bash
npm run analyze -- archivo.m4a                            # análisis sin abrir la app
YTDJ_SELFTEST=1 YTDJ_USERDATA=/tmp/alyss-test npm start   # autoprueba en silencio (canales en 0)
```

## Límites conocidos

- **Dos streams a la vez con la misma cuenta:** YouTube Music podría pausar uno. Sin probar con sesión iniciada; si pasa, pon un deck en LOCAL.
- **Inicio de sesión de Google:** Google bloquea el login dentro de Electron. Se usa **Iniciar sesión → Importar sesión**, que copia la sesión de tu navegador (solo cookies de youtube.com y google.com).
- **Segunda pantalla en Wayland:** el compositor puede ignorar la posición pedida a la ventana; funciona bien en X11/XWayland y la pantalla completa va en la pantalla donde esté la ventana.
- **Precisión:** los loops y cues del stream se aplican por software cada 5 ms, no con precisión de muestra. En archivos locales es igual de exacto.
- **Términos de servicio:** controlar la web de YouTube Music está en zona gris, y descargar con yt-dlp va contra ellos; por eso nunca ocurre sin que lo pidas.

## Licencia

MIT © 2026 **AlystechPY** — Alejandro Ramírez. Ver [LICENSE](LICENSE).
