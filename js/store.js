/* js/store.js — persistence seam stub for C-06.
 * Exposes save/load/clear no-ops (in-memory) so app.js load order is final.
 * C-06 fills with localStorage mbdj.v1 autosave + banner + beforeunload. */
(function (root) {
  'use strict';

  var mem = null;

  function save(snapshot) {
    mem = snapshot || null;
    return true;
  }

  function load() {
    return mem;
  }

  function clear() {
    mem = null;
    return true;
  }

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.store = { save: save, load: load, clear: clear };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.store;
  }
})(typeof window !== 'undefined' ? window : globalThis);
