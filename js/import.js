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
    return { id: core.makeId(), title: title, artist: artist, status: 'available', addedAt: new Date().toISOString() };
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
          item = { id: core.makeId(), title: b, artist: a, status: 'available', addedAt: new Date().toISOString() };
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

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.import = {
    normalizeLine: normalizeLine,
    parseText: parseText,
    dedupe: dedupe,
    importSongs: importSongs
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.import;
  }
})(typeof window !== 'undefined' ? window : globalThis);
