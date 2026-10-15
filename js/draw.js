/* js/draw.js — secureIndex (rejection sampling) + commit-before-render.
 * IN-04: biased modulo draw() kept ONLY as commented reference below; the
 * secure path is the single commit path (no behavior change beyond uniformity).
 * Classic script, depends on js/core.js. Node-safe. */
(function (root) {
  'use strict';

  function getCore() {
    if (root.MBDJ && root.MBDJ.core) return root.MBDJ.core;
    if (typeof require !== 'undefined') {
      try { return require('./core.js'); } catch (e) { /* ignore */ }
    }
    throw new Error('MBDJ.core missing: load js/core.js first');
  }

  function getCrypto() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto;
    try {
      // Node fallback (tests): WebCrypto via node:crypto.
      var nc = require('node:crypto');
      if (nc && nc.webcrypto && nc.webcrypto.getRandomValues) return nc.webcrypto;
      return nc;
    } catch (e) { return null; }
  }

  // Verbatim from monolith (rejection sampling — exact uniformity, no modulo bias).
  function secureIndex(n) {
    var c = getCrypto();
    if (!c || !c.getRandomValues) throw new Error('WebCrypto unavailable');
    var max = 0x100000000, limit = max - (max % n);
    var a = new Uint32Array(1);
    do { c.getRandomValues(a); } while (a[0] >= limit);
    return a[0] % n;
  }

  /*
   * IN-04 reference — BIASED legacy path (DO NOT USE, kept for audit only):
   *   var idx = crypto.getRandomValues(new Uint32Array(1))[0] % pool.length;
   * Bias: when pool.length does not divide 2^32, lower indices are favored.
   * Replaced by secureIndex() above; secure draw handler below is the only commit path.
   */

  // Commit-before-render: decides the song synchronously, mutates state and
  // pushes history entry. Paint (app.js) must only render. C-15: no operator
  // spin window exists, so no `spinning` flag is set here — the single pending
  // window is the app.js public buffer (isPublicBuffer), which owns the guards.
  // Returns picked song or null when guarded (empty pool).
  function pickAndCommit(forcedIndex) {
    var core = getCore();
    var st = core.state;
    var pool = core.available();
    if (!pool.length) return null;
    var idx = (typeof forcedIndex === 'number')
      ? (forcedIndex % pool.length)
      : secureIndex(pool.length);
    var s = pool[idx];
    s.status = 'drawn';
    st.current = s;
    // C-10 history-export: canonical es-AR HH:MM:SS via core.formatTime
    // (hour12:false). The previous inline toLocaleTimeString defaulted to a
    // 12-hour clock ("02:04:34 a. m.") and broke the ^\d{2}:\d{2}:\d{2}$
    // audit contract that core.createHistoryEntry already keeps.
    st.history.push({
      n: st.history.length + 1,
      id: s.id,
      title: s.title,
      artist: s.artist,
      status: 'drawn',
      time: core.formatTime(new Date())
    });
    // C-07 draw-no-repeat: first committed draw freezes the catalog.
    // Idempotent — stays true for later draws; persisted via C-06 autosave
    // in render(). Set inside the commit (not app.js) so Node/test paths
    // can't skip the lock. Before spinning=true, no DOM, no schemaVersion change.
    st.locked = true;
    return s;
  }

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.draw = {
    secureIndex: secureIndex,
    pickAndCommit: pickAndCommit
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.draw;
  }
})(typeof window !== 'undefined' ? window : globalThis);
