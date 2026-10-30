# 1. Primeros pasos

## Instalar y abrir

```bash
npm install
npm start
```

`npm install` y cada `npm start` comprueban solos lo que falta y lo descargan: **yt-dlp** (binario oficial, a `bin/`) y, si no hay, **ffmpeg**. La app lo repite al abrirse. Si algo no se pudo instalar, arriba a la derecha aparece en amarillo, y **Ajustes → Instalar / actualizar herramientas** lo reintenta.

![Barra superior](img/11-barra-superior.png)

De izquierda a derecha: estado de la sesión de YouTube Music, herramientas, **REC**, **Sampler**, **AutoMix**, **Video**, **MIDI learn**, **ayuda (?)** y **Ajustes**.

## Iniciar sesión (YouTube Music Premium)

1. Pulsa **Iniciar sesión** y entra con tu cuenta en la ventana que se abre.
2. El punto verde indica sesión iniciada. Sin sesión todo funciona, pero YouTube mete anuncios y tus playlists no aparecen.

## Cargar música

Hay tres formas de tener pistas en un deck:

- **Buscar en YouTube Music** (pestaña *Buscar*), o tus *Me gusta* y *Playlists*.
- **Música local**: pestaña *Local* → **Añadir carpeta…**, o arrastra archivos de audio a un deck.
- **Importadas**: tus playlists copiadas al equipo.

En cada fila de la librería: **A** y **B** cargan en ese deck, **Radio** arranca [AutoMix](04-automix.md) desde esa pista, **+** la añade a la cola y el último botón la analiza.

![Librería](img/12-libreria-local.png)

También puedes **arrastrar una fila a un deck** o hacer **doble clic** (va al deck que no está sonando).

## Tu primera mezcla

1. Carga una pista en **A** y dale **play** (▶ verde).
2. Carga otra en **B**. Si ambas tienen BPM (las locales siempre; las de YouTube tras *Analizar*), pulsa **SYNC** en B: iguala el tempo y la fase.
3. Con **CUE** o un **hot cue** deja B lista, dale play y mueve el **crossfader** de A a B.
4. Baja los graves (**LOW**) de la pista que sale mientras entras con los de la nueva: es el "bass swap".

![Deck](img/02-deck.png)

Siguiente: [Decks y mezclador](02-decks-y-mezclador.md).
