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
| Iniciar / Detener | Panel de la fuente AutoMix (`amv-toggle`) | Vista Automix (`imm-toggle`), botón de la barra |
| Mezclar ahora | Panel (`amv-mix`), `Mayús + →` | Vista Automix (`imm-mix`) |
| Estilo, Duración | Panel (`amv-style`, `amv-len`) | Vista Automix (`imm-style`, `imm-len`) |
| Siguiente (quitar la que sigue) | Panel (`amv-skip`) | Vista Automix (`imm-skip`) |
| Ver cola | Panel | Vista Automix (`imm-queue`) → «Abrir panel de AutoMix» (`imm-open`) |
| Visual | Vista Automix (`imm-viz-toggle`) | — |
| Salir, Efectos, Orden, Popularidad, Fuente | Panel | — |

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
