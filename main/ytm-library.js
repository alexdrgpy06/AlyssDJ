// Biblioteca de YouTube Music a través de la API interna (innertube) que usa la propia web,
// ejecutada dentro de una vista de music.youtube.com con tu sesión: búsqueda, "Me gusta", playlists.
'use strict';

// Se ejecuta en el main world de music.youtube.com (necesita window.ytcfg y las cookies de la página).
const PAGE_CALL = `
(async (endpoint, body) => {
  const cfg = (window.ytcfg && window.ytcfg.data_) || {};
  if (!cfg.INNERTUBE_API_KEY) throw new Error('YouTube Music aún no cargó');
  const headers = {
    'content-type': 'application/json',
    'x-origin': location.origin,
    'x-goog-authuser': String(cfg.SESSION_INDEX || 0),
    'x-youtube-client-name': String(cfg.INNERTUBE_CONTEXT_CLIENT_NAME || 67),
    'x-youtube-client-version': String(cfg.INNERTUBE_CLIENT_VERSION || ''),
  };
  const sapisid = (document.cookie.match(/(?:^|; )(?:__Secure-3PAPISID|SAPISID)=([^;]+)/) || [])[1];
  if (sapisid) {
    const ts = Math.floor(Date.now() / 1000);
    const data = new TextEncoder().encode(ts + ' ' + sapisid + ' ' + location.origin);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', data)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    headers.authorization = 'SAPISIDHASH ' + ts + '_' + hash;
  }
  const res = await fetch('/youtubei/v1/' + endpoint + '?prettyPrint=false', {
    method: 'POST', credentials: 'include', headers,
    body: JSON.stringify({ context: cfg.INNERTUBE_CONTEXT, ...body }),
  });
  if (!res.ok) throw new Error('innertube ' + res.status);
  return res.json();
})`;

// Filtro "Canciones" de la búsqueda de YT Music.
const SONGS_PARAM = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';

function* walk(node, key) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n, key);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === key) yield v;
    else yield* walk(v, key);
  }
}

const first = (node, key) => walk(node, key).next().value;
const runsText = (t) => (t?.runs || []).map((r) => r.text).join('') || t?.simpleText || '';
const DURATION = /^\d{1,2}(:\d{2}){1,2}$/;
const allTextsOf = (cols) => cols.flatMap((t) => (t?.runs || []).map((x) => x.text.trim())).find((t) => parsePlays(t)) || '';

function parseDuration(s) {
  if (!s) return 0;
  return s.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);
}

// «856 M reproducciones», «135 k», «1,2 B plays», «34.861.726 visualizaciones», «2.3M views» → número (o 0 si no es un conteo).
const PLAYS_RE = /^\s*([\d][\d.,\s]*)\s*(k|mil|m|mill?ones?|b|bill?ones?)?\.?\s*(?:de\s+)?(reproducciones|reproducción|plays?|views?|visualizaciones|vistas)\b/i;
function parsePlays(text) {
  const m = PLAYS_RE.exec(String(text || ''));
  if (!m) return 0;
  const unit = (m[2] || '').toLowerCase();
  const mult = /^(k|mil)$/.test(unit) ? 1e3 : /^(m|mill)/.test(unit) ? 1e6 : /^(b|bill)/.test(unit) ? 1e9 : 1;
  let n = m[1].trim().replace(/\s/g, '');
  if (mult === 1) n = n.replace(/[.,](?=\d{3}(\D|$))/g, ''); // separadores de miles: 34.861.726 / 34,861,726
  else n = n.replace(',', '.'); // «1,2 B» → 1.2
  const v = parseFloat(n);
  return Number.isFinite(v) ? Math.round(v * mult) : 0;
}

function parseSong(r) {
  const videoId = r.playlistItemData?.videoId || first(r.overlay, 'watchEndpoint')?.videoId || first(r.flexColumns, 'watchEndpoint')?.videoId;
  if (!videoId) return null;
  const cols = (r.flexColumns || []).map((c) => c.musicResponsiveListItemFlexColumnRenderer?.text);
  const fixed = (r.fixedColumns || []).map((c) => c.musicResponsiveListItemFixedColumnRenderer?.text);
  const title = runsText(cols[0]);
  const subRuns = (cols[1]?.runs || []).filter((x) => x.text.trim() && x.text.trim() !== '•');
  const pageType = (x) => x.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
  const artists = subRuns.filter((x) => pageType(x) === 'MUSIC_PAGE_TYPE_ARTIST' || pageType(x) === 'MUSIC_PAGE_TYPE_USER_CHANNEL').map((x) => x.text);
  const col2 = runsText(cols[2]);
  const plays = parsePlays(col2) || parsePlays(allTextsOf(cols)); // en las búsquedas la 3.ª columna trae las reproducciones
  const album = subRuns.find((x) => pageType(x) === 'MUSIC_PAGE_TYPE_ALBUM')?.text || (parsePlays(col2) ? '' : col2) || '';
  const allTexts = [...cols, ...fixed].flatMap((t) => (t?.runs || []).map((x) => x.text.trim()));
  const duration = allTexts.find((t) => DURATION.test(t)) || '';
  const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  return {
    videoId,
    title,
    artist: artists.join(', ') || subRuns.filter((x) => !DURATION.test(x.text.trim()))[0]?.text || '',
    album: album === title ? '' : album,
    duration: parseDuration(duration),
    plays,
    thumb: thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

function parseSongs(json) {
  const seen = new Set();
  const out = [];
  for (const r of walk(json, 'musicResponsiveListItemRenderer')) {
    const s = parseSong(r);
    if (s && !seen.has(s.videoId)) {
      seen.add(s.videoId);
      out.push(s);
    }
  }
  return out;
}

function parsePlaylists(json) {
  const out = [];
  for (const r of walk(json, 'musicTwoRowItemRenderer')) {
    const browseId = r.navigationEndpoint?.browseEndpoint?.browseId;
    if (!browseId || !browseId.startsWith('VL')) continue;
    const thumbs = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    out.push({ browseId, title: runsText(r.title), subtitle: runsText(r.subtitle), thumb: thumbs[thumbs.length - 1]?.url || '' });
  }
  return out;
}

// Radio de YouTube Music ("Iniciar radio"): cola infinita de pistas parecidas a la semilla.
function parseRadio(json) {
  const seen = new Set();
  const out = [];
  for (const r of walk(json, 'playlistPanelVideoRenderer')) {
    if (!r.videoId || seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    const runs = r.longBylineText?.runs || r.shortBylineText?.runs || [];
    const artists = [];
    for (const run of runs) {
      if (run.text.trim() === '•') break;
      if (run.text.trim() && !/^(,|&|y|and|e|und|et)$/i.test(run.text.trim())) artists.push(run.text.trim());
    }
    const thumbs = r.thumbnail?.thumbnails || [];
    const parts = runs.map((x) => x.text.trim()).filter((t) => t && t !== '•');
    const playsText = parts.find((t) => parsePlays(t)); // algunos temas de la radio (videos) traen «26 M de vistas»
    const credits = parts.filter((t) => !parsePlays(t));
    const year = Number((credits.find((t) => /^(19|20)\d{2}$/.test(t))) || 0) || null;
    out.push({
      videoId: r.videoId,
      title: runsText(r.title),
      artist: artists.join(', '),
      album: credits.length >= 3 ? credits[credits.length - 2] : '',
      year,
      plays: playsText ? parsePlays(playsText) : 0,
      duration: parseDuration(runsText(r.lengthText)),
      thumb: thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
    });
  }
  return out;
}

function continuationToken(json) {
  return first(json, 'continuationCommand')?.token || first(json, 'nextContinuationData')?.continuation || null;
}

const POP_TTL = 30 * 864e5;

class YtmLibrary {
  constructor(getWebContents, { cacheFile = null } = {}) {
    this.wc = getWebContents;
    this.popFile = cacheFile;
    this.pop = null; // videoId → { v: reproducciones, at }
    this.popQueue = [];
    this.popRunning = 0;
  }

  loadPop() {
    if (this.pop) return this.pop;
    this.pop = {};
    try {
      const f = typeof this.popFile === 'function' ? this.popFile() : this.popFile;
      if (f) this.pop = JSON.parse(require('fs').readFileSync(f, 'utf8'));
    } catch {}
    return this.pop;
  }

  savePop() {
    clearTimeout(this.popSave);
    this.popSave = setTimeout(() => {
      try {
        const f = typeof this.popFile === 'function' ? this.popFile() : this.popFile;
        if (f) require('fs').writeFileSync(f, JSON.stringify(this.pop));
      } catch {}
    }, 500);
  }

  // Reproducciones de una pista (endpoint `player` de YouTube Music: videoDetails.viewCount). Caché de 30 días y 3 consultas a la vez.
  popularity(videoId) {
    const cache = this.loadPop();
    const hit = cache[videoId];
    if (hit && Date.now() - hit.at < POP_TTL) return Promise.resolve(hit.v);
    return new Promise((resolve) => {
      this.popQueue.push({ videoId, resolve });
      this.pumpPop();
    });
  }

  async popularityMany(ids, { limit = 24 } = {}) {
    const out = {};
    await Promise.all([...new Set(ids)].slice(0, limit).map(async (id) => (out[id] = await this.popularity(id))));
    return out;
  }

  pumpPop() {
    while (this.popRunning < 3 && this.popQueue.length) {
      const { videoId, resolve } = this.popQueue.shift();
      this.popRunning++;
      this.call('player', { videoId })
        .then((json) => {
          const v = Number(json?.videoDetails?.viewCount) || 0;
          this.loadPop()[videoId] = { v, at: Date.now() };
          this.savePop();
          resolve(v);
        })
        .catch(() => resolve(0))
        .finally(() => {
          this.popRunning--;
          this.pumpPop();
        });
    }
  }

  async call(endpoint, body) {
    const wc = this.wc();
    if (!wc) throw new Error('Vista de biblioteca no disponible');
    return wc.executeJavaScript(`${PAGE_CALL}(${JSON.stringify(endpoint)}, ${JSON.stringify(body)})`, true);
  }

  async search(query) {
    let json = await this.call('search', { query, params: SONGS_PARAM });
    let songs = parseSongs(json);
    if (!songs.length) songs = parseSongs(await this.call('search', { query }));
    return songs;
  }

  async browseSongs(browseId, maxPages = 10) {
    let json = await this.call('browse', { browseId });
    const songs = parseSongs(json);
    for (let page = 1, token = continuationToken(json); token && page < maxPages; page++, token = continuationToken(json)) {
      json = await this.call('browse', { continuation: token });
      for (const s of parseSongs(json)) if (!songs.some((x) => x.videoId === s.videoId)) songs.push(s);
    }
    return songs;
  }

  async radio(videoId) {
    const json = await this.call('next', {
      videoId,
      playlistId: `RDAMVM${videoId}`,
      params: 'wAEB',
      isAudioOnly: true,
      tunerSettingValue: 'AUTOMIX_SETTING_NORMAL',
      enablePersistentPlaylistPanel: true,
      watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { hasPersistentPlaylistPanel: true, musicVideoType: 'MUSIC_VIDEO_TYPE_ATV' } },
    });
    return parseRadio(json).filter((t) => t.videoId !== videoId);
  }

  liked() {
    return this.browseSongs('VLLM');
  }

  async playlists() {
    return parsePlaylists(await this.call('browse', { browseId: 'FEmusic_liked_playlists' }));
  }

  playlist(browseId) {
    return this.browseSongs(browseId);
  }
}

module.exports = { PAGE_CALL, parsePlays, YtmLibrary, parseSongs, parsePlaylists, parseRadio };
