# Inventario de controles

Lista de qué control vive dónde tras el reordenamiento (cambio `interfaz-ordenada`). La ayuda («?») y las capturas se alinean con esta tabla.

## Barra superior

| Zona | Control | Nombre | Notas |
|---|---|---|---|
| Vistas | Selector de vistas | Mezcla · Librería · Automix · Ondas | Alt+1…4; solo iconos por debajo de 1100 px |
| Vistas | Interruptor de ondas | Ondas arriba / en el deck | |
| Herramientas | `#btn-automix` | AutoMix | Indicador de estado: abre el panel, no inicia ni detiene |
| Herramientas | `#btn-sampler` | Sampler | |
| Herramientas | `#btn-rec` | REC | |
| Sistema | `#session` | Sesión de YouTube Music | Solo con texto cuando hay que actuar; si no, un punto |
| Sistema | `#tools-status` | Herramientas | Solo visible si falta algo |
| Sistema | `#local-badge` | Modo local | Solo visible con el modo local activo; se cambia en Ajustes → Sistema |
| Sistema | `#btn-midi-learn` | MIDI | |
| Sistema | `#btn-help` | Ayuda | `?` |
| Sistema | `#btn-settings` | Ajustes | |

## Deck (A y B)

| Zona | Control | Nombre | Siempre visible |
|---|---|---|---|
| Cabecera | Título, artista, BPM, tonalidad | — | Sí |
| Cabecera | Descargar pista (`deck-eject`, control `deckX.eject`, atajo y MIDI) | Descargar pista | Sí; atenuado sin pista; al aire pide una segunda pulsación en 3 s |
| Cabecera | Cargar pista (`deck-load`) y «o arrastra una pista de la librería» | Cargar pista | Solo con el deck vacío |
| Cabecera | Menú «⋯» (`deck-more`) | Más | Sí; sus entradas solo si aplican |
| Menú «⋯» | STREAM / ARCHIVO | Fuente | Solo si hay versión local y de stream |
| Menú «⋯» | Analizar | Analizar | Solo si no está analizada |
| Menú «⋯» | Puntos | Puntos de mezcla | Solo con análisis |
| Menú «⋯» | YTM | YouTube Music | Solo con pista de stream |
| Transporte | CUE · ▶ · SYNC | — | Sí (SYNC atenuado sin BPM) |
| Plato | Jog | — | Sí |
| Pitch | Fader, nudge ±, rango | — | Sí |
| Hot cues | 1–4 | — | Sí |
| Stems | Voz · Batería · Bajo · Resto · Completa | Stems | Sí |
| Bancos | LOOP · JUMP/ROLL · FX · GRID | — | Pestañas siempre; panel solo el último abierto (se recuerda por deck) |

## AutoMix

| Acción | Dónde vive | Retirado de |
|---|---|---|
| Iniciar / Detener | Barra de reproducción del panel (`amv-toggle`) y vista Automix (`imm-toggle`); sin pista cargada dice «Elegir radio…» y abre el menú Radio | botón de la barra |
| Mezclar ahora | Barra del panel (`amv-mix`), vista Automix (`imm-mix`), `Mayús + →` | — |
| Radio ▾ (empezar desde una pista) | Barra del panel (`amv-radio`) y vista Automix (`imm-radio`); «Radio» en cada resultado de búsqueda | — |
| Perfil (Suave, Club, Radio), Duración, Efectos | Panel, «Ajustes de AutoMix» (`amv-profile`, `amv-len`, `amv-fx`) | Botón «Personalizado»; vista Automix (`imm-style`, `imm-len`) |
| Motivo de un botón deshabilitado | Línea bajo la barra (`am-hint`) | — |
| Siguiente (quitar la que sigue) | Barra del panel (`amv-skip`) y vista Automix (`imm-skip`) | — |
| Ver cola | Panel | Vista Automix (`imm-queue`) → «Abrir panel» (`imm-open`) |
| Visual | Vista Automix (`imm-viz-toggle`) | — |
| Estilo, Igualar tempo, Salir, Orden, Popularidad, Fuente, Radio continua | Panel, plegable «Avanzado» (`am-adv`) | — |

## Nombres unificados

- «Mezclar ahora» (no «Mezclar ya»).
- «Siguiente» para quitar la pista que sigue (antes «Saltar siguiente» y «Saltar»).
- «Analizar», «Puntos de mezcla», «Ondas».

## Buscador y filtros (cambio `modo-local-y-buscador`)

| Control | Nombre | Notas |
|---|---|---|
| `#search-scope` | Ámbito | Todo · Mi equipo · YouTube Music; se recuerda |
| `#lib-filters` | Filtros | BPM mínimo y máximo, tonalidad, compatibles con la pista cargada y «Limpiar»; la insignia «Modo local» está en la barra superior |

## Playlists locales (cambio `playlists-locales`)

| Control | Nombre | Notas |
|---|---|---|
| `#pl-new` · `#pl-new-smart` | Nueva playlist · Nueva lista inteligente | Cabecera de «Mis listas» |
| `#pl-sources` | Mis listas | Una fila por lista; acepta pistas soltadas |
| `#pl-bar` | Barra de la lista | `#pl-rename`, `#pl-dup`, `#pl-del`, `#pl-order`, `#pl-dir`, `#pl-filters`, `#pl-undo` |
| `#sel-bar` | Barra de selección | `#sel-add`, `#sel-remove`, `#sel-queue`, `#sel-analyze`, `#sel-clear`; visible con 2 o más pistas |
| `#pl-menu` | Añadir a playlist | Menú de la fila y de la barra de selección |
| `#btn-crate-pl` | Guardar como lista local | Solo dentro de una playlist importada |

## Entrada inteligente de AutoMix (cambio `automix-entrada-inteligente`)

| Control | Nombre | Notas |
|---|---|---|
| `#amv-entry` | Entrada | Tarjeta «SIGUE»: `#amv-entry-time` (tiempo y compás), `#amv-entry-why` (motivo) |
| `#amv-entry-strip` | Tira de energía | Línea arrastrable; ← → mueven un compás; guarda el punto de entrada editado |
| `#amv-entry-auto` | Auto | Solo con entrada editada; quita solo la entrada |
| `#amtl` | Línea de tiempo | Próxima mezcla: `#amtl-cv` (arrastrar salida, entrada y duración; ← → y Mayús + ← →), `#amtl-info` (texto), `#amtl-preview` (Escuchar por auriculares) |
| `#amv-profile` | Perfil | Suave, Club, Radio, Personalizado; se recuerda en `automix-profile` |
| `#amv-status` | Estado | Fase (`data-phase`), cuenta atrás y motivo; el botón `#btn-automix` lleva la misma fase y `#btn-automix-count` |

## Efectos ampliados (⋯, Instant FX)

| Selector | Control | Qué hace |
|---|---|---|
| `.fx-more` | ⋯ | Abre las opciones de la ranura elegida (`.fx-pop`) |
| `.fx-div` | División | Auto, 1, ½, ¼, ⅛, tresillo (solo Eco, Cinta, Gate, Stutter y Transformer) |
| `.fx-route` | Ruta | Este deck / Ambos decks (copia la ranura al otro deck) |
| `.fx-mv` | Orden | ◀ Antes / Después ▶ dentro de la cadena |
| `.fx-preset` | Preset | De fábrica y propios; aplicar no enciende la ranura |
| `.fx-pname` | Nombre | Con `.fx-psave` guarda un preset propio; `.fx-pdel` borra uno propio |
| teclas E R T · U I O | Instant FX | Mantener = aplicar con rampa; soltar = quitar (deck A · deck B, ranuras 1–3) |
