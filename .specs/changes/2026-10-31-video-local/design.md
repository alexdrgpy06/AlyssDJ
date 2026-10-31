---
change: 2026-10-31-video-local
status: approved
rev: 1
approved_rev: 1
approved_hash: bbc37fec3f73d5596939929f95c1f36ebe3c0ecfea523e1ad06656fafb36e61b
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-video-local

## Enfoque
- `ytm-library.videoType(videoId)`: llamada `next` en la página de YouTube Music; lee `musicVideoType`. `isRealVideo = OMV | UGC | OFFICIAL_SOURCE_MUSIC`; ATV → portada.
- `library-save`: tras guardar el audio, si `isRealVideo` y el ajuste está activo, yt-dlp `-f "bv*[height<=H][ext=mp4]/bv*[height<=H]"` a `<base>.video.mp4`, sin cookies (igual que el audio). El análisis guarda `saved.video` con la ruta.
- Protocolo `app://ui/localvideo/<id>` con soporte de rangos (como `/localfile/`).
- Ventana de video: pasa a cargar `renderer/video.html` (un `<video muted>` por deck). Los decks locales envían por IPC `deck:video-sync {id, src, t, playing, rate}` cada 250 ms; el `<video>` corrige `currentTime` si la deriva > 80 ms y ajusta `playbackRate`. Los decks de stream siguen moviendo su vista como hoy.
- Miniatura del deck: usa el `<video>` local (canvas a 224×126) cuando existe.

## Contratos
`analysis.saved = { path, localId, video?: path }`; ajuste `saveVideo: true`, `videoMaxHeight: 1080`.

## Visual Spec
Sin controles nuevos salvo el ajuste en Ajustes; la ventana de video y la miniatura cambian de contenido.

## Amendments
