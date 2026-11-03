# 5. Stems manuales

Separa una pista local en **voz, batería, bajo y resto** y silencia o aísla cada parte en el deck, en directo. Con una GPU compatible la separación es muy rápida y se prepara sola.

## Cómo se usa

1. **Un clic.** En el deck, la tira **STEMS** muestra siempre los cuatro botones: **Voz, Batería, Bajo, Resto**. Pulsa uno: si la pista aún no está separada, se prepara en segundo plano y el clic queda pendiente (el botón se ve pulsado); en cuanto termina, se aplica solo. No hay botones «Separar» ni «Activar». Funciona con pistas que existen como archivo en tu equipo (las de streaming solo cuando ya las guardaste; si la pista tiene versión en stream y archivo, el deck cambia solo a ARCHIVO).
2. **Esperar.** La fila de la Librería y el deck muestran el avance y el tiempo restante («Preparando · 37 % · 1:20»). **✕** cancela, descarta el clic pendiente y borra lo parcial.
3. **Tocar.** Clic **silencia** (se tacha); **Mayús o Ctrl + clic** **aísla** (solo; varios solos se suman). El cambio de la pista completa a los stems es un fundido de 40 ms, sin salto ni corte, y los cambios de mute son graduales (≈ 15 ms), sin chasquidos.
4. **Volver.** **Completa** aparece cuando hay algún stem silenciado o aislado y devuelve la pista entera; si quitas el último mute o solo, vuelve sola.

Mientras los stems suenan, el deck conserva el mismo tempo, posición, loops, cues, EQ, filtro y efectos; el keylock se comporta igual. El plato usa el freno y arranque suaves (el scratch con buffer necesita la pista completa).

## Preparación automática

En **Ajustes → Sistema → Stems**, «Preparar stems solos» elige cuándo se separan sin que lo pidas: la pista que cargas en un deck (prioridad máxima) y la **siguiente de AutoMix** (justo detrás), de modo que ya estén listos cuando llegue la mezcla.

- **Automático** (por defecto): solo si la GPU ya está comprobada (ver más abajo). En CPU no se ocupa el equipo sin que lo pidas.
- **Siempre / Nunca**: a tu elección.

La cola atiende primero lo que está en un deck, luego la siguiente de AutoMix y después las peticiones manuales de la Librería.

## GPU

La primera vez que separas una pista en un equipo con una GPU compatible, la app te pregunta si descarga el modelo de GPU (ver más abajo), lo **sondea** (una ventana de audio sintética en la GPU y en la CPU) y solo usa la GPU si su salida coincide con la de CPU (SNR de al menos 40 dB) y es más rápida. El resultado queda en la carpeta de datos (`stems/device.json`) y se repite solo si cambia la versión de la app o del modelo.

| Sistema | Proveedor |
|---|---|
| Windows | DirectML |
| macOS con Apple Silicon | CoreML |
| Linux | CUDA (si están sus bibliotecas) o WebGPU (Vulkan) |

Si la GPU falla o el controlador mata el proceso en una pista real, esa pista se repite en CPU, la GPU se marca como mala hasta la siguiente versión y Ajustes lo dice («Se usó la CPU: …»). **Ajustes → Sistema → Stems** muestra el dispositivo y su velocidad medida («Dispositivo: WebGPU · 14× tiempo real»). La separación corre en un proceso aparte, así que un fallo del controlador nunca cierra la app.

## Los modelos (se descargan una vez, con tu permiso)

Los stems usan **HTDemucs** en formato ONNX. **El instalador no los incluye**: la primera vez que hace falta uno, la app te pregunta con el nombre, el origen y el tamaño, y solo descarga si aceptas. Se comprueba su SHA-256 y se guardan en la carpeta de datos (`models/`). Si no coincide, se descartan.

| Variante | Se usa en | Origen | Licencia | Tamaño |
|---|---|---|---|---|
| CPU | procesador | `gridshiftstudio/htdemucs-ort` en Hugging Face | Apache-2.0 | unos 210 MB |
| GPU | tarjeta gráfica | `StemSplitio/htdemucs-onnx` en Hugging Face | MIT | unos 316 MB |

La de GPU solo se pide si tu equipo tiene un proveedor candidato; si no la autorizas, sigues en CPU sin que te vuelva a preguntar en esa sesión.

## Cuánto ocupa y cuánto tarda

- **Tiempo en CPU:** unas 1,7 veces el tiempo real en una CPU actual de escritorio (una pista de 4 minutos tarda cerca de 2 min y 20 s). En equipos más modestos tardará más.
- **Tiempo en GPU:** en una RTX 3090 con WebGPU, unas 15 veces el tiempo real por ventana (una pista de 4 minutos, en pocos segundos); la medida real aparece en Ajustes.
- **Memoria:** unos 1,5 GB durante la separación, que se libera al terminar; si pasa de 2 GB se detiene con un aviso.
- **Disco:** cada pista separada guarda un FLAC de 8 canales de 16 bits (unos 12 MB por minuto: una pista de 4 minutos ocupa cerca de 50 MB). Ajustes → Stems muestra «Espacio: X GB de 5 GB» y **Espacio máximo (GB)** (5 por defecto): al pasarte se borran primero los stems que hace más que no usas, nunca los cargados en un deck. **Borrar todos los stems** libera todo; junto a la barra de la Librería aparece «Stems: N pistas, X MB» con **Borrar stems**, y el botón de la fila borra solo esa pista.
- **Límite:** las pistas de más de 15 minutos no se separan.

## Si algo falla

La app lo dice en una frase con la causa (archivo ilegible, falta de memoria, modelo dañado, sin espacio) y la pista completa sigue funcionando como antes. En **macOS con Intel** el motor de separación no tiene binario, así que los botones quedan deshabilitados con el aviso «Stems no está disponible en este equipo».
