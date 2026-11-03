# 5. Stems manuales

Separa una pista local en **voz, batería, bajo y resto** y silencia o aísla cada parte en el deck, en directo.

## Cómo se usa

1. **Separar.** En el deck, la tira **STEMS** tiene el botón **Separar**; en la Librería, cada fila tiene **Stems**. Funciona con pistas que existen como archivo en tu equipo (las de streaming solo cuando ya las guardaste). La separación va en segundo plano, de una pista en cada vez, con prioridad baja para no cortar lo que suena.
2. **Esperar.** La fila y el deck muestran el avance y el tiempo restante («Separando… 37 %, ≈ 1:20»). **✕** cancela y borra lo parcial.
3. **Activar.** Cuando termina, el botón del deck pasa a **Activar stems** y la fila lleva un chip **STEMS** (con su tamaño al pasar el ratón).
4. **Tocar.** Con los stems activos aparecen cuatro botones: clic **silencia** (se tacha), **Mayús o Ctrl + clic** **aísla** (solo; varios solos se suman). Los cambios son graduales (≈ 15 ms), sin chasquidos. **Completa** vuelve a la pista entera.

Mientras los stems suenan, el deck conserva el mismo tempo, posición, loops, cues, EQ, filtro y efectos; el keylock se comporta igual. El plato usa el freno y arranque suaves (el scratch con buffer necesita la pista completa).

## El modelo (se descarga una vez, con tu permiso)

Los stems usan **HTDemucs** en formato ONNX (`gridshiftstudio/htdemucs-ort` en Hugging Face, licencia Apache-2.0, unos 210 MB). **El instalador no lo incluye**: la primera vez que separas una pista, la app te pregunta con el nombre, el origen y el tamaño, y solo descarga si aceptas. Se comprueba su SHA-256 y se guarda en la carpeta de datos (`models/`). Si no coincide, se descarta.

## Cuánto ocupa y cuánto tarda

- **Tiempo:** unas 1,7 veces el tiempo real en una CPU actual de escritorio (una pista de 4 minutos tarda cerca de 2 min y 20 s). En equipos más modestos tardará más.
- **Memoria:** unos 1,5 GB durante la separación, que se libera al terminar; si pasa de 2 GB se detiene con un aviso.
- **Disco:** cada pista separada guarda un FLAC de 8 canales de 16 bits (unos 12 MB por minuto: una pista de 4 minutos ocupa cerca de 50 MB). Junto a la barra de la Librería aparece «Stems: N pistas, X MB» con **Borrar stems**; el botón de la fila borra solo esa pista.
- **Límite:** las pistas de más de 15 minutos no se separan.

## Si algo falla

La app lo dice en una frase con la causa (archivo ilegible, falta de memoria, modelo dañado, sin espacio) y la pista completa sigue funcionando como antes. En **macOS con Intel** el motor de separación no tiene binario, así que el botón queda deshabilitado con el aviso «Stems no está disponible en este equipo».
