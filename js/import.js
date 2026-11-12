/* js/import.js — normalizeLine/parseText/dedupe/importSongs (verbatim behavior).
 * Classic script, depends on js/core.js (MBDJ.core). Node-safe. */
(function (root) {
  'use strict';

  function getCore() {
    if (root.MBDJ && root.MBDJ.core) return root.MBDJ.core;
    // Node fallback: require core directly.
    if (typeof require !== 'undefined') {
      try { return require('./core.js'); } catch (e) { /* ignore */ }
    }
    throw new Error('MBDJ.core missing: load js/core.js first');
  }

  // C-04 freeze: verbatim parsing contract (spec import-catalog). Numbering
  // strip / dash-split regexes below are frozen; widen only with a new RED test.
  // Verbatim from monolith (uses makeId from core).
  function normalizeLine(line) {
    var core = getCore();
    var s = line.trim().replace(/^\s*(?:\d+[.)-]|[-*\u2022])\s*/, '');
    if (!s) return null;
    var parts = s.split(/\s+[\u2014\u2013-]\s+/);
    var title = s, artist = '';
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
    if (!title) return null;
    return { id: core.makeId(), title: title, artist: artist, status: 'available', addedAt: new Date().toISOString(), coverUrl: null };
  }

  // Verbatim from monolith.
  function parseText(text) {
    var core = getCore();
    var lines = text.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (lines.length && /^((t[i\u00ed]tulo|canci[o\u00f3]n|song|track))\s*[,;\t]/i.test(lines[0])) lines.shift();
    var parsed = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cells = line.split(/[\t;]/);
      if (cells.length === 1 && line.indexOf(',') !== -1) cells = line.split(',');
      var item;
      if (cells.length >= 2) {
        var a = cells[0].trim(), b = cells.slice(1).join(' ').trim();
        if (a && b && !/^https?:/i.test(a)) {
          item = { id: core.makeId(), title: b, artist: a, status: 'available', addedAt: new Date().toISOString(), coverUrl: null };
        } else {
          item = normalizeLine(line);
        }
      } else {
        item = normalizeLine(line);
      }
      if (item) parsed.push(item);
    }
    return dedupe(parsed);
  }

  // C-04 freeze: dedupe key order `title|artist` + report strings below are
  // frozen (`N nueva(s), M duplicado(s) omitido(s)`, `No se detectaron…`).
  // Verbatim from monolith.
  function dedupe(items) {
    var seen = new Set();
    return items.filter(function (x) {
      var k = (x.title + '|' + x.artist).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function currentSetMessage(msg) {
    if (typeof document !== 'undefined') {
      var el = document.getElementById('importMessage');
      if (el) el.textContent = msg;
    }
  }

  // Messaging contract (verbatim strings): duplicates reported, never silent.
  function importSongs(items, label) {
    var core = getCore();
    var songs = core.state.songs;
    if (!items.length) {
      var emptyMsg = 'No se detectaron canciones. Revisá el formato del archivo o pegá el texto manualmente.';
      currentSetMessage(emptyMsg);
      return { added: 0, duplicates: 0, message: emptyMsg };
    }
    var old = songs.length;
    var merged = dedupe(songs.concat(items));
    var added = merged.length - old;
    core.state.songs.length = 0;
    for (var i = 0; i < merged.length; i++) core.state.songs.push(merged[i]);
    var msg = 'Importación completada: ' + added + ' canción(es) nueva(s). ' + (items.length - added) + ' duplicado(s) omitido(s). Revisá el listado antes de iniciar.';
    currentSetMessage(msg);
    if (typeof document !== 'undefined' && root.MBDJ && root.MBDJ.app && typeof root.MBDJ.app.render === 'function') {
      try { root.MBDJ.app.render(); } catch (e) { /* ignore in tests */ }
    }
    return { added: added, duplicates: items.length - added, message: msg };
  }

  // C-05 import-file: xlsx→text bridge (additive, frozen pipeline untouched).
  // Reads the FIRST worksheet only via the vendored SheetJS global
  // (`vendor/sheetjs/xlsx.full.min.js`, loaded on demand, never CDN),
  // serializes rows as `cells.join(',')` lines and reuses parseText/dedupe.
  // Pure seam: tests inject a fake `XLSX` global, no network involved.
  function getXlsxLib() {
    if (root && root.XLSX) return root.XLSX;
    if (typeof globalThis !== 'undefined' && globalThis.XLSX) return globalThis.XLSX;
    if (typeof window !== 'undefined' && window.XLSX) return window.XLSX;
    return null;
  }

  function parseXlsxBuffer(buf) {
    var lib = getXlsxLib();
    if (!lib) throw new Error('XLSX no disponible: cargá vendor/sheetjs/xlsx.full.min.js');
    var wb = lib.read(buf, { type: 'array' });
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) return [];
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = lib.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (!rows || !rows.length) return [];
    var lines = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!Array.isArray(r)) {
        var s = String(r == null ? '' : r).trim();
        if (s) lines.push(s);
        continue;
      }
      var cells = r.map(function (c) { return String(c == null ? '' : c).trim(); });
      var allEmpty = true;
      for (var j = 0; j < cells.length; j++) {
        if (cells[j]) { allEmpty = false; break; }
      }
      if (allEmpty) continue;
      lines.push(cells.join(','));
    }
    if (!lines.length) return [];
    return parseText(lines.join('\n'));
  }

  // C-16 song-covers: best-effort cover resolution at import (never in show).
  // iTunes Search API (keyless, CORS *) — term="artist title", limit=8,
  // exact-insensitive pick with first-result fallback, 100x100->600x600.
  // Pre-show tuning (operador): la carga de tapas es PRE-SHOW, sin apuro de
  // timeout corto; se maximiza el completado automático online antes de caer
  // a carga manual. Orden de fallback explícito por canción:
  //   automático-online (intento 1) → 1 retry ante fallo transitorio
  //   (timeout/aborto/rechazo/sin-respuesta) → null + manual (campo por fila
  //   o local assets/covers/). Una respuesta válida sin match NO reintenta.
  // Timeout 12 s por intento: cubre p95 de iTunes en redes lentas pre-show con
  // margen; peor caso 24 s/canción, no-bloqueante (progreso i/N vivo, catálogo
  // usable mientras tanto). El retry vive solo en esta vía de importación
  // (locked-gated, cero fetch en draw/reveal/render/broadcast) → SOLO pre-show.
  // Any terminal failure -> null. enrichCovers is sequential + idempotent
  // (skips songs with coverUrl). Pure seams: fetchFn injected (mocked in
  // tests, real fetch from app.js); opts {timeoutMs,retries,limit} override
  // defaults (test seam for speed, same code path).
  var ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
  var COVER_TIMEOUT_MS = 12000;
  var ITUNES_LIMIT = 8;
  var COVER_RETRIES = 1;

  function normCoverStr(s) {
    return String(s == null ? '' : s).replace(/[‘’‚‛′‵`´']/g, "'").replace(/[“”„‟"]/g, '"').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }

  // C-16 bugfix demo-covers: base form for the relaxed tier — norm plus
  // stripped trailing parenthetical/bracket suffixes (`(feat. …)`,
  // `(Remasterizado …)`, `(En Vivo)`), which iTunes appends to trackNames
  // while the catalog keeps the bare title.
  function baseCoverStr(s) {
    return normCoverStr(s).replace(/(\s*[(\[].*?[)\]]\s*)+$/, '').trim();
  }

  function artistMatches(ra, wa) {
    return !wa || ra === wa || (wa && ra && (ra.indexOf(wa) !== -1 || wa.indexOf(ra) !== -1));
  }

  function pickCoverResult(results, song) {
    if (!Array.isArray(results) || !results.length) return null;
    var wt = normCoverStr(song.title);
    var wa = normCoverStr(song.artist);
    var i, r, rt, ra;
    for (i = 0; i < results.length; i++) {
      r = results[i] || {};
      rt = normCoverStr(r.trackName);
      ra = normCoverStr(r.artistName);
      if (wt && rt === wt && artistMatches(ra, wa)) return r;
    }
    // Relaxed tier: same artist rule, base titles equal (quotes folded,
    // version suffixes stripped). Keeps a wrong-artist first result out.
    var wb = baseCoverStr(song.title);
    if (wb) {
      for (i = 0; i < results.length; i++) {
        r = results[i] || {};
        rt = baseCoverStr(r.trackName);
        ra = normCoverStr(r.artistName);
        if (rt === wb && artistMatches(ra, wa)) return r;
      }
    }
    return results[0];
  }

  function coverArt600(url) {
    return String(url).replace('100x100', '600x600');
  }

  function resolveCoverOpts(opts) {
    var o = (opts && typeof opts === 'object') ? opts : {};
    return {
      timeoutMs: (typeof o.timeoutMs === 'number' && o.timeoutMs > 0) ? o.timeoutMs : COVER_TIMEOUT_MS,
      retries: (typeof o.retries === 'number' && o.retries >= 0) ? Math.floor(o.retries) : COVER_RETRIES,
      limit: (typeof o.limit === 'number' && o.limit > 0) ? Math.floor(o.limit) : ITUNES_LIMIT
    };
  }

  // One attempt: {kind:'artwork',url} on match, {kind:'nomatch'} on a valid
  // response without usable art (never retried), {kind:'transient'} on
  // timeout/abort/reject/no-response (retryable once pre-show).
  function singleCoverAttempt(song, fetchFn, url, timeoutMs) {
    var controller = null;
    var signal;
    try {
      if (typeof AbortController !== 'undefined') { controller = new AbortController(); signal = controller.signal; }
    } catch (e) { controller = null; }
    var fetchP;
    try {
      fetchP = fetchFn(url, signal ? { signal: signal } : undefined);
    } catch (e) {
      return Promise.resolve({ kind: 'transient' });
    }
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try { if (controller && controller.abort) controller.abort(); } catch (e) {}
        resolve({ kind: 'transient' });
      }, timeoutMs);
      Promise.resolve(fetchP).then(function (res) {
        if (done) return;
        if (!res || res.ok === false) { done = true; clearTimeout(timer); resolve({ kind: 'transient' }); return; }
        return Promise.resolve().then(function () { return res.json(); }).then(function (data) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          var pick = pickCoverResult(data && data.results, song);
          if (!pick) { resolve({ kind: 'nomatch' }); return; }
          var art = pick.artworkUrl100 || pick.artworkUrl60;
          if (!art) { resolve({ kind: 'nomatch' }); return; }
          resolve({ kind: 'artwork', url: coverArt600(art) });
        }, function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({ kind: 'transient' });
        });
      }, function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ kind: 'transient' });
      });
    });
  }

  function resolveCoverURL(song, fetchFn, opts) {
    if (!song || typeof fetchFn !== 'function') return Promise.resolve(null);
    var title = song.title != null ? String(song.title).trim() : '';
    if (!title) return Promise.resolve(null);
    var artist = song.artist != null ? String(song.artist).trim() : '';
    var term = (artist ? artist + ' ' : '') + title;
    var cfg = resolveCoverOpts(opts);
    var url = ITUNES_SEARCH_URL + '?term=' + encodeURIComponent(term) + '&media=music&entity=song&limit=' + cfg.limit;
    var attemptsLeft = cfg.retries + 1;
    return new Promise(function (resolve) {
      function next() {
        singleCoverAttempt(song, fetchFn, url, cfg.timeoutMs).then(function (out) {
          if (out.kind === 'artwork') { resolve(out.url); return; }
          if (out.kind === 'nomatch') { resolve(null); return; }
          if (attemptsLeft > 1) { attemptsLeft--; next(); return; }
          resolve(null);
        });
      }
      next();
    });
  }

  function enrichCovers(songs, fetchFn, onProgress, opts) {
    var list = Array.isArray(songs) ? songs : [];
    if (typeof fetchFn !== 'function') return Promise.resolve({ resolved: 0, total: list.length });
    var cb = (typeof onProgress === 'function') ? onProgress : null;
    var pass = opts;
    if (!pass && onProgress && typeof onProgress === 'object') pass = onProgress;
    var resolved = 0;
    var done = 0;
    function report() {
      if (typeof cb !== 'function') return;
      try { cb({ done: done, total: list.length, resolved: resolved }); } catch (e) {}
    }
    var chain = Promise.resolve();
    list.forEach(function (s) {
      chain = chain.then(function () {
        if (!s || s.coverUrl) { done++; report(); return null; }
        return resolveCoverURL(s, fetchFn, pass).then(function (url) {
          if (url) { s.coverUrl = url; resolved++; }
          done++;
          report();
          return null;
        });
      });
    });
    return chain.then(function () { return { resolved: resolved, total: list.length }; });
  }

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.import = {
    normalizeLine: normalizeLine,
    parseText: parseText,
    dedupe: dedupe,
    importSongs: importSongs,
    parseXlsxBuffer: parseXlsxBuffer,
    resolveCoverURL: resolveCoverURL,
    enrichCovers: enrichCovers,
    ITUNES_SEARCH_URL: ITUNES_SEARCH_URL,
    COVER_TIMEOUT_MS: COVER_TIMEOUT_MS,
    ITUNES_LIMIT: ITUNES_LIMIT,
    COVER_RETRIES: COVER_RETRIES
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.import;
  }
})(typeof window !== 'undefined' ? window : globalThis);
