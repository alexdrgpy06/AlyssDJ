---
change: 2026-11-02-automix-transicion-suave
type: fix
domains: [automix]
paths: [renderer/recipes.js, renderer/automix.js, renderer/index.html, scripts/test-recipes.js, docs/04-automix.md, README.md]
commits: []
status: approved
rev: 2
approved_rev: 2
approved_hash: 5771ebfbe91d7d6aded35b5a6437ac75a60d0dc4adaa9d4b5788f9d7153bf5f0
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-automix-transicion-suave

## Contexto

Con v0.12.0 el estilo Auto sonaba brusco: elegía casi siempre «eco y corte» (cortes secos y sin bass swap), los gestos se aplicaban 4 veces por segundo (el crossfader y los EQ daban saltos) y la duración no la decidía el análisis. Esta corrección hace que toda mezcla (salvo el fundido simple) lleve un bass swap gradual como base, que los gestos se apliquen con suavidad y que Auto decida también la duración.

## Requisitos

### REQ-1: Bass swap en toda receta
WHEN AutoMix mezcla con cualquier receta distinta del fundido THE SYSTEM SHALL cortar el grave de la entrante al empezar y hacer el intercambio de graves con una rampa de un compás (o de lo que quede de mezcla si es menos), sin saltos.

### REQ-2: Sin cortes secos
THE SYSTEM SHALL aplicar el crossfader, el EQ y el filtro de las recetas con una rampa (nunca un cambio instantáneo salvo el corte inicial del grave de la entrante), y SHALL actualizarlos cada 40 ms como máximo mientras dura la transición.

### REQ-3: Auto decide receta, duración y efectos
WHILE el estilo es Auto THE SYSTEM SHALL elegir con el análisis la receta y su duración (de 8 a 32 pulsos: larga con BPM y tonalidad compatibles y outro/intro largos, corta con saltos de BPM) y los efectos de salida según el nivel de efectos.

### REQ-4: Tonalidad en conflicto no corta
IF las tonalidades están en conflicto y el tempo es parecido (≤ 3 %) THEN THE SYSTEM SHALL usar bass swap con filtro y no un corte; el eco corto se reserva a saltos de BPM grandes o tempos distintos.

### REQ-5: «Siguiente» entra por el mejor punto
WHEN el usuario pulsa «Siguiente» / «Mezclar ahora» y el análisis de la entrante aún no ha llegado THE SYSTEM SHALL esperarlo hasta 8 s antes de empezar, y THE SYSTEM SHALL entrar siempre por su punto de entrada (editado, de mezcla o inicio de la rejilla), también en la mezcla de emergencia de los últimos segundos, en lugar de por el principio de la pista.

## Fuera de alcance

- Cambiar los estilos fijos que el usuario elige a mano más allá de añadirles el bass swap y las rampas.
- Nuevos efectos.
