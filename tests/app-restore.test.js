const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function freshStorage() {
  let slot = null;
  return {
    getItem() { return slot; },
    setItem(k, v) { slot = String(v); },
    removeItem() { slot = null; },
  };
}

describe('c-06 2.1 RED: app boot restore + banner + discard + corrupt', () => {
  let core;
  let app;
  let saved;

  beforeEach(() => {
    for (const f of ['core.js', 'store.js', 'app.js']) {
      delete require.cache[require.resolve(path.join('..', 'js', f))];
    }
    core = require('../js/core.js');
    app = require('../js/app.js');
    saved = JSON.parse(JSON.stringify({ songs: core.state.songs, history: core.state.history, current: core.state.current, spinning: core.state.spinning, locked: core.state.locked, startedAt: core.state.startedAt }));
  });

  afterEach(() => {
    core.state.songs = saved.songs;
    core.state.history = saved.history;
    core.state.current = saved.current;
    core.state.spinning = saved.spinning;
    core.state.locked = saved.locked;
    core.state.startedAt = saved.startedAt;
  });

  it('should hydrate on boot and report the mandatory recovery banner verbatim', () => {
    // Arrange: a stored day-1 snapshot with independent literals
    const store = require('../js/store.js');
    const storage = freshStorage();
    store.save({
      songs: [
        { id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
        { id: 's2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available' },
      ],
      history: [{ n: 1, id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '21:15:03' }],
      current: { id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
      locked: true,
      startedAt: '2026-10-01T20:00:00.000Z',
    }, storage);
    core.state.songs = [];
    core.state.history = [];
    core.state.current = null;
    core.state.locked = false;
    // Act
    const out = app.bootRestore(storage);
    // Assert: full hydrate, never partial
    assert.equal(out.status, 'restored');
    assert.equal(core.state.songs.length, 2);
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.current.title, 'Matador');
    assert.equal(core.state.locked, true);
    assert.equal(core.state.spinning, false);
    assert.ok(out.banner.startsWith('Partida recuperada del '), 'banner prefix verbatim');
    assert.ok(out.banner.includes('verificá historial antes de seguir'), 'banner suffix verbatim');
  });

  it('should clear storage and reset state only after confirm() on discard', () => {
    // Arrange
    const store = require('../js/store.js');
    const storage = freshStorage();
    store.save({ songs: [{ id: 's1', title: 'Matador', artist: 'X', status: 'available' }], history: [], current: null, locked: true, startedAt: '2026-10-01T20:00:00.000Z' }, storage);
    app.bootRestore(storage);
    // Act: cancel keeps the game
    assert.equal(app.discardSession(storage, () => false), false);
    assert.equal(core.state.songs.length, 1);
    // Act: confirm resets to empty unlocked + clears storage
    assert.equal(app.discardSession(storage, () => true), true);
    // Assert
    assert.deepEqual(core.state.songs, []);
    assert.deepEqual(core.state.history, []);
    assert.equal(core.state.current, null);
    assert.equal(core.state.locked, false);
    assert.equal(store.load(storage).reason, 'empty');
  });

  it('should boot empty with the corrupt message when payload is damaged', () => {
    // Arrange
    const storage = freshStorage();
    storage.setItem('mbdj.v1', '{"songs":[{');
    // Act
    const out = app.bootRestore(storage);
    // Assert: never partial, never crash
    assert.equal(out.status, 'corrupt');
    assert.equal(out.banner, 'Respaldo dañado — se inició vacío, revisá el CSV exportado');
    assert.deepEqual(core.state.songs, []);
    assert.deepEqual(core.state.history, []);
    assert.equal(core.state.current, null);
  });
});

describe('c-06 2.3 GREEN: beforeunload off exportedAt + no-storage playable', () => {
  let core;
  let app;

  beforeEach(() => {
    for (const f of ['core.js', 'store.js', 'app.js']) {
      delete require.cache[require.resolve(path.join('..', 'js', f))];
    }
    core = require('../js/core.js');
    app = require('../js/app.js');
    core.state.songs = [];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    core.state.locked = false;
  });

  it('should warn on close only when history is newer than the last export', () => {
    // Arrange: fresh session, no history -> silent
    assert.equal(app.needsUnloadWarning(), false);
    // Arrange: one draw, never exported -> warns
    core.state.history = [{ n: 1, id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '21:15:03' }];
    assert.equal(app.needsUnloadWarning(), true);
    // Act: export clears the guard
    app.markExported();
    // Assert: just-exported session closes silently
    assert.equal(app.needsUnloadWarning(), false);
    // Arrange: a newer draw after export -> warns again
    core.state.history.push({ n: 2, id: 's2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'drawn', time: '21:16:00' });
    assert.equal(app.needsUnloadWarning(), true);
  });

  it('should expose a beforeunload handler that fires only with unexported history', () => {
    // Arrange
    core.state.history = [];
    // Act + Assert: empty -> no prompt
    assert.equal(app.beforeUnloadHandler({}), undefined);
    // Arrange: unexported draw
    core.state.history = [{ n: 1, id: 's1', title: 'Matador', artist: 'X', status: 'drawn', time: '21:15:03' }];
    // Act
    const evt = {};
    const out = app.beforeUnloadHandler(evt);
    // Assert: browser prompt armed
    assert.equal(out, '');
    assert.equal(evt.returnValue, '');
  });

  it('should warn on no-storage boot but keep the in-memory game playable', () => {
    // Arrange: throwing private-mode storage, live in-memory game
    const throwing = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    core.state.songs = [{ id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available' }];
    // Act
    const out = app.bootRestore(throwing);
    // Assert: loud warning, state untouched, save reports unavailable
    assert.equal(out.status, 'no-storage');
    assert.ok(out.banner.includes('no sobrevivirá'), 'warning states reload will not survive');
    assert.equal(core.state.songs.length, 1);
    assert.equal(app.persistCurrentState(throwing).ok, false);
  });
});
