const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');

function freshState(core) {
  core.state.songs = [
    { id: 'c09-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' },
    { id: 'c09-s2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available', addedAt: '2026-10-01T20:00:00.000Z' }
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

function loadDeps() {
  const core = require(path.join(root, 'js', 'core.js'));
  const draw = require(path.join(root, 'js', 'draw.js'));
  const app = require(path.join(root, 'js', 'app.js'));
  return { core, draw, app };
}

function teardown(draw, app, core) {
  draw.resetTimerFns();
  draw.cancelReveal();
  if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
  if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
  resetState(core);
}

// ---- 1.1: played happy path via findLast clears current ----
describe('c-09 1.1: played happy path closes the draw', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('commit -> finishCommit -> setCurrentStatus played: song+entry played, current=null', () => {
    // Arrange: committed draw, spin ended, no buffer pending
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    const pickedId = picked.id;
    draw.finishCommit();
    // Act
    app.setCurrentStatus('played');
    // Assert: independent literals — played terminal state, current cleared
    const song = core.state.songs.find((s) => s.id === pickedId);
    assert.equal(song.status, 'played');
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].status, 'played');
    assert.equal(core.state.history[0].id, pickedId);
    assert.equal(core.state.current, null);
  });

  it('triangulate: second song played keeps first played (monotonic, no resurrection)', () => {
    // Arrange
    const first = draw.pickAndCommit(0);
    draw.finishCommit();
    app.setCurrentStatus('played');
    const second = draw.pickAndCommit(0);
    assert.ok(second);
    assert.notEqual(second.id, first.id);
    draw.finishCommit();
    // Act
    app.setCurrentStatus('played');
    // Assert
    assert.equal(core.state.history.length, 2);
    assert.equal(core.state.history[0].status, 'played');
    assert.equal(core.state.history[1].status, 'played');
    assert.equal(core.state.current, null);
    assert.equal(core.available().length, 0);
  });
});

// ---- 1.2: played blocked mid-spin / mid-buffer / without drawn current ----
describe('c-09 1.2: played gates (spin, buffer, no-current)', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('played mid-spin is a no-op (song/history/current unchanged)', () => {
    // Arrange: commit leaves spinning=true until finishCommit
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    assert.equal(core.state.spinning, true);
    const historyBefore = JSON.stringify(core.state.history);
    // Act
    app.setCurrentStatus('played');
    // Assert
    assert.equal(core.state.current && core.state.current.status, 'drawn');
    assert.equal(core.state.history[0].status, 'drawn');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
    assert.equal(picked.status, 'drawn');
  });

  it('played mid-buffer is a no-op (injected public-timer fake, no wall clock)', () => {
    // Arrange: spin ended, C-08 buffer pending via injected fake
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    draw.finishCommit();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.schedulePublicReveal(() => {});
    assert.equal(app.isPublicBuffer(), true);
    const historyBefore = JSON.stringify(core.state.history);
    // Act
    app.setCurrentStatus('played');
    // Assert
    assert.equal(core.state.current && core.state.current.status, 'drawn');
    assert.equal(core.state.history[0].status, 'drawn');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
  });

  it('played with no current draw is a no-op (null + non-drawn current)', () => {
    // Arrange: no commit at all
    // Act
    app.setCurrentStatus('played');
    // Assert
    assert.equal(core.state.history.length, 0);
    assert.equal(core.state.current, null);
    // Arrange 2: current present but not drawn (played terminal)
    core.state.songs = [{ id: 'c09-x', title: 'T', artist: 'A', status: 'played' }];
    core.state.current = { id: 'c09-x', title: 'T', artist: 'A', status: 'played' };
    core.state.history = [{ n: 1, id: 'c09-x', title: 'T', artist: 'A', status: 'played', time: '20:00:01', motivo: '' }];
    // Act 2
    app.setCurrentStatus('played');
    // Assert 2: terminal transition rejected, nothing mutates
    assert.equal(core.state.history[0].status, 'played');
    assert.ok(core.state.current, 'current stays (no clear on no-op)');
  });
});

// ---- 1.3: operator buttons gate on current/spin/buffer ----
describe('c-09 1.3: confirm buttons gate on current, spin, buffer', () => {
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

  it('buttons disabled without current, mid-spin, and mid-buffer; enabled post-reveal', () => {
    // Arrange: stub DOM with the ids render() touches
    const doc = stubDocument();
    globalThis.document = doc;
    // Act 1: no current draw committed
    app.render();
    // Assert 1
    assert.equal(doc._els.confirmBtn.disabled, true, 'confirm disabled without current');
    assert.equal(doc._els.drawBtn.disabled, false, 'draw enabled with pool available');
    // Act 2: commit -> mid-spin
    draw.pickAndCommit(0);
    app.render();
    // Assert 2
    assert.equal(doc._els.drawBtn.disabled, true, 'drawBtn disabled mid-spin');
    assert.equal(doc._els.confirmBtn.disabled, true, 'confirmBtn disabled mid-spin');
    // Act 3: spin ended, buffer pending — buttons stay disabled
    draw.finishCommit();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.schedulePublicReveal(() => {});
    app.render();
    // Assert 3
    assert.equal(doc._els.drawBtn.disabled, true, 'drawBtn disabled mid-buffer');
    assert.equal(doc._els.confirmBtn.disabled, true, 'confirmBtn disabled mid-buffer');
    // Act 4: buffer elapsed -> post-reveal with current drawn
    fake.fireAll();
    app.render();
    // Assert 4
    assert.equal(doc._els.confirmBtn.disabled, false, 'confirm enabled post-reveal');
    assert.equal(doc._els.drawBtn.disabled, false, 'draw enabled post-reveal');
  });
});

// ---- 2.1: empty/whitespace reason blocks void ----
describe('c-09 2.1: void without reason is blocked', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('empty-string reason leaves song/history/current drawn', () => {
    // Arrange: committed + revealed (no spin, no buffer)
    const picked = draw.pickAndCommit(0);
    draw.finishCommit();
    const historyBefore = JSON.stringify(core.state.history);
    // Act: operator submits an empty reason, then confirms
    const res = app.handleVoidRequest(() => '', () => true);
    // Assert
    assert.equal(res, false);
    assert.equal(core.state.current && core.state.current.status, 'drawn');
    assert.equal(core.state.history[0].status, 'drawn');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
    assert.equal(picked.status, 'drawn');
  });

  it('whitespace-only reason leaves song/history/current drawn (triangulate)', () => {
    // Arrange
    draw.pickAndCommit(0);
    draw.finishCommit();
    const historyBefore = JSON.stringify(core.state.history);
    // Act
    const res = app.handleVoidRequest(() => '   ', () => true);
    // Assert
    assert.equal(res, false);
    assert.equal(core.state.current && core.state.current.status, 'drawn');
    assert.equal(core.state.history[0].status, 'drawn');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
  });
});

// ---- 2.2: cancelled prompt or declined confirm aborts ----
describe('c-09 2.2: cancelled prompt or declined confirm aborts', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('prompt cancelled (null) aborts with zero mutation', () => {
    // Arrange
    draw.pickAndCommit(0);
    draw.finishCommit();
    const historyBefore = JSON.stringify(core.state.history);
    let confirms = 0;
    // Act
    const res = app.handleVoidRequest(() => null, () => { confirms++; return true; });
    // Assert
    assert.equal(res, false);
    assert.equal(confirms, 0, 'confirm never asked after a cancelled prompt');
    assert.equal(core.state.current && core.state.current.status, 'drawn');
    assert.equal(core.state.history[0].status, 'drawn');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
  });

  it('declined confirm (false) aborts with zero mutation (triangulate)', () => {
    // Arrange
    draw.pickAndCommit(0);
    draw.finishCommit();
    const historyBefore = JSON.stringify(core.state.history);
    // Act
    const res = app.handleVoidRequest(() => 'Falta el archivo en VirtualDJ', () => false);
    // Assert
    assert.equal(res, false);
    assert.equal(core.state.current && core.state.current.status, 'drawn');
    assert.equal(core.state.history[0].status, 'drawn');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
  });
});

// ---- 2.3: valid trimmed reason voids with organizer copy ----
describe('c-09 2.3: valid reason voids the draw', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('non-empty reason + confirm voids song+entry with trimmed motivo, current=null', () => {
    // Arrange
    const picked = draw.pickAndCommit(0);
    draw.finishCommit();
    // Act
    const res = app.handleVoidRequest(() => '  Falta el archivo en VirtualDJ  ', () => true);
    // Assert
    assert.equal(res, true);
    const song = core.state.songs.find((s) => s.id === picked.id);
    assert.equal(song.status, 'void');
    assert.equal(core.state.history[0].status, 'void');
    assert.equal(core.state.history[0].motivo, 'Falta el archivo en VirtualDJ');
    assert.equal(core.state.current, null);
  });

  it('organizer copy frozen in js/app.js (Incidencia registrada + Informa al organizador)', () => {
    // Arrange: static source check — independent literals from the spec
    const fs = require('node:fs');
    const src = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
    // Assert
    assert.ok(src.includes('Incidencia registrada'), 'void heading copy');
    assert.ok(src.includes('Informá al organizador'), 'organizer notice copy');
  });
});

// ---- 2.4: motivo visible and escaped in list/history ----
describe('c-09 2.4: motivo visible and escaped', () => {
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

  it('voided row renders Anulada + motivo in list and history', () => {
    // Arrange: stub DOM, void with a plain reason
    const doc = stubDocument();
    globalThis.document = doc;
    draw.pickAndCommit(0);
    draw.finishCommit();
    app.handleVoidRequest(() => 'Falta el archivo', () => true);
    // Act
    app.render();
    // Assert: independent literal — motivo surfaces next to the void label
    assert.ok(doc._els.songList.innerHTML.includes('Anulada'), 'list keeps Anulada label');
    assert.ok(doc._els.songList.innerHTML.includes('Falta el archivo'), 'list shows motivo, got: ' + doc._els.songList.innerHTML);
    assert.ok(doc._els.historyList.innerHTML.includes('Falta el archivo'), 'history shows motivo, got: ' + doc._els.historyList.innerHTML);
  });

  it('markup motivo renders inert (escaped, no live tag)', () => {
    // Arrange
    const doc = stubDocument();
    globalThis.document = doc;
    draw.pickAndCommit(0);
    draw.finishCommit();
    const evil = "<script>alert('x')</scr" + 'ipt>';
    app.handleVoidRequest(() => evil, () => true);
    // Act
    app.render();
    // Assert
    assert.ok(!doc._els.songList.innerHTML.includes('<script>'), 'list escaped, got: ' + doc._els.songList.innerHTML);
    assert.ok(doc._els.songList.innerHTML.includes('&lt;script&gt;'), 'list entity present');
    assert.ok(!doc._els.historyList.innerHTML.includes('<script>'), 'history escaped, got: ' + doc._els.historyList.innerHTML);
    assert.ok(doc._els.historyList.innerHTML.includes('&lt;script&gt;'), 'history entity present');
  });
});

// ---- 3.1: void terminal with no re-entry ----
describe('c-09 3.1: void is terminal', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('voided id never returns in available() across subsequent draws', () => {
    // Arrange: void the first draw with reason
    const first = draw.pickAndCommit(0);
    draw.finishCommit();
    const voidedId = first.id;
    assert.equal(app.handleVoidRequest(() => 'Archivo corrupto', () => true), true);
    // Act: draw the remaining song and confirm it
    const second = draw.pickAndCommit(0);
    assert.ok(second);
    assert.notEqual(second.id, voidedId);
    draw.finishCommit();
    app.setCurrentStatus('played');
    // Assert: pool exhausted, voided id absent everywhere eligible
    assert.equal(core.available().length, 0);
    assert.ok(!core.available().map((s) => s.id).includes(voidedId));
    assert.equal(draw.pickAndCommit(), null, 'no draw possible with only terminal songs left');
  });

  it('terminal transitions reject void -> available (triangulate via core)', () => {
    // Arrange + Act + Assert: independent literals from the transition allowlist
    const core2 = require(path.join(root, 'js', 'core.js'));
    assert.equal(core2.isValidTransition('void', 'available'), false);
    assert.equal(core2.isValidTransition('played', 'available'), false);
    const song = { id: 'c09-v', title: 'T', artist: 'A', status: 'void' };
    assert.equal(core2.setSongStatus(song, 'available'), false);
    assert.equal(song.status, 'void', 'void status untouched');
  });
});

// ---- 3.2: motivo survives C-06 save/load round-trip ----
describe('c-09 3.2: motivo persists across refresh', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('store.save -> store.load keeps void + motivo on the entry', () => {
    // Arrange: void with reason, then snapshot through the C-06 boundary
    const store = require(path.join(root, 'js', 'store.js'));
    const picked = draw.pickAndCommit(0);
    draw.finishCommit();
    assert.equal(app.handleVoidRequest(() => 'Pista salteada', () => true), true);
    const mem = {};
    const storage = {
      setItem: (k, v) => { mem[k] = String(v); },
      getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      removeItem: (k) => { delete mem[k]; }
    };
    // Act
    const saved = store.save({
      songs: core.state.songs,
      history: core.state.history,
      current: core.state.current,
      locked: core.state.locked,
      startedAt: core.state.startedAt
    }, storage);
    // Assert
    assert.equal(saved.ok, true);
    const back = store.load(storage);
    assert.equal(back.ok, true);
    assert.equal(back.snapshot.history[0].status, 'void');
    assert.equal(back.snapshot.history[0].motivo, 'Pista salteada');
    assert.equal(back.snapshot.history[0].id, picked.id);
  });
});

// ---- 3.3: copy title-artist leaves draw state untouched ----
describe('c-09 3.3: copy leaves draw state untouched', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshState(core);
  });

  afterEach(() => { teardown(draw, app, core); });

  it('clipboard mock receives title — artist, song/history/current unchanged', () => {
    // Arrange
    const picked = draw.pickAndCommit(0);
    draw.finishCommit();
    const historyBefore = JSON.stringify(core.state.history);
    let clipboard = null;
    // Act
    const text = app.handleCopyRequest((t) => { clipboard = t; return true; }, null);
    // Assert: independent literal — em-dash format
    assert.equal(text, 'Matador — Los Fabulosos Cadillacs');
    assert.equal(clipboard, 'Matador — Los Fabulosos Cadillacs');
    assert.equal(picked.status, 'drawn');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
    assert.ok(core.state.current, 'current untouched');
    assert.equal(core.state.current.id, picked.id);
  });

  it('title-only when artist empty + prompt fallback, state untouched (triangulate)', () => {
    // Arrange: title-only song
    core.state.songs = [{ id: 'c09-t', title: 'Solo Tema', artist: '', status: 'available' }];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    const picked = draw.pickAndCommit(0);
    draw.finishCommit();
    const historyBefore = JSON.stringify(core.state.history);
    let prompted = null;
    // Act: no clipboard boundary -> legacy prompt fallback
    const text = app.handleCopyRequest(null, (msg, preset) => { prompted = preset; return preset; });
    // Assert
    assert.equal(text, 'Solo Tema');
    assert.equal(prompted, 'Solo Tema');
    assert.equal(JSON.stringify(core.state.history), historyBefore);
    assert.equal(core.state.current && core.state.current.status, 'drawn');
  });

  it('copy with no current draw is a no-op (null, no clipboard/prompt call)', () => {
    // Arrange: nothing committed
    let clipboardCalls = 0;
    let promptCalls = 0;
    // Act
    const res = app.handleCopyRequest(() => { clipboardCalls++; return true; }, () => { promptCalls++; return null; });
    // Assert
    assert.equal(res, null);
    assert.equal(clipboardCalls, 0);
    assert.equal(promptCalls, 0);
  });
});
