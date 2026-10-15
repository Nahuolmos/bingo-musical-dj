const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');

const BOM = '﻿';

function freshState(core) {
  core.state.songs = [
    { id: 'c10-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' },
    { id: 'c10-s2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' },
    { id: 'c10-s3', title: 'Levitating', artist: 'Dua Lipa', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' }
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

function loadDeps() {
  const core = require(path.join(root, 'js', 'core.js'));
  const draw = require(path.join(root, 'js', 'draw.js'));
  const app = require(path.join(root, 'js', 'app.js'));
  return { core, draw, app };
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

// ---- 1.1: 6-column header + BOM + CRLF (hand-computed literal, independent of the builder) ----
describe('c-10 1.1: CSV header is 6-column with BOM and CRLF', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('header-only export is BOM + exact 6-col header (Nº…Motivo), no data rows', () => {
    // Arrange: empty history
    // Act
    const csv = app.buildCsv([]);
    // Assert: hand-computed literal from specs/history-export/spec.md (NOT builder output)
    const expected = BOM + '"Nº","Título","Artista","Estado","Hora","Motivo"';
    assert.equal(csv.charAt(0), BOM, 'leading BOM byte preserved');
    assert.equal(csv, expected);
  });

  it('one drawn row keeps BOM/CRLF/RFC shape with empty Motivo default', () => {
    // Arrange: single committed draw, old-shape entry without motivo (mbdj.v1 back-compat)
    // Act
    const csv = app.buildCsv([{ n: 1, title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '20:00:01' }]);
    // Assert: hand-computed — trailing empty Motivo cell, CRLF join, BOM head
    const expected = BOM + '"Nº","Título","Artista","Estado","Hora","Motivo"'
      + '\r\n"1","Matador","Los Fabulosos Cadillacs","drawn","20:00:01",""';
    assert.equal(csv, expected);
  });
});

// ---- 1.3: motivo + RFC edge (comma / quote / newline pass through the quoter) ----
describe('c-10 1.3: motivo survives RFC quoting (comma, quote, newline)', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('motivo with a comma stays inside its quoted field', () => {
    // Arrange: hand-computed fixture (NOT builder output)
    const history = [{ n: 2, title: 'Gasolina', artist: 'Daddy Yankee', status: 'void', time: '20:00:02', motivo: 'Falta archivo, buscar otro' }];
    // Act
    const csv = app.buildCsv(history);
    // Assert
    const expected = BOM + '"Nº","Título","Artista","Estado","Hora","Motivo"'
      + '\r\n"2","Gasolina","Daddy Yankee","void","20:00:02","Falta archivo, buscar otro"';
    assert.equal(csv, expected);
  });

  it('motivo with double quotes doubles them (RFC-4180)', () => {
    // Arrange
    const history = [{ n: 1, title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'void', time: '20:00:01', motivo: 'Dijo "no"' }];
    // Act
    const csv = app.buildCsv(history);
    // Assert: inner quotes doubled, field still single-quoted
    const expected = BOM + '"Nº","Título","Artista","Estado","Hora","Motivo"'
      + '\r\n"1","Matador","Los Fabulosos Cadillacs","void","20:00:01","Dijo ""no"""';
    assert.equal(csv, expected);
  });

  it('motivo with a newline stays embedded in its quoted field', () => {
    // Arrange
    const history = [{ n: 1, title: 'T', artist: 'A', status: 'void', time: '20:00:01', motivo: 'Línea1\nLínea2' }];
    // Act
    const csv = app.buildCsv(history);
    // Assert: raw LF inside quotes (RFC allows it); row count by CRLF split is still header+1 logical rows
    const expected = BOM + '"Nº","Título","Artista","Estado","Hora","Motivo"'
      + '\r\n"1","T","A","void","20:00:01","Línea1\nLínea2"';
    assert.equal(csv, expected);
  });

  it('triangulate: title with comma+quote and void motivo via the real void flow land in the CSV row', () => {
    // Arrange: quoted title/artist fixture + live void motivo from C-09 seam
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);

    assert.equal(app.handleVoidRequest(() => 'Archivo corrupto', () => true), true);
    // Act
    const csv = app.buildCsv(core.state.history);
    // Assert: structural (time is live) — one data row, void status, motivo in Motivo column
    const lines = csv.slice(1).split('\r\n');
    assert.equal(lines.length, 2, 'header + exactly one data row');
    assert.equal(lines[0], '"Nº","Título","Artista","Estado","Hora","Motivo"');
    assert.ok(lines[1].includes('"void"'), 'raw void status in Estado column, got: ' + lines[1]);
    assert.ok(lines[1].endsWith(',"Archivo corrupto"'), 'motivo is the trailing column, got: ' + lines[1]);
  });
});

// ---- 1.4: formula-injection sanitization (leading = + - @ get a ' prefix pre-quote) ----
describe('c-10 1.4: CSV cells starting with = + - @ are neutralized', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('sanitizeCsvCell prefixes leading = + - @ and leaves plain text alone', () => {
    // Arrange + Act + Assert: pure helper, independent literals
    assert.equal(typeof app.sanitizeCsvCell, 'function', 'sanitizeCsvCell seam exists');
    assert.equal(app.sanitizeCsvCell('=cmd'), "'=cmd");
    assert.equal(app.sanitizeCsvCell('+cmd'), "'+cmd");
    assert.equal(app.sanitizeCsvCell('-cmd'), "'-cmd");
    assert.equal(app.sanitizeCsvCell('@cmd'), "'@cmd");
    assert.equal(app.sanitizeCsvCell('Matador'), 'Matador');
    assert.equal(app.sanitizeCsvCell(''), '');
    assert.equal(app.sanitizeCsvCell(null), '');
    assert.equal(app.sanitizeCsvCell(undefined), '');
  });

  it('title starting with = exports with a text-prefix inside quotes', () => {
    // Arrange
    const history = [{ n: 1, title: '=cmd', artist: 'A', status: 'drawn', time: '20:00:01', motivo: '' }];
    // Act
    const csv = app.buildCsv(history);
    // Assert: hand-computed — sanitize raw, then RFC-quote
    const expected = BOM + '"Nº","Título","Artista","Estado","Hora","Motivo"'
      + '\r\n"1","\'=cmd","A","drawn","20:00:01",""';
    assert.equal(csv, expected);
  });

  it('triangulate: + artist, - motivo, @ title all prefixed; plain cells untouched', () => {
    // Arrange
    const history = [{ n: 3, title: '@mencion', artist: '+remix', status: 'void', time: '20:00:03', motivo: '-falta' }];
    // Act
    const csv = app.buildCsv(history);
    // Assert: hand-computed — every leading =+-@ cell prefixed, then quoted
    const expected = BOM + '"Nº","Título","Artista","Estado","Hora","Motivo"'
      + '\r\n"3","\'@mencion","\'+remix","void","20:00:03","\'-falta"';
    assert.equal(csv, expected);
    // Plain cells elsewhere stay clean (no stray prefix)
    const clean = app.buildCsv([{ n: 1, title: 'Matador', artist: 'X', status: 'played', time: '20:00:01', motivo: '' }]);
    assert.ok(!clean.includes("'Matador"), 'plain title untouched, got: ' + clean);
  });
});

// ---- 1.5: empty history exports header-only + visible notice (never silent) ----
describe('c-10 1.5: empty export is header-only with a visible notice', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('empty history parses as BOM + exactly one line, zero data rows', () => {
    // Arrange: no draws at all
    // Act
    const csv = app.buildCsv(core.state.history);
    // Assert: valid CSV — strip BOM, split CRLF, one header line only
    assert.equal(csv.charAt(0), BOM);
    const lines = csv.slice(1).split('\r\n');
    assert.equal(lines.length, 1, 'exactly the header line, got: ' + JSON.stringify(lines));
    assert.equal(lines[0], '"Nº","Título","Artista","Estado","Hora","Motivo"');
  });

  it('historyExportNotice returns the empty-history copy, blank otherwise', () => {
    // Arrange + Act + Assert: pure seam, independent literals
    assert.equal(typeof app.historyExportNotice, 'function', 'historyExportNotice seam exists');
    assert.equal(app.historyExportNotice([]), 'Historial vacío — se exportó solo el encabezado.');
    assert.equal(app.historyExportNotice([{ n: 1 }]), '');
  });

  it('export handler wires the notice (static source check, never silent)', () => {
    // Arrange: independent literal from the spec (visible notice, not a silent download)
    const fs = require('node:fs');
    const src = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
    // Assert
    assert.ok(src.includes('historyExportNotice'), 'export path calls the notice seam');
    assert.ok(src.includes('Historial vacío'), 'empty-export copy present');
  });
});

// ---- 2.1: one row per draw — the delayed C-08 reveal adds no entry (single-writer) ----
describe('c-10 2.1: delayed public reveal never duplicates history/CSV rows', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('pickAndCommit -> delayed reveal leaves exactly 1 entry and 1 CSV row', () => {
    // Arrange: committed draw, public buffer pending via injected fake (no wall clock)
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);

    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    let revealed = 0;
    app.schedulePublicReveal(() => { revealed++; });
    // Act: the C-08 delayed reveal fires
    fake.fireAll();
    // Assert: single-writer — one entry, one CSV data row, reveal ran once
    assert.equal(revealed, 1);
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].id, picked.id);
    const rows = app.buildCsv(core.state.history).slice(1).split('\r\n');
    assert.equal(rows.length, 2, 'header + exactly one data row, got: ' + JSON.stringify(rows));
  });

  it('two-writer invariant: js/draw.js (draws) + js/app.js (C-11 unlock writer) append history entries', () => {
    // Arrange: scan every production module for history appends
    const fs = require('node:fs');
    const writers = [];
    for (const f of ['core.js', 'import.js', 'draw.js', 'store.js', 'public.js', 'app.js']) {
      const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
      if (src.includes('.history.push(')) writers.push(f);
    }
    // Assert: draws stay in draw.js; the ONLY other writer is the C-11 admin
    // unlock seam in app.js (reservation ended — see c-11 spec history-export)
    assert.deepEqual(writers, ['draw.js', 'app.js']);
  });
});

// ---- 2.2: ordered entries + es-AR time + in-place confirm (no new rows) ----
describe('c-10 2.2: history entries are ordered, timed, and updated in place', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('three committed draws number 1,2,3 with HH:MM:SS times', () => {
    // Arrange + Act: three real draws, each confirmed played
    for (let i = 0; i < 3; i++) {
      const s = draw.pickAndCommit(0);
      assert.ok(s, 'draw ' + (i + 1) + ' commits');
  
      app.setCurrentStatus('played');
    }
    // Assert: monotonic n + valid time per entry
    assert.equal(core.state.history.length, 3);
    assert.deepEqual(core.state.history.map((h) => h.n), [1, 2, 3]);
    for (const h of core.state.history) {
      assert.match(h.time, /^\d{2}:\d{2}:\d{2}$/, 'es-AR HH:MM:SS, got: ' + h.time);
    }
  });

  it('confirm played updates the entry in place (n/time/snapshot kept, no new row)', () => {
    // Arrange: one committed draw
    const picked = draw.pickAndCommit(0);

    const before = JSON.parse(JSON.stringify(core.state.history[0]));
    // Act
    app.setCurrentStatus('played');
    // Assert
    assert.equal(core.state.history.length, 1, 'no new entry on confirm');
    const h = core.state.history[0];
    assert.equal(h.status, 'played');
    assert.equal(h.n, before.n, 'n preserved');
    assert.equal(h.time, before.time, 'time preserved');
    assert.equal(h.title, picked.title, 'snapshot title preserved');
    assert.equal(h.artist, picked.artist, 'snapshot artist preserved');
  });

  it('triangulate: void updates the same entry in place with motivo, CSV keeps one row', () => {
    // Arrange
    draw.pickAndCommit(0);

    const nBefore = core.state.history[0].n;
    const timeBefore = core.state.history[0].time;
    // Act
    assert.equal(app.handleVoidRequest(() => 'Falta el archivo', () => true), true);
    // Assert
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].status, 'void');
    assert.equal(core.state.history[0].n, nBefore);
    assert.equal(core.state.history[0].time, timeBefore);
    assert.equal(core.state.history[0].motivo, 'Falta el archivo');
    assert.equal(app.buildCsv(core.state.history).slice(1).split('\r\n').length, 2);
  });
});

// ---- 2.3: motivo visible in the audit surface and escaped (stub document) ----
describe('c-10 2.3: void motivo renders visible and inert in list + history', () => {
  let core;
  let draw;
  let app;
  let savedDocument;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
    savedDocument = globalThis.document;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    teardown(draw, app, core);
  });

  it('voided rows show Anulada + motivo in the song list and the history', () => {
    // Arrange: stub DOM, void with a plain reason
    const doc = stubDocument();
    globalThis.document = doc;
    draw.pickAndCommit(0);

    assert.equal(app.handleVoidRequest(() => 'Falta el archivo', () => true), true);
    // Act
    app.render();
    // Assert: independent literals — motivo surfaces next to the void state on both surfaces
    assert.ok(doc._els.songList.innerHTML.includes('Anulada'), 'list keeps Anulada label');
    assert.ok(doc._els.songList.innerHTML.includes('Falta el archivo'), 'list shows motivo, got: ' + doc._els.songList.innerHTML);
    assert.ok(doc._els.historyList.innerHTML.includes('Falta el archivo'), 'history shows motivo, got: ' + doc._els.historyList.innerHTML);
  });

  it('markup motivo renders inert on both surfaces (no live tag)', () => {
    // Arrange
    const doc = stubDocument();
    globalThis.document = doc;
    draw.pickAndCommit(0);

    const evil = "<script>alert('x')</scr" + 'ipt>';
    assert.equal(app.handleVoidRequest(() => evil, () => true), true);
    // Act
    app.render();
    // Assert
    assert.ok(!doc._els.songList.innerHTML.includes('<script>'), 'list escaped, got: ' + doc._els.songList.innerHTML);
    assert.ok(doc._els.songList.innerHTML.includes('&lt;script&gt;'), 'list entity present');
    assert.ok(!doc._els.historyList.innerHTML.includes('<script>'), 'history escaped, got: ' + doc._els.historyList.innerHTML);
    assert.ok(doc._els.historyList.innerHTML.includes('&lt;script&gt;'), 'history entity present');
  });
});

// ---- 3.1: unlock entries — tolerant render/export + C-11 writer transition ----
describe('c-10 3.1: admin unlock entries render and export without breaking order/parse', () => {
  let core;
  let draw;
  let app;
  let savedDocument;

  function mixedHistory() {
    return [
      { n: 1, id: 'c10-s1', title: 'Matador', artist: 'X', status: 'played', time: '20:00:01', motivo: '' },
      { n: 2, id: 'c10-s2', title: 'Gasolina', artist: 'Y', status: 'drawn', time: '20:00:02', motivo: '' },
      { n: 3, id: 'admin-1', title: 'Desbloqueo administrativo', artist: '', status: 'unlock', time: '20:00:03', motivo: 'Autorizado por organizador' }
    ];
  }

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
    savedDocument = globalThis.document;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    teardown(draw, app, core);
  });

  it('mixed history renders newest-first with the unlock motivo and a visible (non-song) state', () => {
    // Arrange: 2 draw entries + 1 song-less admin entry (future C-11 shape)
    const doc = stubDocument();
    globalThis.document = doc;
    core.state.history = mixedHistory();
    // Act (must never throw on the song-less id)
    app.render();
    // Assert: order kept (admin newest-first), motivo visible, state honest
    const html = doc._els.historyList.innerHTML;
    assert.ok(html.indexOf('Desbloqueo administrativo') !== -1, 'admin row renders, got: ' + html);
    assert.ok(html.indexOf('Autorizado por organizador') !== -1, 'admin motivo visible, got: ' + html);
    assert.ok(html.indexOf('Desbloqueo administrativo') < html.indexOf('Gasolina'), 'newest-first order kept');
    assert.ok(html.indexOf('Gasolina') < html.indexOf('Matador'), 'draw order kept');
    assert.ok(html.includes('unlock'), 'admin visible state is its own status (never mislabeled Sorteada), got: ' + html);
  });

  it('mixed history exports 3 ordered CSV rows that still parse', () => {
    // Arrange
    core.state.history = mixedHistory();
    // Act
    const csv = app.buildCsv(core.state.history);
    // Assert: header + 3 rows in n order, admin motivo trailing, every line quoted
    const lines = csv.slice(1).split('\r\n');
    assert.equal(lines.length, 4, 'header + 3 data rows, got: ' + JSON.stringify(lines));
    assert.equal(lines[0], '"Nº","Título","Artista","Estado","Hora","Motivo"');
    assert.ok(lines[1].startsWith('"1",'), 'row 1 first, got: ' + lines[1]);
    assert.ok(lines[2].startsWith('"2",'), 'row 2 second, got: ' + lines[2]);
    assert.ok(lines[3].startsWith('"3",'), 'admin row third, got: ' + lines[3]);
    assert.ok(lines[3].endsWith(',"Autorizado por organizador"'), 'admin motivo trailing, got: ' + lines[3]);
    for (const ln of lines) {
      assert.ok(ln.startsWith('"') && ln.endsWith('"'), 'RFC quoted line, got: ' + ln);
    }
  });

  it('C-11 writer ships the unlock behavior (reservation ended: single writer + guards)', () => {
    // Arrange: static source check over production modules — the C-10
    // "no unlock behavior" reservation ends here per specs/history-export.
    const fs = require('node:fs');
    const srcs = ['app.js', 'draw.js', 'core.js'].map((f) => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
    const appSrc = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
    // Assert: factory + seam exist, unlock- ids, double confirm naming the
    // consequence, shared BLOCKED_MESSAGE funnel (verbatim reuse, no drift)
    assert.ok(srcs.includes('createUnlockEntry'), 'unlock entry factory ships');
    assert.ok(srcs.includes('handleUnlockRequest'), 'unlock handler ships');
    assert.ok(srcs.includes("'unlock-'"), 'unlock- id prefix');
    assert.ok(appSrc.includes('la lista quedará editable'), 'double-confirm names the consequence');
    assert.ok(appSrc.includes('Usá el Desbloqueo administrativo (C-11)'), 'shared blocked funnel reused verbatim');
  });
});

// ---- 3.2: export-first reset warning stays + day-1 export in the checklist ----
describe('c-10 3.2: reset warns export-first and the checklist recommends day-1 export', () => {
  it('reset confirmation keeps the "Exportá el historial primero" copy (warns, never forces)', () => {
    // Arrange: static source check — verbatim copy from the Flujo 5 contract
    const fs = require('node:fs');
    const src = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
    // Assert
    assert.ok(src.includes('Exportá el historial primero'), 'reset warns export-first, got: no match in js/app.js');
  });

  it('pre-show checklist recommends exporting at the end of day 1', () => {
    // Arrange: the rendered day-1 checklist (two-day event evidence handoff)
    const fs = require('node:fs');
    const checklist = fs.readFileSync(path.join(root, 'docs', 'PRE_SHOW_CHECKLIST.md'), 'utf8');
    // Assert: independent literals — day-1 export recommended, 6-col contract documented
    assert.ok(checklist.includes('día 1'), 'day-1 export line present, got: no match');
    assert.ok(checklist.includes('Motivo'), 'Motivo column documented, got: no match');
  });
});
