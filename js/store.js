/* js/store.js — C-06 session persistence boundary.
 * localStorage over IndexedDB (design: sync, file://-safe, <1000 songs).
 * Tiny boundary: save/load/clear/isAvailable over injectable storage.
 * App owns policy (banner vs warning). Atomic single setItem per render.
 * Classic script, Node-safe. */
(function (root) {
  'use strict';

  var KEY = 'mbdj.v1';
  var SCHEMA_VERSION = 1;

  function resolveStorage(explicit) {
    if (explicit) return explicit;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* blocked */ }
    try {
      if (root && root.localStorage) return root.localStorage;
    } catch (e2) { /* blocked */ }
    return null;
  }

  function isAvailable(explicit) {
    var st = resolveStorage(explicit);
    if (!st || typeof st.setItem !== 'function' || typeof st.getItem !== 'function') return false;
    try {
      var probe = '__mbdj_probe__';
      st.setItem(probe, '1');
      if (typeof st.removeItem === 'function') {
        try { st.removeItem(probe); } catch (e) { /* ignore cleanup failure */ }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function isValidSnapshot(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    if (!Array.isArray(obj.songs) || !Array.isArray(obj.history)) return false;
    if (obj.schemaVersion !== SCHEMA_VERSION) return false;
    if (obj.current !== null && obj.current !== undefined) {
      if (typeof obj.current !== 'object' || Array.isArray(obj.current)) return false;
      if (typeof obj.current.title !== 'string') return false;
    }
    return true;
  }

  // Never persist the transient spinning flag as true: strip it on save.
  function save(snapshot, explicit) {
    var st = resolveStorage(explicit);
    if (!st || typeof st.setItem !== 'function') return { ok: false, reason: 'unavailable' };
    var src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var payload = {
      songs: Array.isArray(src.songs) ? src.songs : [],
      history: Array.isArray(src.history) ? src.history : [],
      current: src.current != null ? src.current : null,
      locked: src.locked === true,
      startedAt: typeof src.startedAt === 'string' ? src.startedAt : new Date().toISOString(),
      savedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION
    };
    try {
      st.setItem(KEY, JSON.stringify(payload));
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'unavailable' };
    }
  }

  function load(explicit) {
    var st = resolveStorage(explicit);
    if (!st || typeof st.getItem !== 'function') return { ok: false, reason: 'unavailable' };
    var raw;
    try {
      raw = st.getItem(KEY);
    } catch (e) {
      return { ok: false, reason: 'unavailable' };
    }
    if (raw == null || raw === '') return { ok: false, reason: 'empty' };
    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      return { ok: false, reason: 'corrupt' };
    }
    if (!isValidSnapshot(obj)) return { ok: false, reason: 'corrupt' };
    return {
      ok: true,
      snapshot: {
        songs: obj.songs,
        history: obj.history,
        current: obj.current == null ? null : obj.current,
        locked: obj.locked === true,
        startedAt: obj.startedAt,
        savedAt: obj.savedAt,
        schemaVersion: obj.schemaVersion,
        spinning: false
      }
    };
  }

  function clear(explicit) {
    var st = resolveStorage(explicit);
    if (!st || typeof st.removeItem !== 'function') return { ok: false, reason: 'unavailable' };
    try {
      st.removeItem(KEY);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'unavailable' };
    }
  }

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.store = {
    KEY: KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    save: save,
    load: load,
    clear: clear,
    isAvailable: isAvailable
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.store;
  }
})(typeof window !== 'undefined' ? window : globalThis);
