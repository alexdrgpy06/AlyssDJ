# 7. Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| Arriba aparece "yt-dlp sin instalar" | La app lo descarga sola al abrirse (necesita internet). Si falla: **Ajustes → Instalar / actualizar herramientas** o `npm run setup` en una terminal |
| "falta ffmpeg" | Instálalo con tu gestor de paquetes (CachyOS/Arch: `sudo pacman -S ffmpeg`). Se necesita para analizar y leer archivos locales |
| **Analizar** falla | YouTube cambia a menudo y yt-dlp se rompe. Pulsa **Instalar / actualizar herramientas** (se actualiza si tiene más de 14 días). Si sigue, prueba otra fuente de cookies en Ajustes |
| Sale un anuncio en el deck | No hay sesión de Premium. **Iniciar sesión** (barra superior) |
| Google no deja iniciar sesión | A veces bloquea los navegadores embebidos. Reintenta o inicia sesión desde el botón **YTM** del deck |
| Un deck de YouTube se pausa al arrancar el otro | YouTube Music puede limitar dos reproducciones de la misma cuenta a la vez. Pasa uno a **LOCAL** (analiza la pista con *Conservar audio*) o usa pistas locales |
| El beatgrid no cae en los golpes | **GRID → SET GRID** sobre un bombo, o **◀ ▶** para afinar. En los streams puede haber un desfase fijo: se guarda por pista |
| SYNC / loops / beat jump dicen que falta BPM | Analiza la pista o usa **TAP** |
| Las playlists salen vacías | Hace falta la sesión iniciada. Después, **Importar mis playlists** |
| La ventana de video no se coloca en mi otra pantalla | En Wayland el sistema ignora la posición. Arrastra la ventana a esa pantalla y pulsa **Completa** |
| No suena por mis auriculares | **Ajustes → Salida de audio**: elige el dispositivo de auriculares y activa **CUE** en el canal. Revisa el knob **PHONES** |
| **REC** dice que no puede grabar | Solo Linux por ahora, y necesita `pactl` y `ffmpeg`. Elige la fuente en *Grabar desde* |
| La rueda del ratón no hace zoom | Es **Ctrl + rueda** sobre la onda. Sin Ctrl, y en pausa, la rueda busca fino |
| Quiero ver los errores | Arranca con `YTDJ_DEVTOOLS=1 npm start` |
