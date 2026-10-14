const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('draw.js secureIndex + commit-before-render', () => {
  it('loads without window/document crash and exposes seam', () => {
    const draw = require('../js/draw.js');
    assert.equal(typeof draw.secureIndex, 'function');
    assert.equal(typeof draw.pickAndCommit, 'function');
  });

  it('secureIndex stays in bounds [0,n) over many draws (happy)', () => {
    const draw = require('../js/draw.js');
    for (let i = 0; i < 200; i++) {
      const v = draw.secureIndex(12);
      assert.ok(Number.isInteger(v) && v >= 0 && v < 12, 'in bounds: ' + v);
    }
  });

  it('secureIndex edge: n=1 always 0, distribution covers more than one value', () => {
    const draw = require('../js/draw.js');
    assert.equal(draw.secureIndex(1), 0);
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(draw.secureIndex(5));
    assert.ok(seen.size > 1, 'rejection sampling varies, got ' + [...seen].join(','));
  });

  it('pickAndCommit decides before animation + spinning guard (commit-before-render)', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    core.state.songs = [
      { id: 's1', title: 'A', artist: 'X', status: 'available' },
      { id: 's2', title: 'B', artist: 'Y', status: 'available' },
    ];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    const picked = draw.pickAndCommit(0);
    assert.ok(picked, 'picks a song');
    assert.equal(picked.status, 'drawn');
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].status, 'drawn');
    // spinning guard: second commit while spinning returns null
    core.state.spinning = true;
    assert.equal(draw.pickAndCommit(0), null);
    core.state.spinning = false;
    core.state.songs = [];
    core.state.history = [];
    core.state.current = null;
  });
});

function chiSquare(counts, expected) {
  let s = 0;
  for (let i = 0; i < counts.length; i++) {
    const d = counts[i] - expected;
    s += (d * d) / expected;
  }
  return s;
}

// Deterministic WebCrypto stub: cycles 0,1,2,... so every residue mod n is
// exercised exactly equally. Restores the original descriptor afterwards.
function withStubbedCrypto(stubFn, fn) {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: stubFn }, configurable: true });
  try {
    return fn();
  } finally {
    if (desc) Object.defineProperty(globalThis, 'crypto', desc);
    else delete globalThis.crypto;
  }
}

describe('c-03 1.1: secureIndex uniformity (chi-square, 6000 draws over 6)', () => {
  it('RED: deterministic stubbed source is exactly uniform (chi-square 0, each 1000)', () => {
    const draw = require('../js/draw.js');
    let counter = 0;
    const counts = withStubbedCrypto((a) => {
      for (let i = 0; i < a.length; i++) { a[i] = counter; counter = (counter + 1) >>> 0; }
      return a;
    }, () => {
      const c = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 6000; i++) c[draw.secureIndex(6)]++;
      return c;
    });
    for (let i = 0; i < 6; i++) assert.equal(counts[i], 1000, 'cell ' + i + ' exactly 1000');
    assert.equal(chiSquare(counts, 1000), 0);
  });

  it('RED: real crypto over 6000 draws falls inside chi-square 99% band (< 15.086, df=5)', () => {
    const draw = require('../js/draw.js');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[draw.secureIndex(6)]++;
    // Independent literal: chi-square critical value, df=5, p=0.99 -> 15.086.
    assert.ok(chiSquare(counts, 1000) < 15.086, 'chi-square in 99% band, counts=' + counts.join(','));
  });
});

describe('c-03 1.3: bias absence + edges (no tautologies)', () => {
  it('band is sensitive: a fully biased sampler fails the same 15.086 band', () => {
    // Independent check that the 1.1 band can actually reject: sampler stuck on 0.
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[0]++;
    assert.ok(chiSquare(counts, 1000) >= 15.086, 'biased sampler must fail the band');
  });

  it('no executable modulo-bias shortcut in js/draw.js; audit comment kept', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'draw.js'), 'utf8');
    // Strip block + line comments so the audit note itself cannot trip the scan.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    // The ONLY allowed `% pool` is the documented forcedIndex test seam
    // (test-only injection, never a random source); any other is a bias path.
    const poolMods = code.match(/%\s*pool/g) || [];
    assert.equal(poolMods.length, 1, 'exactly one `% pool` site (the forcedIndex seam), found ' + poolMods.length);
    assert.ok(/forcedIndex\s*%\s*pool\.length/.test(code), 'that site is the forcedIndex seam');
    assert.ok(!/getRandomValues\s*\([^)]*\)\s*\[\s*0\s*\]\s*%/.test(code), 'no direct getRandomValues(..)[0] % shortcut');
    assert.ok(!/Math\.random/.test(code), 'no Math.random fallback in draw engine');
    assert.ok(/BIASED/.test(src), 'audit comment for the legacy biased path is kept');
  });

  it('edge: n=1 is deterministic literal 0', () => {
    const draw = require('../js/draw.js');
    assert.equal(draw.secureIndex(1), 0);
    assert.equal(draw.secureIndex(1), 0);
  });

  it('edge: empty pool blocks the draw (null, no history, control stays disabled)', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    core.state.songs = [];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    assert.equal(draw.pickAndCommit(0), null);
    assert.equal(draw.pickAndCommit(), null);
    assert.equal(core.state.history.length, 0);
    assert.equal(core.state.current, null);
  });
});

// Injectable-timer fake: records setTimeout calls, never fires unless told to.
function makeFakeTimers() {
  let seq = 0;
  const pending = new Map();
  return {
    pending,
    setTimeoutFn: (cb, ms) => { seq += 1; pending.set(seq, { cb, ms }); return seq; },
    clearTimeoutFn: (id) => { pending.delete(id); },
    fireAll: () => {
      for (const id of Array.from(pending.keys())) {
        const p = pending.get(id);
        if (p) { pending.delete(id); p.cb(); }
      }
    },
  };
}

describe('c-03 2.1: cancellable reveal timeout (RED)', () => {
  it('RED: draw exposes SPIN_MS=2750 + scheduleReveal/cancelReveal/isRevealing seam', () => {
    const draw = require('../js/draw.js');
    assert.equal(draw.SPIN_MS, 2750);
    assert.equal(typeof draw.scheduleReveal, 'function');
    assert.equal(typeof draw.cancelReveal, 'function');
    assert.equal(typeof draw.isRevealing, 'function');
  });

  it('RED: schedule then cancel before fire -> callback never runs', () => {
    const draw = require('../js/draw.js');
    const fake = makeFakeTimers();
    draw.setTimerFns(fake);
    try {
      let fired = 0;
      draw.scheduleReveal(() => { fired++; });
      assert.equal(draw.isRevealing(), true);
      draw.cancelReveal();
      assert.equal(draw.isRevealing(), false);
      fake.fireAll();
      assert.equal(fired, 0, 'cancelled reveal must never fire');
    } finally {
      draw.resetTimerFns();
    }
  });

  it('RED: default reveal delay is SPIN_MS (2750), separate from any public-screen buffer', () => {
    const draw = require('../js/draw.js');
    const fake = makeFakeTimers();
    draw.setTimerFns(fake);
    try {
      draw.scheduleReveal(() => {});
      assert.equal(fake.pending.size, 1);
      const [[, entry]] = Array.from(fake.pending.entries());
      assert.equal(entry.ms, 2750);
      draw.cancelReveal();
    } finally {
      draw.resetTimerFns();
    }
  });

  it('RED: clearSongs path cancels an in-flight reveal (no ghost after vaciar mid-giro)', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    const app = require('../js/app.js');
    const fake = makeFakeTimers();
    draw.setTimerFns(fake);
    try {
      core.state.songs = [{ id: 's1', title: 'A', artist: 'X', status: 'available' }];
      core.state.history = [];
      core.state.current = null;
      core.state.spinning = false;
      draw.pickAndCommit(0);
      let fired = 0;
      draw.scheduleReveal(() => { fired++; });
      app.handleClearSongs();
      fake.fireAll();
      assert.equal(fired, 0, 'no ghost reveal after clear');
      assert.equal(draw.isRevealing(), false);
      assert.equal(core.state.songs.length, 0);
    } finally {
      draw.resetTimerFns();
      core.state.songs = [];
      core.state.history = [];
      core.state.current = null;
      core.state.spinning = false;
    }
  });

  it('RED: resetAll path cancels an in-flight reveal (board stays reset)', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    const app = require('../js/app.js');
    const fake = makeFakeTimers();
    draw.setTimerFns(fake);
    try {
      core.state.songs = [{ id: 's1', title: 'A', artist: 'X', status: 'available' }];
      core.state.history = [];
      core.state.current = null;
      core.state.spinning = false;
      draw.pickAndCommit(0);
      let fired = 0;
      draw.scheduleReveal(() => { fired++; });
      app.handleResetAll();
      fake.fireAll();
      assert.equal(fired, 0, 'no ghost reveal after reset');
      assert.equal(draw.isRevealing(), false);
      assert.equal(core.state.spinning, false);
    } finally {
      draw.resetTimerFns();
      core.state.songs = [];
      core.state.history = [];
      core.state.current = null;
      core.state.spinning = false;
    }
  });
}); // end c-03 2.1

describe('c-03 2.3: spinning guard blocks draw and confirm', () => {
  it('double draw while spinning returns null and leaves state unchanged', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    core.state.songs = [
      { id: 's1', title: 'A', artist: 'X', status: 'available' },
      { id: 's2', title: 'B', artist: 'Y', status: 'available' },
    ];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    try {
      const first = draw.pickAndCommit(0);
      assert.ok(first, 'first commit succeeds');
      const historyN = core.state.history.length;
      const currentId = core.state.current.id;
      assert.equal(draw.pickAndCommit(1), null, 'second draw mid-spin blocked');
      assert.equal(draw.pickAndCommit(), null, 'second draw mid-spin blocked (secure path too)');
      assert.equal(core.state.history.length, historyN, 'history unchanged');
      assert.equal(core.state.current.id, currentId, 'current unchanged');
      assert.equal(core.state.spinning, true, 'still spinning until reveal');
    } finally {
      core.state.songs = [];
      core.state.history = [];
      core.state.current = null;
      core.state.spinning = false;
    }
  });

  it('confirm (played/void) while spinning has no effect until reveal completes', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    const app = require('../js/app.js');
    core.state.songs = [{ id: 's1', title: 'A', artist: 'X', status: 'available' }];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    try {
      draw.pickAndCommit(0);
      assert.equal(core.state.spinning, true);
      app.setCurrentStatus('played');
      assert.equal(core.state.current && core.state.current.status, 'drawn', 'played blocked mid-spin');
      assert.equal(core.state.history[0].status, 'drawn', 'history untouched mid-spin');
      app.setCurrentStatus('void');
      assert.equal(core.state.current && core.state.current.status, 'drawn', 'void blocked mid-spin');
      draw.finishCommit(); // reveal completes
      app.setCurrentStatus('played');
      assert.equal(core.state.current, null, 'confirm works after reveal');
      assert.equal(core.state.history[0].status, 'played');
    } finally {
      core.state.songs = [];
      core.state.history = [];
      core.state.current = null;
      core.state.spinning = false;
    }
  });

  it('forcedIndex seam is test-only: production call sites pass no argument', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    const code = appSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const calls = code.match(/pickAndCommit\(([^)]*)\)/g) || [];
    assert.ok(calls.length >= 1, 'at least one production pickAndCommit call site');
    for (const c of calls) assert.ok(/pickAndCommit\(\s*\)/.test(c), 'no argument passed: ' + c);
  });

  it('spin base is a single named constant, no divergent 2750 literal on the app path', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const draw = require('../js/draw.js');
    assert.equal(draw.SPIN_MS, 2750);
    const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    const appCode = appSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/2750/.test(appCode), 'no hardcoded 2750 in app.js (uses SPIN_MS via scheduleReveal)');
    assert.ok(!/window\.setTimeout/.test(appCode), 'no anonymous window.setTimeout left on the draw path');
    assert.ok(/scheduleReveal\(/.test(appCode), 'reveal goes through scheduleReveal');
  });
}); // end c-03 2.3

// ---- c-07 helpers (fresh-state reset + in-memory storage seam) ----
function c07Reset(core, songs) {
  core.state.songs = songs;
  core.state.history = [];
  core.state.current = null;
  core.state.spinning = false;
  core.state.locked = false;
}

function c07MemStorage() {
  var m = {};
  return {
    setItem: function (k, v) { m[k] = String(v); },
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    removeItem: function (k) { delete m[k]; }
  };
}

function c07TwelveSongs() {
  var out = [];
  for (var i = 1; i <= 12; i++) {
    var n = String(i).padStart(2, '0');
    out.push({ id: 'c07-s' + n, title: 'Tema ' + n, artist: 'Artista ' + n, status: 'available' });
  }
  return out;
}

describe('c-07 1.1: draw without replacement over full catalog (N=12, secure path)', () => {
  it('12 secure draws give 12 unique ids, available() empty, history n=1..12 monotonic', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    c07Reset(core, c07TwelveSongs());
    try {
      const seen = new Set();
      for (let k = 0; k < 12; k++) {
        const picked = draw.pickAndCommit();
        assert.ok(picked, 'draw ' + (k + 1) + ' picks a song');
        seen.add(picked.id);
        draw.finishCommit();
      }
      assert.equal(seen.size, 12, 'no id appears twice');
      assert.equal(core.available().length, 0, 'pool exhausted');
      assert.equal(core.state.history.length, 12);
      for (let i = 0; i < 12; i++) assert.equal(core.state.history[i].n, i + 1, 'monotonic n at ' + i);
      for (const h of core.state.history) assert.equal(h.status, 'drawn');
    } finally {
      c07Reset(core, []);
    }
  });

  it('drawn song leaves the eligible pool for later draws', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    c07Reset(core, [
      { id: 'c07-a1', title: 'Alfa', artist: 'A1', status: 'available' },
      { id: 'c07-b2', title: 'Beta', artist: 'B2', status: 'available' },
      { id: 'c07-c3', title: 'Gamma', artist: 'C3', status: 'available' },
    ]);
    try {
      const first = draw.pickAndCommit(0);
      assert.ok(first);
      const firstId = first.id;
      draw.finishCommit();
      const poolIds = core.available().map((s) => s.id);
      assert.ok(!poolIds.includes(firstId), 'committed song not eligible again');
      assert.equal(poolIds.length, 2);
    } finally {
      c07Reset(core, []);
    }
  });
});

describe('c-07 1.3: edges (0 -> null, 1 deterministic, exhausted copy)', () => {
  it('0 eligible -> null with no history/current/locked mutation', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    c07Reset(core, []);
    try {
      assert.equal(draw.pickAndCommit(0), null);
      assert.equal(draw.pickAndCommit(), null);
      assert.equal(core.state.history.length, 0);
      assert.equal(core.state.current, null);
      assert.equal(core.state.locked, false);
    } finally {
      c07Reset(core, []);
    }
  });

  it('1 eligible -> deterministic literal pick via secure path', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    c07Reset(core, [{ id: 'c07-only', title: 'Unica', artist: 'Solo', status: 'available' }]);
    try {
      const picked = draw.pickAndCommit();
      assert.ok(picked);
      assert.equal(picked.id, 'c07-only');
      assert.equal(picked.title, 'Unica');
    } finally {
      c07Reset(core, []);
    }
  });

  it('exhausted catalog -> null + app.js disabled + No quedan canciones disponibles copy', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    const fs = require('node:fs');
    const path = require('node:path');
    c07Reset(core, [
      { id: 'c07-e1', title: 'Euno', artist: 'EA', status: 'drawn' },
      { id: 'c07-e2', title: 'Edos', artist: 'EB', status: 'played' },
      { id: 'c07-e3', title: 'Etres', artist: 'EC', status: 'void' },
    ]);
    try {
      assert.equal(core.available().length, 0);
      assert.equal(draw.pickAndCommit(), null);
      assert.equal(core.state.history.length, 0);
      const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
      assert.ok(appSrc.includes('No quedan canciones disponibles'), 'exhausted copy frozen');
      assert.ok(appSrc.includes('Esperando listado de canciones'), 'empty copy branch kept');
      assert.ok(/drawBtn.*disabled.*!av\.length \|\| .*spinning/.test(appSrc.replace(/\/\*[\s\S]*?\*\//g, '')), 'drawBtn disabled on empty/exhausted');
    } finally {
      c07Reset(core, []);
    }
  });
});

describe('c-07 2.1: first-draw lock activation + import-reject round-trip', () => {
  it('first pickAndCommit sets locked=true and second draw keeps it true', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    c07Reset(core, [
      { id: 'c07-l1', title: 'Lock Uno', artist: 'LA', status: 'available' },
      { id: 'c07-l2', title: 'Lock Dos', artist: 'LB', status: 'available' },
    ]);
    try {
      assert.equal(core.state.locked, false);
      const first = draw.pickAndCommit(0);
      assert.ok(first);
      assert.equal(core.state.locked, true, 'lock activates on first commit');
      draw.finishCommit();
      const second = draw.pickAndCommit(0);
      assert.ok(second);
      assert.equal(core.state.locked, true, 'lock stays true');
    } finally {
      c07Reset(core, []);
    }
  });

  it('locked survives a simulated C-06 save/load round-trip', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    const store = require('../js/store.js');
    c07Reset(core, [
      { id: 'c07-p1', title: 'Pers Uno', artist: 'PA', status: 'available' },
      { id: 'c07-p2', title: 'Pers Dos', artist: 'PB', status: 'available' },
    ]);
    const mem = c07MemStorage();
    try {
      draw.pickAndCommit(0);
      assert.equal(core.state.locked, true);
      const saved = store.save({
        songs: core.state.songs,
        history: core.state.history,
        current: core.state.current,
        locked: core.state.locked,
        startedAt: core.state.startedAt
      }, mem);
      assert.equal(saved.ok, true);
      const loaded = store.load(mem);
      assert.equal(loaded.ok, true);
      assert.equal(loaded.snapshot.locked, true, 'locked persists through autosave');
    } finally {
      c07Reset(core, []);
    }
  });

  it('draw -> import-reject round-trip through the real C-04 guard (verbatim + unchanged)', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    const app = require('../js/app.js');
    c07Reset(core, [
      { id: 'c07-r1', title: 'Round Uno', artist: 'RA', status: 'available' },
      { id: 'c07-r2', title: 'Round Dos', artist: 'RB', status: 'available' },
    ]);
    try {
      draw.pickAndCommit(0);
      assert.equal(app.isImportBlocked(), true);
      const before = core.state.songs.length;
      const res = app.guardedImport([{ title: 'Intruso', artist: 'X', status: 'available' }], 'texto');
      assert.equal(res.blocked, true);
      assert.equal(res.added, 0);
      assert.equal(res.duplicates, 0);
      assert.equal(res.message, app.BLOCKED_MESSAGE);
      assert.equal(res.message, 'Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.');
      assert.equal(core.state.songs.length, before, 'catalog unchanged');
    } finally {
      c07Reset(core, []);
    }
  });
});

describe('c-07 3.1: commit-before-reveal ordering (timer seam)', () => {
  it('commit exists synchronously after pickAndCommit, before any scheduleReveal callback', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    c07Reset(core, [
      { id: 'c07-t1', title: 'Tiempo Uno', artist: 'TA', status: 'available' },
      { id: 'c07-t2', title: 'Tiempo Dos', artist: 'TB', status: 'available' },
    ]);
    const fake = makeFakeTimers();
    draw.setTimerFns(fake);
    try {
      const picked = draw.pickAndCommit(0);
      assert.ok(picked);
      // Synchronous commit assertions BEFORE any reveal callback fires:
      assert.equal(picked.status, 'drawn');
      assert.ok(core.state.current, 'current set synchronously');
      assert.equal(core.state.current.id, picked.id);
      assert.equal(core.state.history.length, 1);
      assert.equal(core.state.history[0].status, 'drawn');
      assert.equal(core.state.history[0].id, picked.id);
      let fired = 0;
      draw.scheduleReveal(() => { fired++; });
      assert.equal(fired, 0, 'reveal not yet fired');
      assert.equal(draw.isRevealing(), true);
      fake.fireAll();
      assert.equal(fired, 1, 'reveal fires only via timer');
    } finally {
      draw.resetTimerFns();
      draw.cancelReveal();
      c07Reset(core, []);
    }
  });
});

describe('c-07 3.3: mid-spin UI lock', () => {
  it('second pickAndCommit mid-spin -> null + unchanged state (incl. locked)', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    c07Reset(core, [
      { id: 'c07-m1', title: 'Mid Uno', artist: 'MA', status: 'available' },
      { id: 'c07-m2', title: 'Mid Dos', artist: 'MB', status: 'available' },
    ]);
    try {
      const first = draw.pickAndCommit(0);
      assert.ok(first);
      const n = core.state.history.length;
      const curId = core.state.current.id;
      const lockedNow = core.state.locked;
      assert.equal(draw.pickAndCommit(1), null);
      assert.equal(draw.pickAndCommit(), null);
      assert.equal(core.state.history.length, n);
      assert.equal(core.state.current.id, curId);
      assert.equal(core.state.locked, lockedNow);
      assert.equal(core.state.spinning, true);
    } finally {
      c07Reset(core, []);
    }
  });

  it('setCurrentStatus blocked mid-spin; app.js keeps SORTEANDO texts + button disables + no-arg call site', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    const app = require('../js/app.js');
    const fs = require('node:fs');
    const path = require('node:path');
    c07Reset(core, [{ id: 'c07-s1', title: 'Spin Uno', artist: 'SA', status: 'available' }]);
    try {
      draw.pickAndCommit(0);
      app.setCurrentStatus('played');
      assert.equal(core.state.current && core.state.current.status, 'drawn');
      app.setCurrentStatus('void');
      assert.equal(core.state.current && core.state.current.status, 'drawn');
      const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
      const code = appSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      assert.ok(appSrc.includes('SORTEANDO'), 'wheel SORTEANDO text kept');
      assert.ok(appSrc.includes('La ruleta está girando'), 'heading explains result already chosen');
      assert.ok(/drawBtn.*disabled\s*=\s*true/.test(code), 'drawBtn disabled mid-spin');
      assert.ok(/confirmBtn.*disabled\s*=\s*true/.test(code), 'confirmBtn disabled mid-spin');
      const calls = code.match(/pickAndCommit\(([^)]*)\)/g) || [];
      assert.ok(calls.length >= 1);
      for (const c of calls) assert.ok(/pickAndCommit\(\s*\)/.test(c), 'production call passes no argument: ' + c);
    } finally {
      c07Reset(core, []);
    }
  });
}); // end c-07
