# 05 · IPC, rutas y persistencia

<!-- Generado por scripts/arquitectura-gen.js desde docs/arquitectura/modulos.json: no editar a mano (edita el registro y regenera). -->

## Canales IPC

92 canales registrados en [main/main.js](../../main/main.js). Llamador = grupo y función de `window.api` en [preload/app.js](../../preload/app.js).

| Canal | Tipo | Manejador | Llamadores |
|---|---|---|---|
| `deck:ready` | send | `main/main.js:162` | `deck.onReady`, `preload/deck.js` |
| `deck:state` | send | `main/main.js:174` | `deck.onState`, `preload/deck.js` |
| `deck:reload-at` | send | `main/main.js:179` | `preload/deck.js` |
| `deck:cmd` | send | `main/main.js:183` | `deck.cmd`, `preload/deck.js` |
| `deck:show` | send | `main/main.js:184` | `deck.show` |
| `app:info` | invoke | `main/main.js:202` | `app.info` |
| `app:open-repo` | invoke | `main/main.js:203` | `app.openRepo` |
| `app:playing` | send | `main/main.js:208` | `update.setPlaying` |
| `update:state` | invoke | `main/main.js:209` | `update.state`, `update.onState` |
| `update:check` | invoke | `main/main.js:210` | `update.check` |
| `update:download` | invoke | `main/main.js:211` | `update.download` |
| `update:install` | invoke | `main/main.js:212` | `update.install` |
| `update:skip` | invoke | `main/main.js:213` | `update.skip` |
| `update:later` | invoke | `main/main.js:214` | `update.later` |
| `update:open-release` | invoke | `main/main.js:215` | `update.openRelease` |
| `auth:status` | invoke | `main/main.js:248` | `auth.status` |
| `auth:login` | invoke | `main/main.js:249` | `auth.login` |
| `auth:logout` | invoke | `main/main.js:250` | `auth.logout` |
| `auth:browsers` | invoke | `main/main.js:259` | `auth.browsers` |
| `auth:import-browser` | invoke | `main/main.js:260` | `auth.importBrowser` |
| `auth:verify` | invoke | `main/main.js:274` | `auth.verify` |
| `lib:search` | invoke | `main/main.js:295` | `lib.search` |
| `lib:liked` | invoke | `main/main.js:296` | `lib.liked` |
| `lib:playlists` | invoke | `main/main.js:297` | `lib.playlists` |
| `lib:playlist` | invoke | `main/main.js:298` | `lib.playlist` |
| `lib:radio` | invoke | `main/main.js:299` | `lib.radio` |
| `lib:popularity` | invoke | `main/main.js:300` | `lib.popularity` |
| `lib:import-playlists` | invoke | `main/main.js:307` | `lib.importPlaylists` |
| `crates:list` | invoke | `main/main.js:326` | `lib.crates` |
| `crates:get` | invoke | `main/main.js:327` | `lib.crate` |
| `lib:search-local` | invoke | `main/main.js:340` | `lib.searchLocal` |
| `local:similar` | invoke | `main/main.js:345` | `local.similar` |
| `pl:list` | invoke | `main/main.js:356` | `pl.list` |
| `pl:get` | invoke | `main/main.js:357` | `pl.get` |
| `pl:create` | invoke | `main/main.js:358` | `pl.create` |
| `pl:rename` | invoke | `main/main.js:359` | `pl.rename` |
| `pl:duplicate` | invoke | `main/main.js:360` | `pl.duplicate` |
| `pl:delete` | invoke | `main/main.js:361` | `pl.delete` |
| `pl:add` | invoke | `main/main.js:362` | `pl.add` |
| `pl:remove` | invoke | `main/main.js:363` | `pl.remove` |
| `pl:restore` | invoke | `main/main.js:364` | `pl.restore` |
| `pl:reorder` | invoke | `main/main.js:365` | `pl.reorder` |
| `pl:sort` | invoke | `main/main.js:366` | `pl.sort` |
| `pl:set-filter` | invoke | `main/main.js:367` | `pl.setFilter` |
| `pl:from-crate` | invoke | `main/main.js:368` | `pl.fromCrate` |
| `genres:all` | invoke | `main/main.js:371` | — |
| `genres:set` | invoke | `main/main.js:372` | — |
| `export:run` | invoke | `main/main.js:375` | — |
| `backlog:add` | invoke | `main/main.js:405` | `backlog.add` |
| `backlog:state` | invoke | `main/main.js:406` | `backlog.state` |
| `backlog:pause` | invoke | `main/main.js:407` | `backlog.pause` |
| `backlog:resume` | invoke | `main/main.js:408` | `backlog.resume` |
| `backlog:cancel` | invoke | `main/main.js:409` | `backlog.cancel` |
| `backlog:retry` | invoke | `main/main.js:410` | `backlog.retry` |
| `backlog:clear-done` | invoke | `main/main.js:411` | `backlog.clearDone` |
| `backlog:priority` | send | `main/main.js:412` | `backlog.setPriority` |
| `analysis:request` | invoke | `main/main.js:413` | `analysis.request` |
| `analysis:cancel` | invoke | `main/main.js:414` | `analysis.cancel` |
| `analysis:get` | invoke | `main/main.js:415` | `analysis.get` |
| `analysis:list` | invoke | `main/main.js:416` | `analysis.list` |
| `analysis:mixedit` | invoke | `main/main.js:417` | `analysis.setMixEdit` |
| `analysis:set-meta` | invoke | `main/main.js:418` | `analysis.setMeta` |
| `analysis:remove-audio` | invoke | `main/main.js:419` | `analysis.removeAudio` |
| `analysis:open-cache` | invoke | `main/main.js:420` | `analysis.openCache` |
| `stems:status` | invoke | `main/main.js:429` | `stems.status` |
| `stems:list` | invoke | `main/main.js:430` | `stems.list` |
| `stems:device` | invoke | `main/main.js:441` | `stems.device` |
| `stems:settings` | invoke | `main/main.js:444` | `stems.settings` |
| `stems:set` | invoke | `main/main.js:445` | `stems.set` |
| `stems:keep` | invoke | `main/main.js:453` | `stems.keep` |
| `stems:request` | invoke | `main/main.js:454` | `stems.request` |
| `stems:cancel` | invoke | `main/main.js:464` | `stems.cancel` |
| `stems:remove` | invoke | `main/main.js:465` | `stems.remove` |
| `stems:remove-all` | invoke | `main/main.js:466` | `stems.removeAll` |
| `settings:get` | invoke | `main/main.js:467` | `settings.get` |
| `settings:defaults` | invoke | `main/main.js:468` | `settings.defaults` |
| `net:state` | invoke | `main/main.js:484` | — |
| `settings:set` | invoke | `main/main.js:485` | `settings.set` |
| `settings:pick-dir` | invoke | `main/main.js:493` | `settings.pickDir` |
| `settings:library-dir` | invoke | `main/main.js:497` | `settings.libraryDir` |
| `path:open` | invoke | `main/main.js:498` | `settings.openPath` |
| `tools:check` | invoke | `main/main.js:499` | `tools.check` |
| `tools:install` | invoke | `main/main.js:535` | `tools.install` |
| `rec:sources` | invoke | `main/main.js:545` | `rec.sources` |
| `rec:start` | invoke | `main/main.js:549` | `rec.start` |
| `rec:stop` | invoke | `main/main.js:566` | `rec.stop` |
| `rec:state` | invoke | `main/main.js:578` | `rec.state` |
| `path:reveal` | invoke | `main/main.js:579` | `rec.reveal` |
| `local:list` | invoke | `main/main.js:584` | `local.list` |
| `local:add-folder` | invoke | `main/main.js:585` | `local.addFolder` |
| `local:remove-folder` | invoke | `main/main.js:594` | `local.removeFolder` |
| `local:register` | invoke | `main/main.js:595` | `local.register` |

Canales que el preload llama o escucha sin manejador `ipcMain` (eventos que envía `main.js` a la ventana, p. ej. `webContents.send`): `auth:changed`, `lib:import-progress`, `pl:event`, `stems:event`, `analysis:event`, `backlog:event`, `rec:ended`, `tools:progress`, `local:event`.

## Rutas `app://`

El protocolo `app://` sirve la interfaz y los datos locales sin abrir `file://`:

| Ruta | Definida en |
|---|---|
| `app://cover/` | `main/main.js:96` |
| `app://localfile/` | `main/main.js:98` |
| `app://stemfile/` | `main/main.js:99` |
| `app://cache/` | `main/main.js:100` |
| `app://shared/` | `main/main.js:101` |

## Persistencia

Lo que se guarda y quién es el dueño (el módulo que lo lee y escribe).

| Clave | Dueño |
|---|---|
| `localStorage:alyssdj.deck.bank.` | `renderer/deck.js` |
| `localStorage:alyssdj.fx.` | `renderer/fxchain.js` |
| `localStorage:alyssdj.fxpresets` | `renderer/fxpresets.js` |
| `localStorage:alyssdj.search.scope` | `renderer/library.js` |
| `localStorage:alyssdj.splits` | `renderer/splits.js` |
| `localStorage:alyssdj.view` | `renderer/views.js` |
| `localStorage:alyssdj:automix` | `renderer/automix.js` |
| `localStorage:alyssdj:history` | `renderer/app.js` |
| `localStorage:alyssdj:sampler` | `renderer/sampler.js` |
| `localStorage:automix-profile` | `renderer/automix-profiles.js` |
| `localStorage:ytdj:midi` | `renderer/midi.js` |
| `localStorage:ytdj:track:` | `renderer/deck.js` |
| `userData:analysis-queue.json` | `main/main.js` |
| `userData:device.json` | `main/stems-device.js` |
| `userData:genres.json` | `main/main.js` |
| `userData:index.json` | `main/stems.js` |
| `userData:local-index.json` | `main/main.js` |
| `userData:package.json` | `main/stems.js` |
| `userData:playlists-local.json` | `main/main.js` |
| `userData:playlists.json` | `main/main.js` |
| `userData:popularity.json` | `main/main.js` |
| `userData:selftest.json` | `main/selftest.js` |
| `userData:settings.json` | `main/settings.js` |
