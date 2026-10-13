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
    spinning: false
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

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.state = state;
  root.MBDJ.core = { $, state: state, makeId: makeId, esc: esc, available: available };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.core;
  }
})(typeof window !== 'undefined' ? window : globalThis);
