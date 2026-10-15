const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');

// Regression: browser report — after a draw + "Vaciar lista", demo/paste/file
// import ALL do nothing and the list never updates. Mechanism: C-07 sets
// locked=true on first commit and C-06 persists it, but handleClearSongs /
// handleResetAll wipe songs+history WITHOUT resetting locked (and without any
// guard), so the session lands in locked+empty with no C-11 admin unlock yet:
// every import path (all gated by isImportBlocked) refuses forever. RN-SES-01
// + rule 7 require "importar/vaciar bloqueado" while locked; the clear/reset
// handlers never got that guard. Suite stayed green because no test covered
// clear-then-reimport recovery.

function loadDeps() {
  const core = require(path.join(root, 'js', 'core.js'));
  const draw = require(path.join(root, 'js', 'draw.js'));
  const store = require(path.join(root, 'js', 'store.js'));
  const app = require(path.join(root, 'js', 'app.js'));
  return { core, draw, store, app };
}

function seedSongs(core) {
  core.state.songs = [
    { id: 'r-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' },
    { id: 'r-s2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' }
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

describe('regression: locked session refuses clear/reset (no brick into locked+empty)', () => {
  let core;
  let draw;
  let store;
  let app;

  beforeEach(() => {
    ({ core, draw, store, app } = loadDeps());
    seedSongs(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('RED: handleClearSongs while locked returns false with zero mutation (songs/history/current/locked intact)', () => {
    // Arrange: mid-partida — first draw committed, catalog frozen
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    assert.equal(core.state.locked, true);
    const songsBefore = JSON.stringify(core.state.songs);
    const historyBefore = JSON.stringify(core.state.history);
    // Act (Node path: no document — pure seam)
    const ret = app.handleClearSongs();
    // Assert: refusal, nothing wiped, lock untouched
    assert.equal(ret, false);
    assert.equal(JSON.stringify(core.state.songs), songsBefore);
    assert.equal(JSON.stringify(core.state.history), historyBefore);
    assert.ok(core.state.current);
    assert.equal(core.state.locked, true);
  });

  it('RED: handleResetAll while locked returns false with zero mutation', () => {
    // Arrange
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    assert.equal(core.state.locked, true);
    const songsBefore = JSON.stringify(core.state.songs);
    const historyBefore = JSON.stringify(core.state.history);
    // Act
    const ret = app.handleResetAll();
    // Assert
    assert.equal(ret, false);
    assert.equal(JSON.stringify(core.state.songs), songsBefore);
    assert.equal(JSON.stringify(core.state.history), historyBefore);
    assert.ok(core.state.current);
    assert.equal(core.state.locked, true);
  });

  it('RED: locked refusal surfaces BLOCKED_MESSAGE in the DOM path without touching confirm()', () => {
    // Arrange: stub DOM, locked mid-partida, confirm that explodes if called
    const doc = stubDocument();
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    global.document = doc;
    global.confirm = () => { throw new Error('confirm must not fire on a blocked clear'); };
    let ret;
    try {
      ret = app.handleClearSongs();
    } finally {
      delete global.document;
      delete global.confirm;
    }
    // Assert
    assert.equal(ret, false);
    assert.equal(doc._els.importMessage.textContent, app.BLOCKED_MESSAGE);
    assert.equal(core.state.songs.length, 2);
    assert.equal(core.state.locked, true);
  });

  it('unlocked clear still wipes (no over-blocking — triangulate happy path)', () => {
    // Arrange: fresh unlocked catalog, no draw
    assert.equal(core.state.locked, false);
    // Act
    const ret = app.handleClearSongs();
    // Assert
    assert.equal(ret, true);
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.history.length, 0);
    assert.equal(core.state.current, null);
  });

  it('unlocked reset still wipes (no over-blocking — triangulate happy path)', () => {
    // Arrange
    seedSongs(core);
    // Act
    const ret = app.handleResetAll();
    // Assert
    assert.equal(ret, true);
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.locked, false);
  });
});

describe('c-11 1.2: locked session refuses edits, file imports, and mutation controls', () => {
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

  it('edit-with-locked is refused without admin path (prompt never fires, catalog unchanged)', () => {
    // Arrange
    const songsBefore = JSON.stringify(core.state.songs);
    // Act: guard-first refusal — the prompt boundary must not even fire
    const ret = app.handleEditRequest('r-s1', () => { throw new Error('prompt must not fire on a blocked edit'); });
    // Assert
    assert.equal(ret.blocked, true);
    assert.equal(JSON.stringify(core.state.songs), songsBefore);
    assert.equal(core.state.locked, true);
  });

  it('file import is refused while locked (no read, blocked message verbatim)', () => {
    // Arrange: the file-input path shares the guardedImport funnel
    const songsBefore = JSON.stringify(core.state.songs);
    // Act
    const ret = app.guardedImport([{ id: 'x', title: 'T', artist: 'A' }], 'archivo');
    // Assert: verbatim BLOCKED_MESSAGE, zero mutation
    assert.equal(ret.blocked, true);
    assert.equal(ret.message, app.BLOCKED_MESSAGE);
    assert.equal(ret.message, 'Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.');
    assert.equal(JSON.stringify(core.state.songs), songsBefore);
  });

  it('locked render() disables every mutation control and arms the admin unlock', () => {
    // Arrange: stub DOM, locked mid-partida
    const doc = stubDocument();
    global.document = doc;
    try {
      // Act
      app.render();
    } finally {
      delete global.document;
    }
    // Assert: all mutation controls disabled while locked, unlock enabled
    for (const id of ['fileInput', 'pasteToggle', 'parsePaste', 'sampleBtn', 'clearSongs', 'resetAll']) {
      assert.equal(doc._els[id].disabled, true, id + ' disabled while locked');
    }
    assert.equal(doc._els.unlockBtn.disabled, false, 'unlockBtn armed while locked');
    assert.ok(doc._els.songList.innerHTML.indexOf('Editar') !== -1, 'per-row edit affordance renders');
    assert.ok(doc._els.songList.innerHTML.indexOf('disabled') !== -1, 'per-row edit disabled while locked');
  });

  it('unlocked render() re-enables mutation controls and stands down the unlock', () => {
    // Arrange
    core.state.locked = false;
    const doc = stubDocument();
    global.document = doc;
    try {
      // Act
      app.render();
    } finally {
      delete global.document;
    }
    // Assert: triangulate — no over-blocking when unlocked
    for (const id of ['fileInput', 'pasteToggle', 'parsePaste', 'sampleBtn', 'clearSongs', 'resetAll']) {
      assert.equal(doc._els[id].disabled, false, id + ' enabled when unlocked');
    }
    assert.equal(doc._els.unlockBtn.disabled, true, 'unlockBtn stands down when unlocked');
  });

  it('unlocked edit applies title + artist and re-renders (triangulate happy path)', () => {
    // Arrange: unlocked regime (beforeEach locks; stand down here)
    core.state.locked = false;
    // Act
    const ret = app.handleEditRequest('r-s1', (function () {
      const answers = ['Matador (remaster)', 'Los Fabulosos Cadillacs'];
      return function () { return answers.shift(); };
    })());
    // Assert
    assert.equal(ret.ok, true);
    const song = core.state.songs.find((s) => s.id === 'r-s1');
    assert.equal(song.title, 'Matador (remaster)');
    assert.equal(song.artist, 'Los Fabulosos Cadillacs');
  });
});

describe('regression: locked+empty snapshot boots with banner so discard escape is reachable', () => {
  let core;
  let draw;
  let store;
  let app;

  beforeEach(() => {
    ({ core, draw, store, app } = loadDeps());
    resetState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('RED: bootRestore on locked+empty snapshot reports restored with banner (not empty)', () => {
    // Arrange: the bricked snapshot — cleared while locked, persisted by autosave
    let slot = null;
    const mem = {
      getItem: () => slot,
      setItem: (k, v) => { slot = String(v); },
      removeItem: () => { slot = null; }
    };
    const saved = store.save(
      { songs: [], history: [], current: null, locked: true, startedAt: '2026-10-01T20:00:00.000Z' },
      mem
    );
    assert.equal(saved.ok, true);
    // Act
    const boot = app.bootRestore(mem);
    // Assert: operator sees recovery state + discard path instead of silent fresh
    assert.equal(boot.status, 'restored');
    assert.ok(boot.banner && boot.banner.indexOf('Partida recuperada del ') === 0);
    assert.equal(core.state.locked, true);
  });

  it('unlocked empty snapshot still boots empty with no banner (triangulate — no over-reporting)', () => {
    // Arrange
    let slot = null;
    const mem = {
      getItem: () => slot,
      setItem: (k, v) => { slot = String(v); },
      removeItem: () => { slot = null; }
    };
    assert.equal(store.save(
      { songs: [], history: [], current: null, locked: false, startedAt: '2026-10-01T20:00:00.000Z' },
      mem
    ).ok, true);
    // Act
    const boot = app.bootRestore(mem);
    // Assert
    assert.equal(boot.status, 'empty');
    assert.equal(boot.banner, null);
    assert.equal(core.state.locked, false);
  });

  it('discard escape unlocks the bricked session so demo AND paste imports work again', () => {
    // Arrange: bricked in-memory state (locked, empty) as bootRestore would leave it
    core.state.locked = true;
    assert.equal(app.isImportBlocked(), true);
    assert.equal(app.handleDemoImport().blocked, true);
    assert.equal(core.state.songs.length, 0);
    // Act: operator confirms "Descartar y empezar de cero"
    const discarded = app.discardSession(undefined, () => true);
    assert.equal(discarded, true);
    const demo = app.handleDemoImport();
    const paste = app.handlePasteImport('Shakira - Hips Don\'t Lie');
    // Assert: both import paths grow the list again
    assert.equal(demo.added, 12);
    assert.equal(paste.added, 1);
    assert.equal(core.state.songs.length, 13);
    assert.equal(core.state.locked, false);
  });
});
