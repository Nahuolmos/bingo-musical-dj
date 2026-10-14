const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('c-05 1.1 RED: parseXlsxBuffer seam (first-sheet rows -> songs, offline)', () => {
  let savedXLSX;

  beforeEach(() => {
    savedXLSX = globalThis.XLSX;
    delete require.cache[require.resolve('../js/import.js')];
  });

  afterEach(() => {
    if (savedXLSX === undefined) delete globalThis.XLSX;
    else globalThis.XLSX = savedXLSX;
    delete require.cache[require.resolve('../js/import.js')];
  });

  it('exposes parseXlsxBuffer as a function (seam)', () => {
    const imp = require('../js/import.js');
    assert.equal(typeof imp.parseXlsxBuffer, 'function');
  });

  it('first-sheet rows become songs via the text bridge (happy)', () => {
    globalThis.XLSX = {
      read: () => ({ SheetNames: ['Hoja1'], Sheets: { Hoja1: {} } }),
      utils: {
        sheet_to_json: () => [
          ['Queen', "Don't Stop Me Now"],
          ['Dua Lipa', 'Levitating'],
        ],
      },
    };
    const imp = require('../js/import.js');
    const out = imp.parseXlsxBuffer(new Uint8Array([1, 2, 3]).buffer);
    assert.equal(out.length, 2);
    assert.equal(out[0].artist, 'Queen');
    assert.equal(out[0].title, "Don't Stop Me Now");
    assert.equal(out[1].artist, 'Dua Lipa');
    assert.equal(out[1].title, 'Levitating');
  });

  it('empty sheet yields empty array (edge)', () => {
    globalThis.XLSX = {
      read: () => ({ SheetNames: ['Hoja1'], Sheets: { Hoja1: {} } }),
      utils: { sheet_to_json: () => [] },
    };
    const imp = require('../js/import.js');
    const out = imp.parseXlsxBuffer(new Uint8Array([9]).buffer);
    assert.deepEqual(out, []);
  });

  it('uses the injected XLSX global and never touches the network (offline)', () => {
    let readCalls = 0;
    globalThis.XLSX = {
      read: (buf, opts) => {
        readCalls++;
        assert.equal(opts && opts.type, 'array');
        return { SheetNames: ['H1'], Sheets: { H1: {} } };
      },
      utils: { sheet_to_json: () => [['A', 'B']] },
    };
    const imp = require('../js/import.js');
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'import.js'), 'utf8');
    assert.match(src, /parseXlsxBuffer/);
    assert.doesNotMatch(src, /cdnjs/);
    assert.doesNotMatch(src, /https?:\/\//);
    const out = imp.parseXlsxBuffer(new Uint8Array([7]).buffer);
    assert.equal(readCalls, 1);
    assert.equal(out.length, 1);
  });

  it('skips all-empty rows and reads first sheet only (triangulate)', () => {
    let seenSheet = null;
    globalThis.XLSX = {
      read: () => ({ SheetNames: ['Primera', 'Segunda'], Sheets: { Primera: { id: 1 }, Segunda: { id: 2 } } }),
      utils: {
        sheet_to_json: (ws) => {
          seenSheet = ws;
          assert.deepEqual(ws, { id: 1 });
          return [
            ['', '   ', ''],
            ['Soda Stereo', 'De Música Ligera'],
            ['Los Fabulosos Cadillacs', 'Matador'],
          ];
        },
      },
    };
    const imp = require('../js/import.js');
    const out = imp.parseXlsxBuffer(new Uint8Array([5]).buffer);
    assert.equal(out.length, 2);
    assert.equal(out[0].artist, 'Soda Stereo');
    assert.deepEqual(seenSheet, { id: 1 });
  });

  it('throws a visible error when the vendored XLSX global is missing (edge)', () => {
    delete globalThis.XLSX;
    const imp = require('../js/import.js');
    assert.throws(() => imp.parseXlsxBuffer(new Uint8Array([1]).buffer), /XLSX no disponible/);
  });
});

describe('c-05 2.1 RED: extension routing + offline fallback + locked file guard', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('../js/app.js')];
    delete require.cache[require.resolve('../js/import.js')];
    delete require.cache[require.resolve('../js/core.js')];
  });

  it('routes accepted extensions to readers, rejects lista.png (happy + edge)', () => {
    const app = require('../js/app.js');
    assert.equal(typeof app.getFileKind, 'function');
    assert.equal(app.getFileKind('tema.txt'), 'text');
    assert.equal(app.getFileKind('lista.CSV'), 'text');
    assert.equal(app.getFileKind('lista.tsv'), 'text');
    assert.equal(app.getFileKind('lista.XLSX'), 'xlsx');
    assert.equal(app.getFileKind('doc.pdf'), 'pdf');
    assert.equal(app.getFileKind('doc.DOCX'), 'docx');
    assert.equal(app.getFileKind('lista.png'), 'incompatible');
    assert.equal(app.getFileKind('lista.xlsx.exe'), 'incompatible');
    assert.equal(app.INCOMPATIBLE_MESSAGE, 'Formato no compatible. Usá PDF, DOCX, TXT, CSV o XLSX.');
  });

  it('parses semicolon/tab/encoding CSV rows offline (triangulate)', () => {
    const imp = require('../js/import.js');
    const semi = imp.parseText('Dua Lipa;Levitating');
    assert.equal(semi.length, 1);
    assert.equal(semi[0].artist, 'Dua Lipa');
    const tab = imp.parseText('Charly García\tDemoliendo Hoteles');
    assert.equal(tab.length, 1);
    assert.equal(tab[0].artist, 'Charly García');
    const bom = imp.parseText('﻿Mercedes Sosa,Como la Cigarra');
    assert.equal(bom.length, 1);
    assert.equal(bom[0].title, 'Como la Cigarra');
  });

  it('exposes offline PDF/DOCX fallback + xlsx-empty copies verbatim (edge)', () => {
    const app = require('../js/app.js');
    assert.equal(app.FILE_READ_ERROR_MESSAGE, 'No se pudo leer el archivo. Si es PDF/DOCX, verificá internet o copiá el texto y usá "Pegar texto".');
    assert.equal(app.XLSX_EMPTY_MESSAGE, 'No se detectaron canciones en el Excel. Exportá la hoja a CSV o copiá el texto y usá "Pegar texto".');
    assert.equal(app.XLSX_VENDOR_SRC, 'vendor/sheetjs/xlsx.full.min.js');
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    assert.doesNotMatch(src, /cdn\.sheetjs/);
  });

  it('locked session refuses file import verbatim without loading libs (guard-first)', () => {
    const app = require('../js/app.js');
    const core = require('../js/core.js');
    core.state.songs = [];
    core.state.locked = true;
    try {
      assert.equal(app.isImportBlocked(), true);
      const before = core.state.songs.length;
      const r = app.guardedImport([{ id: 'f1', title: 'X', artist: 'Y', status: 'available' }], 'lista.xlsx');
      assert.equal(r.blocked, true);
      assert.equal(r.message, app.BLOCKED_MESSAGE);
      assert.equal(r.message, 'Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.');
      assert.equal(core.state.songs.length, before);
      const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
      const guardAt = src.indexOf('isImportBlocked()');
      const vendorAt = src.indexOf('vendor/sheetjs');
      assert.ok(guardAt !== -1 && vendorAt !== -1 && guardAt < vendorAt, 'locked guard precedes vendor load');
    } finally {
      core.state.locked = false;
      core.state.songs = [];
    }
  });
});
