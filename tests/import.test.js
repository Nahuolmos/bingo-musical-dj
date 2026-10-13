const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('import.js parsing contract', () => {
  it('loads without window/document crash', () => {
    const imp = require('../js/import.js');
    assert.equal(typeof imp.normalizeLine, 'function');
    assert.equal(typeof imp.parseText, 'function');
    assert.equal(typeof imp.dedupe, 'function');
    assert.equal(typeof imp.importSongs, 'function');
  });

  it('normalizeLine parses Artista - Titulo (happy)', () => {
    const imp = require('../js/import.js');
    const r = imp.normalizeLine('Shakira - Hips Don\'t Lie');
    assert.equal(r.title, 'Hips Don\'t Lie');
    assert.equal(r.artist, 'Shakira');
    assert.equal(r.status, 'available');
  });

  it('normalizeLine strips numbering and handles title-only (edge)', () => {
    const imp = require('../js/import.js');
    const numbered = imp.normalizeLine('01. Soda Stereo - De Musica Ligera');
    assert.equal(numbered.artist, 'Soda Stereo');
    const titleOnly = imp.normalizeLine('Gasolina');
    assert.equal(titleOnly.title, 'Gasolina');
    assert.equal(titleOnly.artist, '');
    assert.equal(imp.normalizeLine('   '), null);
  });

  it('parseText handles comma/semicolon/tab + header skip', () => {
    const imp = require('../js/import.js');
    const withHeader = imp.parseText('Titulo,Artista\nQueen,Don\'t Stop Me Now');
    assert.equal(withHeader.length, 1);
    assert.equal(withHeader[0].title, 'Don\'t Stop Me Now');
    const semi = imp.parseText('Dua Lipa;Levitating');
    assert.equal(semi[0].artist, 'Dua Lipa');
    const tab = imp.parseText('Rafaga\tMentirosa');
    assert.equal(tab[0].artist, 'Rafaga');
  });

  it('dedupe is diacritic/case-insensitive (triangulate)', () => {
    const imp = require('../js/import.js');
    const items = [
      { id: 'a', title: 'Música Ligera', artist: 'Soda Stereo' },
      { id: 'b', title: 'musica ligera', artist: 'soda stereo' },
      { id: 'c', title: 'Otra', artist: 'Otro' },
    ];
    const out = imp.dedupe(items);
    assert.equal(out.length, 2);
    assert.equal(imp.dedupe([]).length, 0);
  });

  it('importSongs reports duplicates, never silent (happy + edge)', () => {
    const imp = require('../js/import.js');
    const core = require('../js/core.js');
    core.state.songs = [];
    const r1 = imp.importSongs([{ id: 'x1', title: 'A', artist: 'B', status: 'available' }], 'test');
    assert.equal(r1.added, 1);
    assert.match(r1.message, /1.*nueva/);
    const r2 = imp.importSongs([{ id: 'x2', title: 'A', artist: 'B', status: 'available' }], 'test');
    assert.equal(r2.added, 0);
    assert.match(r2.message, /duplicado/i);
    const r3 = imp.importSongs([], 'test');
    assert.match(r3.message, /No se detectaron/i);
    core.state.songs = [];
  });
});
