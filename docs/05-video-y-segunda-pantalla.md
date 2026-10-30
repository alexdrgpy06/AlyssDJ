# 5. Video y segunda pantalla

## Miniatura en el deck

Si la pista de YouTube Music tiene video, el **centro del plato** lo muestra en vivo (sin girar). Si no, es la portada, y gira con la pista.

![Plato con portada](img/02-deck.png)

Se puede quitar en **Ajustes → Decks → Mostrar miniatura de video**.

## Ventana de video

Abre una ventana aparte con el video a pantalla completa, para otra pantalla o un proyector. Se abre con el botón **Video** (barra superior) o con el botón del plato (esquina inferior derecha, aparece al pasar el ratón) o **doble clic en el plato**.

![Panel de video](img/16-video-panel.png)

| Control | Qué hace |
|---|---|
| **Abrir / cerrar ventana de video** | Muestra u oculta la ventana |
| **Completa** | Pantalla completa en la pantalla donde esté la ventana |
| **Mostrar: Auto** | Sigue al deck que está al aire (con un respiro de 0,6 s para no parpadear al cruzar) |
| **Mostrar: A · B · A \| B** | Fija un deck, o los dos lado a lado |
| **Pantalla** | Elige en qué monitor abrirla |
| **Preferir el video musical** | *Experimental*: pide a YouTube Music la versión en video de la pista. Puede durar distinto que el audio, y la rejilla del análisis podría no coincidir |

## Cómo funciona (y por qué va sincronizado)

El video es **el mismo reproductor** que suena en el deck: la ventana solo lo muestra aislado de la interfaz de YouTube Music. Por eso cerrar la ventana no corta el audio y nunca se desfasa.

## Límites

- Sin Premium, YouTube Music intercala anuncios y el deck lo indica ("anuncio").
- En **Wayland** el sistema puede ignorar la posición que pedimos a la ventana; con X11/XWayland funciona. La pantalla completa siempre va en la pantalla donde esté la ventana: arrástrala allí y pulsa **Completa**.
- Las pistas locales no tienen video (solo portada).
