const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('c-02 task 3.1/3.2/3.3: views, monotonic n, pure helpers', () => {
  let core;
  beforeEach(() => {
    delete require.cache[require.resolve('../js/core.js')];
    core = require('../js/core.js');
  });

  function song(id, status) {
    return { id: id, title: 'T', artist: 'A', status: status, addedAt: new Date().toISOString() };
  }

  it('3.1 views: 2 available / 1 drawn / 1 played / 1 void => total 5, remaining 2, drawn 3', () => {
    const session = core.createSession();
    session.songs = [song('s1', 'available'), song('s2', 'available'), song('s3', 'drawn'), song('s4', 'played'), song('s5', 'void')];
    assert.equal(core.total(session), 5);
    assert.equal(core.remaining(session), 2);
    assert.equal(core.drawn(session), 3);
  });

  it('3.1 views triangulate: empty session => 0/0/0', () => {
    const session = core.createSession();
    assert.equal(core.total(session), 0);
    assert.equal(core.remaining(session), 0);
    assert.equal(core.drawn(session), 0);
  });

  it('3.2 committing 3 draws numbers n 1,2,3 with frozen snapshots', () => {
    const session = core.createSession();
    const songs = [core.createSong('Uno', 'A1'), core.createSong('Dos', 'A2'), core.createSong('Tres', 'A3')];
    songs.forEach((s) => {
      s.status = 'drawn';
      session.history.push(core.createHistoryEntry(s, session.history.length + 1));
    });
    assert.deepEqual(session.history.map((h) => h.n), [1, 2, 3]);
    songs[0].title = 'EDITADO';
    assert.equal(session.history[0].title, 'Uno');
  });

  it('3.3 esc neutralizes script tag', () => {
    assert.equal(core.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.ok(core.esc('<script>').indexOf('<script>') === -1);
  });

  it('3.3 makeId: 1000 ids match shape and are unique', () => {
    const ids = [];
    for (let i = 0; i < 1000; i++) ids.push(core.makeId());
    ids.forEach((id) => assert.match(id, /^s[0-9a-z]+$/));
    assert.equal(new Set(ids).size, 1000);
  });

  it('3.3 formatTime matches HH:MM:SS shape', () => {
    assert.match(core.formatTime(new Date()), /^\d{2}:\d{2}:\d{2}$/);
  });
});
