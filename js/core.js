/* js/core.js — shared state + pure helpers (verbatim from monolith index.html).
 * Classic script (no type=module). Node-safe: no window/document access at import.
 * Global ownership: MBDJ.state, MBDJ.core.{makeId,esc,available,$} */
(function (root) {
  'use strict';

  function $(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  var state = {
    songs: [],
    history: [],
    current: null,
    spinning: false,
    locked: false,
    startedAt: new Date().toISOString(),
    schemaVersion: 1
  };

  // Verbatim from monolith.
  function makeId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Verbatim from monolith.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Verbatim semantics: filter status==='available'.
  // Accepts optional list for Node tests; defaults to shared state in browser.
  function available(list) {
    var arr = Array.isArray(list) ? list : state.songs;
    return arr.filter(function (s) { return s.status === 'available'; });
  }

  // c-02: plain-object factories (JSON-safe, no classes).
  function createSong(title, artist) {
    return {
      id: makeId(),
      title: title,
      artist: (artist == null || artist === '') ? '' : String(artist),
      status: 'available',
      addedAt: new Date().toISOString()
    };
  }

  function formatTime(d) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  function createHistoryEntry(song, n) {
    return {
      n: n,
      id: song.id,
      title: song.title,
      artist: song.artist,
      status: song.status,
      time: formatTime(new Date()),
      motivo: ''
    };
  }

  // c-11: song-less administrative unlock entry (the C-11 writer in js/app.js
  // handleUnlockRequest is the ONLY producer). Fits HistoryEntry + motivo so
  // the C-10 tolerant render/CSV and the C-06 autosave carry it with zero
  // schema bump (schemaVersion stays 1). `unlock-` prefix + timestamp + rand
  // never collides with a song id (`s…`); unlock rows are never looked up by
  // draw paths. Visible state 'unlock' — never mislabeled Sorteada.
  function createUnlockEntry(n, motivo) {
    return {
      n: n,
      id: 'unlock-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title: 'Desbloqueo administrativo',
      artist: '',
      status: 'unlock',
      time: formatTime(new Date()),
      motivo: String(motivo == null ? '' : motivo)
    };
  }

  function createSession() {
    return {
      songs: [],
      history: [],
      current: null,
      spinning: false,
      locked: false,
      startedAt: new Date().toISOString(),
      schemaVersion: 1
    };
  }

  // c-02: terminal transitions available -> drawn -> played | void.
  function isValidTransition(from, next) {
    if (from === 'available' && next === 'drawn') return true;
    if (from === 'drawn' && (next === 'played' || next === 'void')) return true;
    return false;
  }

  function setSongStatus(song, next) {
    if (!song || !isValidTransition(song.status, next)) return false;
    song.status = next;
    return true;
  }

  // c-02: in-place history update (findLast with index-loop fallback).
  // c-09: optional trimmed motivo stored on the voided entry (audit record).
  function setHistoryStatus(history, songId, next, motivo) {
    if (!Array.isArray(history)) return false;
    var h = null;
    if (history.findLast) h = history.findLast(function (x) { return x.id === songId; });
    else {
      for (var i = history.length - 1; i >= 0; i--) {
        if (history[i].id === songId) { h = history[i]; break; }
      }
    }
    if (!h) return false;
    h.status = next;
    if (typeof motivo === 'string' && motivo) h.motivo = motivo;
    return true;
  }

  // c-02: derived views.
  function total(session) {
    return session.songs.length;
  }

  function remaining(session) {
    return session.songs.filter(function (s) { return s.status === 'available'; }).length;
  }

  function drawn(session) {
    return session.songs.filter(function (s) { return s.status !== 'available'; }).length;
  }

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.state = state;
  root.MBDJ.core = { $, state: state, makeId: makeId, esc: esc, available: available, createSong: createSong, createHistoryEntry: createHistoryEntry, createUnlockEntry: createUnlockEntry, createSession: createSession, formatTime: formatTime, isValidTransition: isValidTransition, setSongStatus: setSongStatus, setHistoryStatus: setHistoryStatus, total: total, remaining: remaining, drawn: drawn };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.core;
  }
})(typeof window !== 'undefined' ? window : globalThis);
