const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

function freshStorage() {
  let slot = null;
  return {
    _slot() { return slot; },
    getItem() { return slot; },
    setItem(k, v) { slot = String(v); },
    removeItem() { slot = null; },
  };
}

describe('c-06 1.1 RED: store save/restore round-trip + corrupt + no-storage', () => {
  let store;
  let storage;

  beforeEach(() => {
    delete require.cache[require.resolve('../js/store.js')];
    store = require('../js/store.js');
    storage = freshStorage();
  });

  it('should round-trip 2 songs + 1 history entry + current + locked:true + startedAt', () => {
    // Arrange: independent literals (never recomputed by the code)
    const snapshot = {
      songs: [
        { id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
        { id: 's2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available' },
      ],
      history: [{ n: 1, id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '21:15:03' }],
      current: { id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
      locked: true,
      startedAt: '2026-10-01T20:00:00.000Z',
    };
    // Act
    const res = store.save(snapshot, storage);
    const back = store.load(storage);
    // Assert
    assert.equal(res.ok, true);
    assert.equal(back.ok, true);
    assert.deepEqual(back.snapshot.songs, snapshot.songs);
    assert.deepEqual(back.snapshot.history, snapshot.history);
    assert.deepEqual(back.snapshot.current, snapshot.current);
    assert.equal(back.snapshot.locked, true);
    assert.equal(back.snapshot.startedAt, '2026-10-01T20:00:00.000Z');
    assert.equal(back.snapshot.schemaVersion, 1);
    assert.equal(typeof back.snapshot.savedAt, 'string');
  });

  it('should fall back to corrupt (not throw) when payload is truncated JSON', () => {
    // Arrange
    storage.setItem('mbdj.v1', '{"songs":[{');
    // Act + Assert
    const back = store.load(storage);
    assert.equal(back.ok, false);
    assert.equal(back.reason, 'corrupt');
  });

  it('should warn (not throw) when storage is unavailable', () => {
    // Arrange: private-mode double that throws on every op
    const throwing = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    // Act + Assert
    assert.equal(store.isAvailable(throwing), false);
    const res = store.save({ songs: [] }, throwing);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unavailable');
    const back = store.load(throwing);
    assert.equal(back.ok, false);
    assert.equal(back.reason, 'unavailable');
  });
});

describe('c-06 1.3 TRIANGULATE: store edge cases', () => {
  let store;
  let storage;

  beforeEach(() => {
    delete require.cache[require.resolve('../js/store.js')];
    store = require('../js/store.js');
    storage = freshStorage();
  });

  it('should round-trip an empty session (no songs, no history, unlocked)', () => {
    // Arrange
    const snapshot = { songs: [], history: [], current: null, locked: false, startedAt: '2026-10-02T19:00:00.000Z' };
    // Act
    assert.equal(store.save(snapshot, storage).ok, true);
    const back = store.load(storage);
    // Assert
    assert.equal(back.ok, true);
    assert.deepEqual(back.snapshot.songs, []);
    assert.deepEqual(back.snapshot.history, []);
    assert.equal(back.snapshot.current, null);
    assert.equal(back.snapshot.locked, false);
  });

  it('should take the corrupt path on unknown schemaVersion (no migration)', () => {
    // Arrange
    storage.setItem('mbdj.v1', JSON.stringify({ songs: [], history: [], current: null, locked: false, startedAt: 'x', savedAt: 'y', schemaVersion: 99 }));
    // Act
    const back = store.load(storage);
    // Assert
    assert.equal(back.ok, false);
    assert.equal(back.reason, 'corrupt');
  });

  it('should return empty (not throw) when nothing was ever saved', () => {
    // Arrange: fresh storage, no setItem
    // Act
    const back = store.load(storage);
    // Assert
    assert.equal(back.ok, false);
    assert.equal(back.reason, 'empty');
  });

  it('should never persist spinning as true (transient-only)', () => {
    // Arrange
    const snapshot = { songs: [], history: [], current: null, locked: false, startedAt: '2026-10-02T19:00:00.000Z', spinning: true };
    // Act
    store.save(snapshot, storage);
    const raw = storage._slot();
    const back = store.load(storage);
    // Assert
    assert.ok(!raw.includes('"spinning":true'), 'raw payload must not carry spinning:true');
    assert.equal(back.ok, true);
    assert.equal(back.snapshot.spinning, false);
  });

  it('should keep classic-script load order (Node require + browser global)', () => {
    // Arrange + Act
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'store.js'), 'utf8');
    // Assert
    assert.equal(typeof store.save, 'function');
    assert.equal(typeof store.load, 'function');
    assert.equal(typeof store.clear, 'function');
    assert.equal(typeof store.isAvailable, 'function');
    assert.equal(store.KEY, 'mbdj.v1');
    assert.equal(store.SCHEMA_VERSION, 1);
    assert.ok(src.includes('MBDJ.store'), 'browser global intact');
  });
});
