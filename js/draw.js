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

  // Commit-before-render: decides the song synchronously, mutates state,
  // pushes history entry, sets spinning. Animation (app.js) must only render.
  // Returns picked song or null when guarded (spinning or empty pool).
  function pickAndCommit(forcedIndex) {
    var core = getCore();
    var st = core.state;
    if (st.spinning) return null;
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
    st.spinning = true;
    return s;
  }

  function finishCommit() {
    var core = getCore();
    core.state.spinning = false;
  }

  // C-03 draw-engine: spin base duration (ms). Named + exported so tests pin
  // it; NEVER merge the C-08 public-screen buffer (REVEAL_DELAY_MS) into this.
  var SPIN_MS = 2750;

  // C-03 draw-engine: cancellable reveal handle. Single owner beside `spinning`
  // state, so clear/reset paths cancel by construction (no ghost reveals).
  // Node-safe seam: tests inject { setTimeoutFn, clearTimeoutFn }; browsers use
  // the globals. No libs, no modules — file:// compatible.
  var revealTimer = null;
  var timerFns = null;

  function setTimerFns(fns) { timerFns = fns || null; }
  function resetTimerFns() { timerFns = null; }

  function getSetTimeout() {
    if (timerFns && typeof timerFns.setTimeoutFn === 'function') return timerFns.setTimeoutFn;
    return function (cb, ms) { return setTimeout(cb, ms); };
  }

  function getClearTimeout() {
    if (timerFns && typeof timerFns.clearTimeoutFn === 'function') return timerFns.clearTimeoutFn;
    return function (id) { clearTimeout(id); };
  }

  function scheduleReveal(fn, delayMs) {
    cancelReveal();
    var delay = (typeof delayMs === 'number') ? delayMs : SPIN_MS;
    revealTimer = getSetTimeout()(function () {
      revealTimer = null; // null-before-invoke: a racing cancel stays a safe no-op
      fn();
    }, delay);
    return revealTimer;
  }

  // Idempotent; clears the timer handle only — `spinning` resets via finishCommit.
  function cancelReveal() {
    if (revealTimer === null || revealTimer === undefined) return false;
    var id = revealTimer;
    revealTimer = null;
    try { getClearTimeout()(id); } catch (e) { /* already fired: no-op */ }
    return true;
  }

  function isRevealing() { return revealTimer !== null && revealTimer !== undefined; }

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.draw = {
    secureIndex: secureIndex,
    pickAndCommit: pickAndCommit,
    finishCommit: finishCommit,
    SPIN_MS: SPIN_MS,
    scheduleReveal: scheduleReveal,
    cancelReveal: cancelReveal,
    isRevealing: isRevealing,
    setTimerFns: setTimerFns,
    resetTimerFns: resetTimerFns
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.draw;
  }
})(typeof window !== 'undefined' ? window : globalThis);
