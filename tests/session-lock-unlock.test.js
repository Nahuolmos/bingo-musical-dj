const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');

// C-11 session-lock: the missing writer. Admin unlock seam mirrors
// handleVoidRequest (injected prompt/confirm boundaries, guard-first).

function loadDeps() {
  const core = require(path.join(root, 'js', 'core.js'));
  const draw = require(path.join(root, 'js', 'draw.js'));
  const store = require(path.join(root, 'js', 'store.js'));
  const app = require(path.join(root, 'js', 'app.js'));
  return { core, draw, store, app };
}

function seedSongs(core) {
  core.state.songs = [
    { id: 'u-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' },
    { id: 'u-s2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' }
  ];
  core.state.history = [];
  core.state.current = null;
  core.state.spinning = false;
  core.state.locked = false;
}

function resetState(core) {
  core.state.songs = [];
  core.state.history = [];
  core.state.current = null;
  core.state.spinning = false;
  core.state.locked = false;
}

function teardown(draw, app, core) {
  if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
  if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
  resetState(core);
}

function stubDocument() {
  const els = {};
  function el(id) {
    if (!els[id]) {
      els[id] = {
        textContent: '', innerHTML: '', value: '', disabled: false, offsetWidth: 0,
        classList: { add() {}, remove() {} }
      };
    }
    return els[id];
  }
  return { getElementById: el, _els: els };
}

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
    }
  };
}

// ---- 1.1: unlock gate order (locked? -> prompt -> trim/empty -> confirm x2 -> commit) ----
describe('c-11 1.1: handleUnlockRequest refuses without motivo or confirmations', () => {
  let core;
  let draw;
  let store;
  let app;

  beforeEach(() => {
    ({ core, draw, store, app } = loadDeps());
    seedSongs(core);
    core.state.locked = true;
  });

  afterEach(() => { teardown(draw, app, core); });

  it('empty-string motivo is blocked (locked stays true, history unchanged, no confirm)', () => {
    // Arrange
    let confirms = 0;
    const historyBefore = JSON.stringify(core.state.history);
    // Act
    const ret = app.handleUnlockRequest(() => '', () => { confirms += 1; return true; });
    // Assert
    assert.equal(ret, false);
    assert.equal(core.state.locked, true);
    assert.equal(JSON.stringify(core.state.history), historyBefore);
    assert.equal(confirms, 0, 'no confirm may fire before a valid motivo');
  });

  it('whitespace-only motivo is blocked (triangulate)', () => {
    // Arrange
    let confirms = 0;
    // Act
    const ret = app.handleUnlockRequest(() => '   ', () => { confirms += 1; return true; });
    // Assert
    assert.equal(ret, false);
    assert.equal(core.state.locked, true);
    assert.equal(core.state.history.length, 0);
    assert.equal(confirms, 0);
  });

  it('cancelled prompt aborts with zero mutation', () => {
    // Arrange
    let confirms = 0;
    const songsBefore = JSON.stringify(core.state.songs);
    // Act
    const ret = app.handleUnlockRequest(() => null, () => { confirms += 1; return true; });
    // Assert
    assert.equal(ret, false);
    assert.equal(core.state.locked, true);
    assert.equal(JSON.stringify(core.state.songs), songsBefore);
    assert.equal(core.state.history.length, 0);
    assert.equal(confirms, 0);
  });

  it('declined FIRST confirm aborts with zero mutation (second confirm never fires)', () => {
    // Arrange
    const seen = [];
    // Act
    const ret = app.handleUnlockRequest(
      () => 'Autorizado por organizador',
      (msg) => { seen.push(String(msg)); return false; }
    );
    // Assert
    assert.equal(ret, false);
    assert.equal(core.state.locked, true);
    assert.equal(core.state.history.length, 0);
    assert.equal(seen.length, 1, 'abort on first decline, got: ' + JSON.stringify(seen));
  });

  it('declined SECOND confirm aborts with zero mutation (triangulate)', () => {
    // Arrange
    let calls = 0;
    // Act
    const ret = app.handleUnlockRequest(
      () => 'Autorizado por organizador',
      () => { calls += 1; return calls < 2; }
    );
    // Assert
    assert.equal(ret, false);
    assert.equal(core.state.locked, true);
    assert.equal(core.state.history.length, 0);
    assert.equal(calls, 2, 'both confirms offered, second declined');
  });

  it('unlock on an already-unlocked session is a no-op (prompt never fires)', () => {
    // Arrange
    core.state.locked = false;
    // Act
    const ret = app.handleUnlockRequest(
      () => { throw new Error('prompt must not fire when already unlocked'); },
      () => { throw new Error('confirm must not fire when already unlocked'); }
    );
    // Assert
    assert.equal(ret, false);
    assert.equal(core.state.locked, false);
    assert.equal(core.state.history.length, 0);
  });
});

// ---- 2.1: valid motivo + double confirm commits (song-less audit entry) ----
describe('c-11 2.1: valid motivo plus double confirm unlocks with an audit entry', () => {
  let core;
  let draw;
  let store;
  let app;

  beforeEach(() => {
    ({ core, draw, store, app } = loadDeps());
    seedSongs(core);
    core.state.locked = true;
  });

  afterEach(() => { teardown(draw, app, core); });

  it('commits locked=false plus exactly one song-less entry with next n + trimmed motivo', () => {
    // Arrange
    const seen = [];
    // Act
    const ret = app.handleUnlockRequest(
      () => '  Autorizado por organizador  ',
      (msg) => { seen.push(String(msg)); return true; }
    );
    // Assert
    assert.equal(ret, true);
    assert.equal(core.state.locked, false);
    assert.equal(core.state.history.length, 1);
    const h = core.state.history[0];
    assert.equal(h.n, 1);
    assert.equal(h.title, 'Desbloqueo administrativo');
    assert.equal(h.artist, '');
    assert.equal(h.status, 'unlock');
    assert.equal(h.motivo, 'Autorizado por organizador');
    assert.match(h.time, /^\d{2}:\d{2}:\d{2}$/, 'es-AR HH:MM:SS, got: ' + h.time);
    assert.ok(typeof h.id === 'string' && h.id.indexOf('unlock-') === 0, 'unlock- prefixed id, got: ' + h.id);
    assert.equal(seen.length, 2, 'double confirm, got: ' + JSON.stringify(seen));
    assert.ok(seen[1].indexOf('editable') !== -1, 'second confirm names the consequence, got: ' + seen[1]);
  });

  it('entry keeps monotonic n after existing draws (triangulate)', () => {
    // Arrange: one committed draw (n=1, locked via the real commit path)
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    assert.equal(core.state.history.length, 1);
    // Act
    const ret = app.handleUnlockRequest(() => 'R', () => true);
    // Assert
    assert.equal(ret, true);
    assert.equal(core.state.locked, false);
    assert.equal(core.state.history.length, 2);
    assert.deepEqual(core.state.history.map((h) => h.n), [1, 2]);
  });

  it('unlock motivo renders inert in the operator history (escaped, no live tag)', () => {
    // Arrange
    const doc = stubDocument();
    globalThis.document = doc;
    const evil = "<script>alert('x')</scr" + 'ipt>';
    let ret;
    try {
      ret = app.handleUnlockRequest(() => evil, () => true);
      assert.equal(ret, true);
      app.render();
    } finally {
      delete globalThis.document;
    }
    // Assert
    const html = doc._els.historyList.innerHTML;
    assert.ok(!html.includes('<script>'), 'history escaped, got: ' + html);
    assert.ok(html.includes('&lt;script&gt;'), 'history entity present');
    assert.ok(html.includes('unlock'), 'visible unlock state, got: ' + html);
  });

  it('unlock entry survives a bootRestore round-trip (locked=false, motivo intact)', () => {
    // Arrange
    assert.equal(app.handleUnlockRequest(() => 'Noche 1 cerrada', () => true), true);
    let slot = null;
    const mem = {
      getItem: () => slot,
      setItem: (k, v) => { slot = String(v); },
      removeItem: () => { slot = null; }
    };
    assert.equal(store.save(
      { songs: core.state.songs, history: core.state.history, current: core.state.current, locked: core.state.locked, startedAt: '2026-10-01T20:00:00.000Z' },
      mem
    ).ok, true);
    resetState(core);
    // Act
    const boot = app.bootRestore(mem);
    // Assert
    assert.equal(boot.status, 'restored');
    assert.equal(core.state.locked, false);
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].motivo, 'Noche 1 cerrada');
    assert.equal(core.state.history[0].status, 'unlock');
  });

  it('unlock entry exports in the 6-col CSV Motivo column with sanitization', () => {
    // Arrange
    assert.equal(app.handleUnlockRequest(() => '=CMD riesgo', () => true), true);
    // Act
    const csv = app.buildCsv(core.state.history);
    // Assert: header + 1 row, motivo neutralized as text inside quotes
    const lines = csv.slice(1).split('\r\n');
    assert.equal(lines.length, 2, 'header + exactly one data row, got: ' + JSON.stringify(lines));
    assert.ok(lines[1].indexOf('"unlock"') !== -1, 'unlock state in Estado column, got: ' + lines[1]);
    assert.ok(lines[1].endsWith(',"\'=CMD riesgo"'), 'sanitized motivo trailing, got: ' + lines[1]);
  });
});

// ---- 2.1 factory shape (core seam, no schema bump) ----
describe('c-11 2.1: createUnlockEntry factory fits HistoryEntry + motivo', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    seedSongs(core);
  });

  afterEach(() => { const d = draw; teardown(d, app, core); });

  it('builds a song-less entry with unlock- id, visible state, motivo, HH:MM:SS', () => {
    // Arrange + Act
    const e = core.createUnlockEntry(3, 'Autorizado');
    // Assert: independent literals — fits the C-10 tolerant render/CSV contract
    assert.equal(e.n, 3);
    assert.equal(e.title, 'Desbloqueo administrativo');
    assert.equal(e.artist, '');
    assert.equal(e.status, 'unlock');
    assert.equal(e.motivo, 'Autorizado');
    assert.match(e.time, /^\d{2}:\d{2}:\d{2}$/);
    assert.ok(e.id.indexOf('unlock-') === 0, 'unlock- prefix, got: ' + e.id);
  });

  it('ids are unique across calls (triangulate — never collides with a song id)', () => {
    // Arrange + Act
    const a = core.createUnlockEntry(1, 'x');
    const b = core.createUnlockEntry(2, 'x');
    // Assert
    assert.ok(a.id !== b.id, 'unique ids, got: ' + a.id + ' vs ' + b.id);
    assert.ok(a.id.indexOf('s') !== 0 || a.id.indexOf('unlock-') === 0, 'no song-id shape');
  });
});

// ---- 3.1: guard-first refusal never touches timers; unlocked wipes cancel both ----
describe('c-11 3.1: timer-cancellation contract around lock guards', () => {
  let core;
  let draw;
  let store;
  let app;

  beforeEach(() => {
    ({ core, draw, store, app } = loadDeps());
    seedSongs(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('locked clear refusal mid-buffer leaves the reveal handle pending (no timer touch)', () => {
    // Arrange: commit locks; public-buffer reveal scheduled on fake timers
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    assert.equal(core.state.locked, true);
    let reveals = 0;
    app.schedulePublicReveal(() => { reveals += 1; });
    assert.equal(app.isPublicBuffer(), true);
    // Act: refused — guard-first means no confirm, no cancel, no mutation
    const ret = app.handleClearSongs();
    // Assert
    assert.equal(ret, false);
    assert.equal(app.isPublicBuffer(), true, 'refusal must not cancel the in-flight reveal');
    appFake.fireAll();
    assert.equal(reveals, 1, 'pending reveal still fires after a refused clear');
  });

  it('unlocked clear mid-buffer cancels the handle and no delayed callback fires', () => {
    // Arrange: fake timers on the buffer seam, unlocked regime
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    core.state.locked = false;
    let publicReveals = 0;
    app.schedulePublicReveal(() => { publicReveals += 1; });
    // Act
    const ret = app.handleClearSongs();
    // Assert
    assert.equal(ret, true);
    assert.equal(app.isPublicBuffer(), false);
    appFake.fireAll();
    assert.equal(publicReveals, 0, 'no ghost public reveal after clear');
  });

  it('unlocked reset mid-public-buffer cancels the buffer and it never fires', () => {
    // Arrange: public buffer pending, unlocked regime
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    core.state.locked = false;
    let publicReveals = 0;
    app.schedulePublicReveal(() => { publicReveals += 1; });
    assert.equal(app.isPublicBuffer(), true);
    // Act
    const ret = app.handleResetAll();
    // Assert
    assert.equal(ret, true);
    assert.equal(app.isPublicBuffer(), false);
    appFake.fireAll();
    assert.equal(publicReveals, 0, 'buffer reveal cancelled by mid-buffer reset');
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.current, null);
  });
});
