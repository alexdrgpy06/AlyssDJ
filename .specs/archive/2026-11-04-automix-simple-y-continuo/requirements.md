---
change: 2026-11-04-automix-simple-y-continuo
type: fix
domains: [automix, fx]
paths: [renderer/automix*.js, renderer/mixplan.js, renderer/recipes.js, renderer/fxcues.js, renderer/app.js, renderer/index.html, renderer/styles.css, scripts/test-automix-continuo.js, docs/04-automix.md]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: d44ff710fd9b479dfcb1ed2e195a3450e90d3a3c5d85f51d446f6ede413e0e2d
approved_by: Alejandro Ramirez
approved_at: 2026-11-04
---
# Requirements · 2026-11-04-automix-simple-y-continuo

## Contexto

Lo que pasa hoy (capturas del usuario y del código):
1. **La mezcla siempre entra por el inicio de la pista**: `pickEntry` sin análisis devuelve «entra por el inicio» (0:00) y el plan se hace antes de que llegue el análisis; la entrada en 0:00 con la pista aún cargando suena a corte, no a mezcla continua.
2. **Repite pistas**: suena «Gangsta's Paradise (con L.V.)» de Coolio y la siguiente de la cola es «Gangsta's Paradise» de Coolio, L.V. `songKey` solo ignora los paréntesis con «official, video, lyrics…», no los de colaboración («con L.V.», «feat. X», «con Alicia Keys»), y la lista que se da al iniciar o lo que se agrega a mano no pasa por el filtro.
3. **Demasiadas opciones**: estilo, salir, perfil, duración, efectos, orden, popularidad, fuente y radio compiten en el mismo panel, y los efectos de transición y de reproducción no distinguen una pista local (analizada, con archivo) de un stream.

## Requisitos

### REQ-1: La entrada nunca es ciega
WHEN la pista que sigue no tiene análisis y se puede analizar (archivo local o copia guardada) THE SYSTEM SHALL esperar al análisis antes de fijar el plan, y WHEN se acerca la salida sin análisis THE SYSTEM SHALL entrar en un punto de seguridad (el 8 % de la duración, entre 10 y 40 s, no el inicio) con fundido y filtro en vez de en 0:00; el punto elegido y su motivo SHALL verse en la tarjeta «SIGUE».

### REQ-2: Transición continua
THE SYSTEM SHALL empezar una transición solo cuando la pista entrante está cargada, lista y colocada en su punto de entrada con el volumen en cero; IF no lo está a tiempo THEN THE SYSTEM SHALL seguir con la pista actual (sin silencio ni corte) y reintentar, y tras 20 s sin conseguirlo SHALL pasar a la siguiente de la cola.

### REQ-3: Efectos según la fuente
WHILE la pista que entra y la que sale son locales (archivo analizado) THE SYSTEM SHALL aplicar la receta completa en la transición (cuando el nivel de efectos no sea «Apagado») y, durante la reproducción, los efectos musicales en las subidas y roturas; WHEN alguna de las dos es streaming THE SYSTEM SHALL usar solo fundido de entrada y salida y filtro, sin ranuras de efecto ni stems.

### REQ-4: No repetir canciones
THE SYSTEM SHALL tratar como la misma canción la que comparte título (sin paréntesis ni sufijos de colaboración, versión o remasterización) y artista principal, y SHALL no añadir a la cola, sugerir ni iniciar una canción que ya suena, esté cargada, esté en la cola o haya sonado en la sesión, también cuando venga de una lista elegida por el usuario o de «Agregar»; IF el usuario la agrega expresamente THEN THE SYSTEM SHALL pedir confirmación en una línea.

### REQ-5: AutoMix simple
THE SYSTEM SHALL mostrar en el panel solo Perfil (Suave, Club, Radio), Duración y Efectos (Apagado, Sutil, Marcado), y dejar estilo, salida, orden, popularidad, fuente y radio continua en un bloque plegado «Avanzado», conservando lo que el usuario ya eligió.

## Fuera de alcance
Nuevas recetas de transición, cambios en el análisis de pistas y la vista inmersiva.
