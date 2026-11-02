---
change: 2026-11-02-preescucha-libreria
type: feature
domains: [library, audio, ui]
paths: [renderer/library.js, renderer/preview.js, renderer/styles.css, renderer/app.js, scripts/test-preescucha*.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: e1bcb3573a4c912de284edf18a5f37d6d1134a0bdc6136e9ac91bc6d144e6dab
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-preescucha-libreria

## Contexto

Hoy, para saber cómo suena una pista de la Librería hay que cargarla en un deck, con el riesgo de pisar lo que suena. La preescucha deja oírla desde la propia lista, por los auriculares, sin tocar los decks ni el master. Reutiliza la salida de auriculares de Ajustes (`cueLabel`) y la lectura de archivos locales que ya usa la preescucha de transiciones (`mixpreview.js`).

## Requisitos

### REQ-1: Escuchar desde la fila
WHEN el usuario pulsa ▶ en una fila de la Librería con la pista disponible como archivo local THE SYSTEM SHALL reproducirla por la salida de auriculares (o la salida por defecto si no hay auriculares configurados) sin cargarla en ningún deck ni alterar lo que suena en el master.

### REQ-2: Empezar donde importa
WHEN la pista tiene análisis THE SYSTEM SHALL empezar la preescucha en su punto de entrada de mezcla (o en el primer 25 % de la pista si no tiene), y si no tiene análisis SHALL empezar al 25 % de la duración.

### REQ-3: Una sola a la vez
WHEN el usuario inicia la preescucha de otra pista, pulsa ▶ de nuevo en la misma, o la pista llega a su final THE SYSTEM SHALL parar la anterior, de modo que como mucho una preescucha suene a la vez.

### REQ-4: Moverse por la pista
WHILE una preescucha está sonando THE SYSTEM SHALL mostrar su progreso en la fila y permitir saltar a otro punto pulsando sobre esa barra.

### REQ-5: Pistas no disponibles
IF la pista solo existe por streaming (sin archivo local) THEN THE SYSTEM SHALL deshabilitar ▶ con una ayuda que lo explique y no descargar nada por su cuenta.

### REQ-6: Sin interferir con la mezcla
WHEN un deck empieza a sonar por la acción del usuario o de AutoMix, o la ventana se cierra, THE SYSTEM SHALL mantener la preescucha en marcha solo si sigue por auriculares; IF no hay salida de auriculares THEN THE SYSTEM SHALL pararla, para que nunca suene por el master a la vez que una mezcla.

## Fuera de alcance

- Descargar o analizar pistas solo para preescucharlas.
- Preescucha de listas completas o encadenada (pista tras pista).
- Ajustar volumen o EQ de la preescucha (usa un volumen fijo, como la preescucha de transiciones).
