---
change: 2026-11-04-automix-simple-y-continuo
status: approved
rev: 1
approved_rev: 1
approved_hash: 40f77e3a6850da1a2c017a05f0d4bbb00982e4316ba27e7f88ac9a22d8161853
approved_by: Alejandro Ramirez
approved_at: 2026-11-04
---
# Design · 2026-11-04-automix-simple-y-continuo

## Enfoque

- **songKey** (`mixplan.js`): quita todo paréntesis o corchete que contenga `feat|ft|featuring|con|with|prod|version|remaster|official|video|audio|lyrics|visualizer|hd|hq|clean|explicit|mv` y el sufijo « - feat… / - remaster… / - radio edit»; el artista principal es el primero antes de `, & x feat ft with con and y`. `AutoMix.isSameSong(a, b)` lo usa; `start({ tracks })`, `addSmart`, `radioCandidates`, `suggestions` y el relleno de lista filtran con `knownSongs()` (cola, deck A, B, historial). `addSmart(track, { confirmDup })` devuelve `{ ok: false, dup: true }` y la interfaz pregunta en una línea.
- **Entrada** (`mixplan.pickEntry`): sin análisis y sin edición devuelve `kind: 'safe'` en `clamp(0.08 · duration, 10, 40)` con motivo «sin análisis: entra en un punto seguro»; el plan no se fija mientras `prep.state ∈ {download, analyze}` y la pista sea analizable; al llegar el análisis `makeNearestPlan` se rehace (hoy solo si `enterAt === 0`).
- **Continuidad**: `startTransition` exige `ready(next)` y `next.st.ready`; `AutoMix.prepareEntry(next, at)` hace `seek` al punto con el canal de entrada en cero antes de empezar; si en `rem ≤ 1,2 s` no está lista se deja sonar la actual y `waitSince` cuenta; a los 20 s se llama a `skipNext()`.
- **Efectos por fuente**: `recipeFor(curAna, nextAna, { local })` (`recipes.js`): si `!local`, receta `fade-filter` (fundido + filtro de paso alto/bajo, sin gestos de FX de ranura) y `fxCues`/`FxMoves` se desactivan durante la reproducción; si local, comportamiento actual según `cfg.fxLevel`. `local` = ambas pistas con archivo y análisis.
- **Panel**: `#amv-profile`, `#amv-len` y `#amv-fx` quedan visibles en el grupo «Transición»; `#amv-style`, `#amv-exit`, orden, popularidad, fuente y `#amv-endless` pasan a `<details id="am-adv">` «Avanzado»; el perfil «Personalizado» desaparece como botón (se deduce al tocar Avanzado).

## Contratos

```js
songKey(track): string
AutoMix.isSameSong(a, b): boolean
AutoMix.addSmart(track, { next, confirmDup }): { ok, dup?, index? }
pickEntry(cur, next, { exitAt, seconds }): { t, kind: 'edit'|'phrase'|'safe'|…, why }
recipeFor(curAna, nextAna, { local, level }): Recipe
```

## Visual Spec

Mismos tokens. «Avanzado» como `<details>` con el estilo de «Ajustes de AutoMix». La tarjeta «SIGUE» muestra el punto de entrada con su motivo y, si es seguro, una insignia «punto seguro». El aviso de duplicado es una línea de texto bajo el buscador con «Agregar igualmente».

## Amendments

## Domain deltas
### automix
#### ADDED spec: Entrada segura
WHEN la pista que sigue no tiene análisis THE SYSTEM SHALL esperar a que llegue y, si no llega, entrar en un punto seguro (el 8 % de su duración, entre 10 y 40 s) con fundido y filtro, nunca por el 0:00, y recalcular el plan cuando el análisis llegue.
#### ADDED spec: Transición continua
WHEN falta poco para la salida THE SYSTEM SHALL colocar la entrante en su punto de entrada, en pausa y sin sonido, y mezclar solo cuando esté lista; IF no lo está THEN sigue sonando la actual y, pasados 20 s, se pasa a la siguiente lista.
#### ADDED spec: Efectos según el origen
WHEN las dos pistas son archivos locales analizados THE SYSTEM SHALL usar la receta completa y los efectos de reproducción del nivel elegido; IF alguna es streaming o no tiene análisis THEN solo fundido y filtro, sin igualar tempo ni efectos.
#### ADDED spec: Misma canción con otro título cuenta como repetida
THE SYSTEM SHALL tratar como la misma canción la que difiere solo en créditos, «Remastered», «Official Video» u otros sufijos, no repetirla en la cola, la lista inicial, la radio ni las sugeridas, y pedir confirmación si el usuario la agrega.
#### ADDED design: Entrada, receta y claves
`pickEntry` devuelve `kind: 'safe'`; `AutoMix.prepareEntry/entryReady` colocan la entrante; `recipeFor` y el estilo `fade-filter` (recipes.js) y `AutoMix.fullRecipe` deciden por origen; `songKey` e `isSameSong` detectan repetidas.
### ui
#### ADDED spec: Panel de AutoMix simple
WHILE se ven los ajustes de AutoMix THE SYSTEM SHALL mostrar solo perfil (Suave, Club, Radio), duración y efectos, y dejar estilo, tempo, salida, cola, fuente y radio continua en un bloque plegado «Avanzado».
#### ADDED design: Panel simple
`#am-more` contiene `.am-simple` (`#amv-profile`, `#amv-len`, `#amv-fx`) y `#am-adv` con el resto; la tarjeta SIGUE muestra `#amv-entry-safe`.
