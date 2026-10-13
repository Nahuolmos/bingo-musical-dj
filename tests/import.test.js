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

describe('c-04 1.1 RED: separators, header skip, numbering strip, title-only', () => {
  it('parses comma row with independent literals', () => {
    const imp = require('../js/import.js');
    const out = imp.parseText('Mercedes Sosa,Como la Cigarra');
    assert.equal(out.length, 1);
    assert.equal(out[0].artist, 'Mercedes Sosa');
    assert.equal(out[0].title, 'Como la Cigarra');
    assert.equal(out[0].status, 'available');
  });

  it('parses semicolon row with independent literals', () => {
    const imp = require('../js/import.js');
    const out = imp.parseText('Fito Páez;El Amor Después del Amor');
    assert.equal(out.length, 1);
    assert.equal(out[0].artist, 'Fito Páez');
    assert.equal(out[0].title, 'El Amor Después del Amor');
  });

  it('parses tab row with independent literals', () => {
    const imp = require('../js/import.js');
    const out = imp.parseText('Charly García\tDemoliendo Hoteles');
    assert.equal(out.length, 1);
    assert.equal(out[0].artist, 'Charly García');
    assert.equal(out[0].title, 'Demoliendo Hoteles');
  });

  it('skips first-line header, keeps data row', () => {
    const imp = require('../js/import.js');
    const out = imp.parseText('Song,Artist\nThe Beatles,Hey Jude');
    assert.equal(out.length, 1);
    assert.equal(out[0].artist, 'The Beatles');
    assert.equal(out[0].title, 'Hey Jude');
  });

  it('strips numeric and bullet numbering, keeps title-only', () => {
    const imp = require('../js/import.js');
    const n1 = imp.normalizeLine('3. Los Redondos - Jijiji');
    assert.equal(n1.artist, 'Los Redondos');
    assert.equal(n1.title, 'Jijiji');
    const n2 = imp.normalizeLine('- Callejeros - Una Nueva Noche Fría');
    assert.equal(n2.artist, 'Callejeros');
    assert.equal(n2.title, 'Una Nueva Noche Fría');
    const bare = imp.normalizeLine('La Bifurcada');
    assert.equal(bare.title, 'La Bifurcada');
    assert.equal(bare.artist, '');
    assert.equal(imp.normalizeLine('   '), null);
  });
});

describe('c-04 1.3 TRIANGULATE: dash variants, ; header, URL row, 02) numbering', () => {
  it('splits en-dash and em-dash separators', () => {
    const imp = require('../js/import.js');
    const en = imp.normalizeLine('Peteco Carabajal – Como Pájaros en el Aire');
    assert.equal(en.artist, 'Peteco Carabajal');
    assert.equal(en.title, 'Como Pájaros en el Aire');
    const em = imp.normalizeLine('León Gieco — Sólo le Pido a Dios');
    assert.equal(em.artist, 'León Gieco');
    assert.equal(em.title, 'Sólo le Pido a Dios');
  });

  it('skips Titulo;Artista header with semicolon', () => {
    const imp = require('../js/import.js');
    const out = imp.parseText('Titulo;Artista\nLos Tipitos;Campanas en la Noche');
    assert.equal(out.length, 1);
    assert.equal(out[0].artist, 'Los Tipitos');
    assert.equal(out[0].title, 'Campanas en la Noche');
  });

  it('falls back to line parsing for URL-led rows', () => {
    const imp = require('../js/import.js');
    const row = 'https://ejemplo.com/lista,Mi Canción';
    const out = imp.parseText(row);
    assert.equal(out.length, 1);
    assert.equal(out[0].title, row);
    assert.equal(out[0].artist, '');
  });

  it('strips 02) numbering', () => {
    const imp = require('../js/import.js');
    const r = imp.normalizeLine('02) Bersuit - El Tiempo No Para');
    assert.equal(r.artist, 'Bersuit');
    assert.equal(r.title, 'El Tiempo No Para');
  });
});

describe('c-04 2.1 RED: dedupe space-collapse, intra-batch vs against-list, empty, shape', () => {
  it('collapses spaces when deduping', () => {
    const imp = require('../js/import.js');
    const out = imp.dedupe([
      { id: 's1', title: 'El  Tiempo   No Para', artist: 'Bersuit  Vergarabat' },
      { id: 's2', title: 'El Tiempo No Para', artist: 'Bersuit Vergarabat' },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 's1');
  });

  it('dedupes intra-batch via parseText', () => {
    const imp = require('../js/import.js');
    const out = imp.parseText('Kapanga;El Mono Relojero\nKapanga;El Mono Relojero');
    assert.equal(out.length, 1);
  });

  it('dedupes against existing list and reports {added, duplicates, message}', () => {
    const imp = require('../js/import.js');
    const core = require('../js/core.js');
    core.state.songs = [];
    imp.importSongs([{ id: 'k1', title: 'El Mono Relojero', artist: 'Kapanga', status: 'available' }], 'seed');
    const r = imp.importSongs([
      { id: 'k2', title: 'el mono relojero', artist: 'kapanga', status: 'available' },
      { id: 'k3', title: 'Inmigrantes', artist: 'Callejeros', status: 'available' },
    ], 'lote');
    assert.equal(r.added, 1);
    assert.equal(r.duplicates, 1);
    assert.equal(typeof r.message, 'string');
    assert.match(r.message, /1.*nueva\(s\)/);
    assert.match(r.message, /1.*duplicado\(s\) omitido\(s\)/);
    assert.equal(core.state.songs.length, 2);
    core.state.songs = [];
  });

  it('empty input reports without mutating the catalog', () => {
    const imp = require('../js/import.js');
    const core = require('../js/core.js');
    core.state.songs = [{ id: 'keep', title: 'Rocas', artist: 'Divididos', status: 'available' }];
    const r = imp.importSongs(imp.parseText('   \n  \n'), 'vacío');
    assert.deepEqual({ added: r.added, duplicates: r.duplicates }, { added: 0, duplicates: 0 });
    assert.equal(r.message, 'No se detectaron canciones. Revisá el formato del archivo o pegá el texto manualmente.');
    assert.equal(core.state.songs.length, 1);
    assert.equal(core.state.songs[0].id, 'keep');
    core.state.songs = [];
  });
});

describe('c-04 3.1 RED: demo 12 idempotent, review helpers, locked rejection', () => {
  it('demo 12: first press adds 12, second adds 0 via same importSongs path', () => {
    const app = require('../js/app.js');
    const imp = require('../js/import.js');
    const core = require('../js/core.js');
    core.state.songs = [];
    assert.equal(app.buildDemoSongs().length, 12);
    const r1 = imp.importSongs(app.buildDemoSongs(), 'demo');
    assert.equal(r1.added, 12);
    const r2 = imp.importSongs(app.buildDemoSongs(), 'demo');
    assert.equal(r2.added, 0);
    assert.equal(r2.duplicates, 12);
    assert.equal(core.state.songs.length, 12);
    core.state.songs = [];
  });

  it('review helpers: counters, filter over title+artist, unspecified-artist label', () => {
    const app = require('../js/app.js');
    const songs = [
      { id: 'v1', title: 'Gasolina', artist: '', status: 'available' },
      { id: 'v2', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
      { id: 'v3', title: 'Mariposa Traicionera', artist: 'Maná', status: 'played' },
    ];
    assert.deepEqual(app.reviewCounters(songs), { total: 3, available: 1, drawn: 2 });
    const f = app.filterSongs(songs, 'cadillacs');
    assert.equal(f.length, 1);
    assert.equal(f[0].id, 'v2');
    assert.equal(app.filterSongs(songs, '  GASOLINA ').length, 1);
    assert.equal(app.artistLabel(''), 'Artista no especificado');
    assert.equal(app.artistLabel('Maná'), 'Maná');
  });

  it('locked session rejects paste and demo import with blocked message, no mutation', () => {
    const app = require('../js/app.js');
    const core = require('../js/core.js');
    core.state.songs = [];
    core.state.locked = true;
    try {
      assert.equal(app.isImportBlocked(), true);
      const before = core.state.songs.length;
      const rp = app.handlePasteImport('Vilma Palma e Vampiros - La Pachanga');
      assert.equal(rp.added, 0);
      assert.equal(core.state.songs.length, before);
      assert.equal(rp.message, app.BLOCKED_MESSAGE);
      const rd = app.handleDemoImport();
      assert.equal(rd.added, 0);
      assert.equal(core.state.songs.length, before);
      assert.match(rd.message, /Desbloqueo administrativo/);
      assert.equal(core.state.locked, true);
    } finally {
      core.state.locked = false;
      core.state.songs = [];
    }
  });

  it('unlocked session allows paste and demo import', () => {
    const app = require('../js/app.js');
    const core = require('../js/core.js');
    core.state.songs = [];
    core.state.locked = false;
    try {
      assert.equal(app.isImportBlocked(), false);
      const rp = app.handlePasteImport('Vilma Palma e Vampiros - La Pachanga');
      assert.equal(rp.added, 1);
      const rd = app.handleDemoImport();
      assert.equal(rd.added, 11);
      assert.equal(core.state.songs.length, 12);
    } finally {
      core.state.songs = [];
    }
  });
});
