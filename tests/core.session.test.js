const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('c-02 task 1.1: session/song/history factories', () => {
  let core;
  beforeEach(() => {
    delete require.cache[require.resolve('../js/core.js')];
    core = require('../js/core.js');
  });

  it('createSession() fresh shape: empty songs/history, null current, locked=false, schemaVersion=1, ISO startedAt', () => {
    assert.equal(typeof core.createSession, 'function');
    const s = core.createSession();
    assert.deepEqual(s.songs, []);
    assert.deepEqual(s.history, []);
    assert.equal(s.current, null);
    assert.equal(s.spinning, false);
    assert.equal(s.locked, false);
    assert.equal(s.schemaVersion, 1);
    assert.match(s.startedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(!Number.isNaN(Date.parse(s.startedAt)), 'startedAt parses as date');
  });

  it('createSong() defaults: available status, ISO addedAt, string id, empty artist allowed', () => {
    assert.equal(typeof core.createSong, 'function');
    const song = core.createSong('De Musica Ligera', 'Soda Stereo');
    assert.equal(song.title, 'De Musica Ligera');
    assert.equal(song.artist, 'Soda Stereo');
    assert.equal(song.status, 'available');
    assert.match(song.id, /^s[0-9a-z]+$/);
    assert.match(song.addedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const noArtist = core.createSong('Solo Titulo');
    assert.equal(noArtist.artist, '');
    assert.equal(noArtist.status, 'available');
  });

  it('createHistoryEntry() snapshots id/title/artist, n given, status drawn, motivo empty, HH:MM:SS time', () => {
    assert.equal(typeof core.createHistoryEntry, 'function');
    const song = core.createSong('Gasolina', 'Daddy Yankee');
    song.status = 'drawn';
    const e = core.createHistoryEntry(song, 1);
    assert.equal(e.n, 1);
    assert.equal(e.id, song.id);
    assert.equal(e.title, 'Gasolina');
    assert.equal(e.artist, 'Daddy Yankee');
    assert.equal(e.status, 'drawn');
    assert.equal(e.motivo, '');
    assert.match(e.time, /^\d{2}:\d{2}:\d{2}$/);
  });

  it('createHistoryEntry snapshots title/artist (frozen after catalog edit)', () => {
    const song = core.createSong('Original', 'Artista A');
    const e = core.createHistoryEntry(song, 1);
    song.title = 'Editado';
    song.artist = 'Artista B';
    assert.equal(e.title, 'Original');
    assert.equal(e.artist, 'Artista A');
  });
});
