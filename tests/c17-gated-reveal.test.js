const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

// c-17-dj-gated-reveal: el sorteo commitea en dashboard y arma un gate pendiente;
// la pública espera en neutro hasta que el DJ pulsa Revelar.
// Literales independientes de la propuesta/diseño (nunca recomputados del código).
const GATE_COPY = 'En cabina… esperando al DJ';
const CABIN_COPY = 'Buscando el tema en cabina…';

function freshSongs(core) {
  core.state.songs = [
    { id: 'c17-a', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available', addedAt: '2026-10-01T20:00:00.000Z', coverUrl: null },
    { id: 'c17-b', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available', addedAt: '2026-10-01T20:00:00.000Z', coverUrl: null },
    { id: 'c17-c', title: 'Levitating', artist: 'Dua Lipa', status: 'available', addedAt: '2026-10-01T20:00:00.000Z', coverUrl: null }
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
        textContent: '', innerHTML: '', value: '', disabled: false, hidden: false, offsetWidth: 0,
        classList: {
          _s: [],
          add(c) { if (!this._s.includes(c)) this._s.push(c); },
          remove(c) { const i = this._s.indexOf(c); if (i !== -1) this._s.splice(i, 1); },
          contains(c) { return this._s.includes(c); }
        }
      };
    }
    return els[id];
  }
  return { getElementById: el, _els: els };
}

function memStorage() {
  const m = {};
  return {
    setItem: (k, v) => { m[k] = String(v); },
    getItem: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
    removeItem: (k) => { delete m[k]; },
    _raw: () => m['mbdj.v1']
  };
}

// ---- 2.1 espera neutra en pública (RED, sobre el bundle emitido — lección B1) ----
function c17InlineOf() {
  const pub = require(path.join(root, 'js', 'public.js'));
  const html = pub.buildPublicHTML();
  return html.split('<script>')[1].split('</script>')[0];
}

function c17BootPublic(preloaded) {
  const inline = c17InlineOf();
  new vm.Script(inline); // SyntaxError si el bloque emitido está roto
  const writes = [];
  const els = {};
  function el(id) {
    if (!els[id]) {
      const rec = { _text: '', _html: '', _display: '', _cls: [] };
      const node = {
        get textContent() { return rec._text; },
        set textContent(v) { rec._text = String(v); writes.push(id + '.textContent'); },
        get innerHTML() { return rec._html; },
        set innerHTML(v) { rec._html = String(v); writes.push(id + '.innerHTML'); },
        get offsetWidth() { return 0; },
        style: {},
        classList: {
          add(c) { if (!rec._cls.includes(c)) rec._cls.push(c); writes.push(id + '.add(' + c + ')'); },
          remove(c) { const i = rec._cls.indexOf(c); if (i !== -1) rec._cls.splice(i, 1); },
          contains(c) { return rec._cls.includes(c); }
        },
        _rec: rec
      };
      Object.defineProperty(node.style, 'display', {
        get() { return rec._display; },
        set(v) { rec._display = String(v); writes.push(id + '.display'); },
        enumerable: true, configurable: true
      });
      els[id] = node;
    }
    return els[id];
  }
  const timers = makeFakeTimers();
  const handlers = {};
  const store = {
    _s: typeof preloaded === 'string' ? preloaded : null,
    getItem() { return this._s; },
    setItem(k, v) { this._s = v; }
  };
  const win = {
    addEventListener(t, fn) { (handlers[t] = handlers[t] || []).push(fn); },
    matchMedia() { return { matches: false }; },
    localStorage: store
  };
  const sandbox = {
    document: { getElementById: el, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; } },
    window: win,
    setTimeout: timers.setTimeoutFn,
    clearTimeout: timers.clearTimeoutFn
  };
  vm.createContext(sandbox);
  vm.runInContext(inline, sandbox);
  return { els, handlers, writes, timers };
}

function c17Post(ctx, msg) {
  (ctx.handlers.storage || []).forEach((fn) => fn({ key: 'music-bingo-dj-on', newValue: JSON.stringify(msg) }));
}

function c17GateMsg() {
  return {
    type: 'state', phase: 'awaiting-gate', songs: [],
    history: [{ n: 1, title: 'Vieja Confirmada', artist: 'Artista A', status: 'played', time: '20:00:01' }],
    current: null, scrollPool: null, total: 3, remaining: 2, drawn: 1
  };
}

describe('c-17 2.1: espera neutra awaiting-gate en pública (RED)', () => {
  it('la espera neutra muestra su mensaje propio sin título ni scroll', () => {
    // Arrange
    const ctx = c17BootPublic(null);
    // Act
    c17Post(ctx, c17GateMsg());
    // Assert: literales independientes del diseño (Q1) y del spec
    assert.equal(ctx.els.waiting.textContent, GATE_COPY);
    assert.equal(ctx.els.result.style.display, 'none', 'resultado oculto en espera');
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'sin título en espera');
    assert.equal(ctx.timers.pending.size, 0, 'ventana estática: ningún timer de scroll');
  });

  it('el mensaje neutro del gate es distinto del cabin message del buffer (triangulate)', () => {
    // Arrange + Act: el bundle emitido lleva ambos literales
    const pub = require(path.join(root, 'js', 'public.js'));
    const html = pub.buildPublicHTML();
    // Assert
    assert.ok(html.includes(GATE_COPY), 'bundle lleva el mensaje neutro del gate');
    assert.ok(html.includes(CABIN_COPY), 'bundle conserva el cabin message del buffer');
    assert.notEqual(GATE_COPY, CABIN_COPY, 'copys distintos por spec');
  });

  it('re-sync mid-gate nunca filtra título, artista ni tapa aunque el envelope los trajera', () => {
    // Arrange: popup abierto mid-gate (hidratación) + envelope hostil con current
    const hostile = c17GateMsg();
    hostile.current = { id: 'c17-a', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', coverUrl: 'https://cdn.example.com/matador.jpg' };
    hostile.scrollPool = [{ id: 'c17-b', title: 'Gasolina', artist: 'Daddy Yankee' }];
    const ctx = c17BootPublic(JSON.stringify(hostile));
    // Act: re-sync por storage con el mismo envelope hostil
    c17Post(ctx, JSON.parse(JSON.stringify(hostile)));
    // Assert: el renderer de espera ignora current/scrollPool por construcción
    assert.equal(ctx.els.waiting.textContent, GATE_COPY);
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'título hostil nunca pinta');
    assert.equal(ctx.els.result.style.display, 'none');
    const allWrites = ctx.writes.join(' ');
    assert.ok(!allWrites.includes('Matador'), 'título hostil en ningún write del DOM');
    assert.ok(!allWrites.includes('cdn.example.com'), 'tapa hostil en ningún write del DOM');
  });

  it('markup en historial durante la espera queda inerte (escapado)', () => {
    // Arrange
    const ctx = c17BootPublic(null);
    const evil = "<script>alert('x')</scr" + 'ipt>';
    const msg = c17GateMsg();
    msg.history = [{ n: 1, title: evil, artist: 'A', status: 'played', time: '20:00:01' }];
    // Act
    c17Post(ctx, msg);
    // Assert
    assert.equal(ctx.els.waiting.textContent, GATE_COPY, 'la espera sigue neutra');
    assert.ok(!ctx.els.history.innerHTML.includes('<script>'), 'píldora escapada, got: ' + ctx.els.history.innerHTML);
    assert.ok(ctx.els.history.innerHTML.includes('&lt;script&gt;'), 'entidad escapada presente');
  });
});

// ---- 3.1 botón Revelar en pública + arranque del buffer (RED) ----
describe('c-17 3.1: botón Revelar solo con gate + un solo buffer (RED)', () => {
  let core;
  let draw;
  let app;
  let savedDocument;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshSongs(core);
    savedDocument = globalThis.document;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    teardown(app, core);
  });

  it('botón oculto/deshabilitado sin gate; visible/habilitado con gate pendiente', () => {
    // Arrange: dashboard con el botón del change (stub con todos los ids de render)
    const doc = stubDocument();
    globalThis.document = doc;
    // Act 1: sin gate
    app.render();
    // Assert 1
    assert.equal(doc._els.revealGateBtn.hidden, true, 'oculto sin gate');
    assert.equal(doc._els.revealGateBtn.disabled, true, 'deshabilitado sin gate');
    // Act 2: sorteo commitea y arma el gate
    const s = app.handleDrawClick();
    assert.ok(s, 'commit');
    app.render();
    // Assert 2
    assert.equal(doc._els.revealGateBtn.hidden, false, 'visible con gate');
    assert.equal(doc._els.revealGateBtn.disabled, false, 'habilitado con gate');
  });

  it('sorteo expone el botón en el mismo path real (sin render manual extra)', () => {
    // Arrange: dashboard recién renderizado (botón oculto) — reproduce el
    // bug del operador: la pública entraba en awaiting-gate pero el botón
    // nunca aparecía porque handleDrawClick no re-renderizaba.
    const doc = stubDocument();
    globalThis.document = doc;
    app.render();
    assert.equal(doc._els.revealGateBtn.hidden, true, 'oculto antes del sorteo');
    // Act: path real del click — SIN render() manual posterior
    const s = app.handleDrawClick();
    // Assert: el propio sorteo deja el botón visible y habilitado
    assert.ok(s, 'commit');
    assert.equal(app.isAwaitingGate(), true, 'gate pendiente');
    assert.equal(doc._els.revealGateBtn.hidden, false, 'visible tras sortear sin render extra');
    assert.equal(doc._els.revealGateBtn.disabled, false, 'habilitado tras sortear sin render extra');
    assert.equal(doc._els.drawBtn.disabled, true, 'sortear se apaga mid-gate');
    assert.equal(doc._els.confirmBtn.disabled, true, 'confirmar se apaga mid-gate');
    assert.equal(doc._els.resultTitle.textContent, s.title, 'dashboard privado intacto');
    // Triangulate: el click del botón consume el gate y arranca un solo buffer
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    const pending = app.handleRevealGate();
    assert.ok(pending, 'click arranca el buffer');
    assert.equal(pending.id, s.id, 'mismo commit');
    assert.equal(app.handleRevealGate(), null, 'doble click no-op');
    assert.equal(fake.pending.size, 1, 'un solo buffer');
    assert.equal(doc._els.revealGateBtn.hidden, true, 'botón oculto tras consumir el gate');
  });

  it('doble pulsación corre un solo buffer y un solo reveal', () => {
    // Arrange
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    const s = app.handleDrawClick();
    assert.ok(s);
    assert.equal(app.isAwaitingGate(), true);
    // Act: doble pulso del DJ
    const first = app.handleRevealGate();
    const second = app.handleRevealGate();
    // Assert: el primero consume, el segundo es no-op, un solo buffer
    assert.ok(first, 'primer pulso arranca el buffer');
    assert.equal(first.id, s.id, 'mismo commit, sin segundo sorteo');
    assert.equal(second, null, 'segundo pulso no-op');
    assert.equal(app.isAwaitingGate(), false, 'gate consumido al primer pulso');
    assert.equal(app.isPublicBuffer(), true, 'buffer en vuelo');
    assert.equal(fake.pending.size, 1, 'un solo buffer programado');
    assert.equal(Array.from(fake.pending.values())[0].ms, 5000, 'el buffer espera el delay nominal');
    // Act: el buffer vence
    fake.fireAll();
    // Assert: un solo reveal, buffer liberado
    assert.equal(app.isPublicBuffer(), false, 'buffer liberado tras el reveal');
    assert.equal(fake.pending.size, 0, 'ningún timer residual');
  });

  it('el gate no muta commit/history/lock ni agrega entradas (triangulate)', () => {
    // Arrange
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    const s = app.handleDrawClick();
    const before = JSON.stringify({ songs: core.state.songs, history: core.state.history, current: core.state.current, locked: core.state.locked });
    // Act: gate + vencimiento del buffer (reveal + render)
    app.handleRevealGate();
    const mid = JSON.stringify({ songs: core.state.songs, history: core.state.history, current: core.state.current, locked: core.state.locked });
    fake.fireAll();
    // Assert
    assert.equal(mid, before, 'el gate no muta nada');
    assert.equal(JSON.stringify({ songs: core.state.songs, history: core.state.history, current: core.state.current, locked: core.state.locked }), before, 'el reveal tampoco muta nada');
    assert.equal(core.state.history.length, 1, 'una sola entrada por sorteo');
    assert.equal(core.state.current.id, s.id, 'mismo current');
    assert.equal(core.state.locked, true, 'lock intacto');
  });
});

// ---- 4.1 guards gate+buffer y cancelación (RED) ----
describe('c-17 4.1: guards gate+buffer y cancelación sin fantasmas (RED)', () => {
  let core;
  let draw;
  let app;
  let savedDocument;
  let savedConfirm;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshSongs(core);
    savedDocument = globalThis.document;
    savedConfirm = globalThis.confirm;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    if (savedConfirm === undefined) { try { delete globalThis.confirm; } catch (e) {} }
    else { globalThis.confirm = savedConfirm; }
    teardown(app, core);
  });

  it('Sortear + Confirmar sin efecto mid-gate (played y void antes del prompt)', () => {
    // Arrange: gate pendiente, dashboard real
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.handleDrawClick();
    assert.equal(app.isAwaitingGate(), true);
    const historyBefore = JSON.stringify(core.state.history);
    // Act: segunda pulsación de Sortear mid-gate
    assert.equal(app.handleDrawClick(), null, 'segundo sorteo mid-gate bloqueado');
    // Assert
    assert.equal(JSON.stringify(core.state.history), historyBefore, 'sin segundo commit');
    assert.equal(core.state.history.length, 1);
    // Act: played mid-gate
    app.setCurrentStatus('played');
    // Assert
    assert.equal(core.state.current && core.state.current.status, 'drawn', 'played bloqueado mid-gate');
    assert.equal(core.state.history[0].status, 'drawn', 'historial intacto mid-gate');
    // Act: void mid-gate (el prompt nunca debe disparar)
    let prompts = 0;
    const res = app.handleVoidRequest(() => { prompts++; return 'X'; }, () => true);
    // Assert
    assert.equal(res, false, 'void bloqueado mid-gate');
    assert.equal(prompts, 0, 'prompt nunca dispara mid-gate');
    assert.equal(core.state.history[0].status, 'drawn');
  });

  it('Sortear + Confirmar sin efecto mid-buffer y habilitados al reveal', () => {
    // Arrange: flujo completo hasta el buffer (draw → gate → reveal arranca buffer)
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.handleDrawClick();
    app.handleRevealGate();
    assert.equal(app.isPublicBuffer(), true, 'buffer en vuelo post-gate');
    // Act + Assert: bloqueados mid-buffer
    assert.equal(app.handleDrawClick(), null, 'sorteo bloqueado mid-buffer');
    app.setCurrentStatus('played');
    assert.equal(core.state.current && core.state.current.status, 'drawn', 'played bloqueado mid-buffer');
    // Act: vence el buffer (reveal)
    fake.fireAll();
    assert.equal(app.isPublicBuffer(), false);
    // Assert: habilitados al reveal
    app.setCurrentStatus('played');
    assert.equal(core.state.current, null, 'played cierra al reveal');
    assert.equal(core.state.history[0].status, 'played');
  });

  it('void con motivo habilitado al reveal (triangulate)', () => {
    // Arrange: flujo completo hasta el reveal
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.handleDrawClick();
    app.handleRevealGate();
    fake.fireAll();
    // Act
    const res = app.handleVoidRequest(() => 'Archivo dañado', () => true);
    // Assert
    assert.equal(res, true, 'void habilitado al reveal');
    assert.equal(core.state.current, null);
    assert.equal(core.state.history[0].status, 'void');
    assert.equal(core.state.history[0].motivo, 'Archivo dañado');
  });

  it('vaciar mid-gate cancela el gate: sin reveal posterior ni fantasmas', () => {
    // Arrange: gate pendiente (rama Node de clear: sin document, unlock manual)
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    globalThis.document = stubDocument();
    app.handleDrawClick();
    assert.equal(app.isAwaitingGate(), true);
    core.state.locked = false; // régimen unlocked (el commit bloquea; unlock es vía C-11)
    try { delete globalThis.document; } catch (e) { globalThis.document = undefined; }
    // Act: vaciar mid-gate
    assert.equal(app.handleClearSongs(), true, 'clear procede unlocked');
    // Assert: gate cancelado, tablero limpio, nada pendiente
    assert.equal(app.isAwaitingGate(), false, 'gate cancelado');
    assert.equal(app.isPublicBuffer(), false, 'sin buffer');
    assert.equal(fake.pending.size, 0, 'sin timers');
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.current, null);
    fake.fireAll();
    assert.equal(core.state.songs.length, 0, 'sin reveal fantasma tras vaciar');
    // Assert: el broadcast por defecto vuelve a idle neutro
    const slot = { v: null };
    const mirror = { setItem(k, v) { slot.v = v; }, getItem() { return slot.v; } };
    app.broadcast(mirror);
    const pub = require(path.join(root, 'js', 'public.js'));
    assert.equal(pub.parseTransportValue(mirror.getItem()).phase, 'idle');
  });

  it('reiniciar mid-buffer post-gate cancela el reveal (triangulate + DOM)', () => {
    // Arrange: buffer en vuelo post-gate con dashboard + confirms reales
    const doc = stubDocument();
    globalThis.document = doc;
    globalThis.confirm = () => true;
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.handleDrawClick();
    app.handleRevealGate();
    assert.equal(app.isPublicBuffer(), true);
    core.state.locked = false;
    let reveals = 0;
    app.schedulePublicReveal(() => { reveals++; });
    // Act: reiniciar mid-buffer
    assert.equal(app.handleResetAll(), true, 'reset procede unlocked');
    // Assert
    assert.equal(app.isAwaitingGate(), false, 'sin gate residual');
    assert.equal(app.isPublicBuffer(), false, 'buffer cancelado');
    fake.fireAll();
    assert.equal(reveals, 0, 'el reveal pendiente nunca dispara');
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.current, null);
    // Assert: el botón de reveal vuelve a ocultarse tras el render del reset
    assert.equal(doc._els.revealGateBtn.hidden, true, 'botón oculto tras cancelar');
  });
});

// ---- 5.1 persistencia del gate (RED) ----
describe('c-17 5.1: el gate sobrevive al refresh vía mbdj.v1 (RED)', () => {
  let core;
  let draw;
  let app;
  let savedDocument;
  let savedConfirm;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshSongs(core);
    savedDocument = globalThis.document;
    savedConfirm = globalThis.confirm;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    if (savedConfirm === undefined) { try { delete globalThis.confirm; } catch (e) {} }
    else { globalThis.confirm = savedConfirm; }
    teardown(app, core);
  });

  it('refresh mid-gate restaura resultado + botón + pública en espera neutra', () => {
    // Arrange: sorteo con gate pendiente (dashboard + clock mockeados)
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    const s = app.handleDrawClick();
    assert.ok(s);
    const storage = memStorage();
    app.persistCurrentState(storage);
    const committedTitle = s.title;
    // Act: reload simulado — memoria volátil a cero, storage intacto
    resetState(core);
    app._resetGateForTest();
    app.cancelPublicReveal();
    const boot = app.bootRestore(storage);
    // Assert: boot restaurado con el commit y el gate pendiente
    assert.equal(boot.status, 'restored', 'banner de partida recuperada');
    assert.ok(core.state.current, 'current restaurado');
    assert.equal(core.state.current.title, committedTitle, 'mismo resultado');
    assert.equal(app.isAwaitingGate(), true, 'gate restaurado');
    assert.equal(app.isPublicBuffer(), false, 'sin buffer tras el boot');
    // Assert: dashboard pinta resultado + botón habilitado
    const doc2 = stubDocument();
    globalThis.document = doc2;
    app.render();
    assert.equal(doc2._els.resultTitle.textContent, committedTitle, 'resultado visible en dashboard');
    assert.equal(doc2._els.revealGateBtn.hidden, false, 'botón habilitado tras refresh');
    assert.equal(doc2._els.revealGateBtn.disabled, false);
    // Assert: la pública re-sincroniza en espera neutra, nunca el título
    const slot = { v: null };
    app.broadcast({ setItem(k, v) { slot.v = v; }, getItem() { return slot.v; } });
    const pub = require(path.join(root, 'js', 'public.js'));
    const back = pub.parseTransportValue(slot.v);
    assert.equal(back.phase, 'awaiting-gate', 'pública en espera neutra tras refresh');
    assert.equal(back.current, null, 'sin título tras refresh');
  });

  it('snapshot pre-change (sin flag) hidrata sin gate y el próximo render persiste el flag', () => {
    // Arrange: payload guardado antes del change (sin awaitingGate), schema 2
    const storage = memStorage();
    storage.setItem('mbdj.v1', JSON.stringify({
      songs: [{ id: 'c17-a', title: 'Matador', artist: 'X', status: 'drawn', addedAt: 'x', coverUrl: null }],
      history: [{ n: 1, id: 'c17-a', title: 'Matador', artist: 'X', status: 'drawn', time: '20:00:01' }],
      current: { id: 'c17-a', title: 'Matador', artist: 'X', status: 'drawn', coverUrl: null },
      locked: true, startedAt: '2026-10-01T20:00:00.000Z', savedAt: '2026-10-01T20:00:00.000Z', schemaVersion: 2
    }));
    // Act
    const boot = app.bootRestore(storage);
    // Assert: estado intacto, sin gate
    assert.equal(boot.status, 'restored');
    assert.equal(core.state.current.title, 'Matador');
    assert.equal(core.state.locked, true);
    assert.equal(app.isAwaitingGate(), false, 'sin gate fantasma en snapshot viejo');
    // Act: próximo render persiste el flag aditivo (render invoca
    // persistCurrentState con el storage por defecto; en Node se observa
    // con el mismo seam y storage explícito)
    globalThis.document = stubDocument();
    app.render();
    const persisted = app.persistCurrentState(storage);
    assert.equal(persisted.ok, true, 'persiste con storage disponible');
    const raw = storage._raw();
    assert.ok(raw.includes('"awaitingGate":false'), 'flag aditivo persistido, got: ' + raw.slice(0, 160));
  });

  it('gate cancelado persiste como cancelado (triangulate)', () => {
    // Arrange: sorteo → gate → vaciar (DOM + confirms) → persistido por render
    globalThis.document = stubDocument();
    globalThis.confirm = () => true;
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.handleDrawClick();
    assert.equal(app.isAwaitingGate(), true);
    core.state.locked = false;
    const storage = memStorage();
    assert.equal(app.handleClearSongs(), true, 'clear procede');
    app.persistCurrentState(storage);
    assert.ok(storage._raw().includes('"awaitingGate":false'), 'cancelación persistida');
    // Act: reload
    resetState(core);
    app._resetGateForTest();
    const boot = app.bootRestore(storage);
    // Assert: nada pendiente, ningún reveal tras el boot
    assert.equal(app.isAwaitingGate(), false, 'sin gate restaurado');
    assert.equal(app.isPublicBuffer(), false);
    fake.fireAll();
    assert.equal(fake.pending.size, 0, 'ningún timer tras el boot');
    assert.equal(boot.status, 'empty', 'tablero vaciado persiste vaciado');
  });
});

// ---- 6.1 compat tapas C-16 + CSV (RED) ----
describe('c-17 6.1: coverUrl scrubbed pre-gate + CSV 6 cols intacto (RED)', () => {
  let core;
  let draw;
  let app;
  let savedDocument;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshSongs(core);
    savedDocument = globalThis.document;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    teardown(app, core);
  });

  it('awaiting-gate scrubea coverUrl: slot neutro hasta el reveal', () => {
    // Arrange: commit con tapa en la sorteada y en el resto
    core.state.songs[0].coverUrl = 'https://cdn.example.com/matador.jpg';
    core.state.songs[1].coverUrl = 'https://cdn.example.com/gasolina.jpg';
    const picked = draw.pickAndCommit(0);
    assert.equal(picked.coverUrl, 'https://cdn.example.com/matador.jpg', 'la sorteada tiene tapa');
    // Act
    const msg = app.buildStateMessage('awaiting-gate');
    // Assert: fase neutra sin pool y sin committed artwork en ningún slot
    assert.equal(msg.phase, 'awaiting-gate');
    assert.equal(msg.current, null, 'current scrubbed');
    assert.equal(msg.scrollPool, null, 'sin pool pre-gate');
    const drawnRows = msg.songs.filter((s) => s.status === 'drawn');
    assert.equal(drawnRows.length, 1);
    assert.equal(drawnRows[0].title, '', 'título scrubbed');
    assert.equal(drawnRows[0].coverUrl, null, 'tapa scrubbed');
    assert.ok(!JSON.stringify(msg).includes('matador.jpg'), 'la tapa commiteada no viaja pre-gate');
    assert.ok(!JSON.stringify(msg.history).includes('Matador'), 'historial drawn withheld pre-gate');
  });

  it('post-gate el pool viaja fresco y el reveal lleva la tapa (triangulate)', () => {
    // Arrange: flujo con gate (dashboard + clock mockeados, tapa por canción)
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    for (const song of core.state.songs) song.coverUrl = 'https://cdn.example.com/' + song.id + '.jpg';
    const s = app.handleDrawClick();
    assert.ok(s);
    assert.equal(app.isAwaitingGate(), true);
    // Act: el DJ revela → buffer con pool fresco
    app.handleRevealGate();
    const spin = app.buildStateMessage('spinning');
    // Assert: pool post-commit (drawn excluida por id) y reveal con tapa
    assert.ok(Array.isArray(spin.scrollPool), 'pool post-gate presente');
    assert.equal(spin.scrollPool.length, 2, 'solo restantes');
    assert.ok(!spin.scrollPool.map((e) => e.id).includes(s.id), 'drawn excluida por id');
    fake.fireAll();
    const reveal = app.buildStateMessage('reveal');
    assert.ok(reveal.current, 'reveal lleva current');
    assert.equal(reveal.current.title, s.title);
    assert.equal(reveal.current.coverUrl, 'https://cdn.example.com/' + s.id + '.jpg', 'la tapa cierra solo en el reveal');
  });

  it('export post-gate sigue en 6 columnas sin columna de gate y con 1 fila por sorteo', () => {
    // Arrange: flujo completo hasta played
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.handleDrawClick();
    app.handleRevealGate();
    fake.fireAll();
    app.setCurrentStatus('played');
    // Act
    const csv = app.buildCsv(core.state.history);
    // Assert: BOM + header exacto de 6 columnas + 1 fila de datos
    assert.ok(csv.startsWith('﻿'), 'BOM intacto');
    const lines = csv.slice(1).split('\r\n');
    assert.equal(lines.length, 2, 'header + 1 fila (el gate no agrega filas)');
    assert.equal(lines[0], '"Nº","Título","Artista","Estado","Hora","Motivo"', 'header 6 cols intacto');
    assert.ok(lines[1].includes('played'), 'la fila lleva el estado confirmado');
    assert.ok(!/gate/i.test(csv), 'sin columna ni rastro de gate');
  });

  it('void post-gate exporta motivo en la misma fila (triangulate)', () => {
    // Arrange
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.handleDrawClick();
    app.handleRevealGate();
    fake.fireAll();
    // Act
    assert.equal(app.handleVoidRequest(() => 'Archivo dañado', () => true), true);
    const csv = app.buildCsv(core.state.history);
    // Assert
    const lines = csv.slice(1).split('\r\n');
    assert.equal(lines.length, 2, 'una sola fila por sorteo también en void');
    assert.ok(lines[1].includes('Archivo dañado'), 'motivo en la fila');
    assert.ok(!/gate/i.test(csv), 'sin columna de gate');
  });
});

function loadDeps() {
  const core = require(path.join(root, 'js', 'core.js'));
  const draw = require(path.join(root, 'js', 'draw.js'));
  const app = require(path.join(root, 'js', 'app.js'));
  return { core, draw, app };
}

function teardown(app, core) {
  if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
  if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
  if (typeof app._resetGateForTest === 'function') app._resetGateForTest();
  resetState(core);
}

// ---- 1.1 gate flag + predicado (RED) ----
describe('c-17 1.1: gate pendiente tras el commit (RED)', () => {
  let core;
  let draw;
  let app;
  let savedDocument;

  beforeEach(() => {
    ({ core, draw, app } = loadDeps());
    freshSongs(core);
    savedDocument = globalThis.document;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    teardown(app, core);
  });

  it('tras Sortear hay gate pendiente: isAwaitingGate() true, isPublicBuffer() false, sin timer de 5 s', () => {
    // Arrange: dashboard real (stub) + clock mockeado, sin gate previo
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    assert.equal(app.isAwaitingGate(), false, 'sin gate antes del sorteo');
    // Act: el operador sortea (commit-before-render intacto)
    const s = app.handleDrawClick();
    // Assert: gate pendiente, buffer quieto, ningún timer corriendo
    assert.ok(s, 'el sorteo commitea');
    assert.equal(app.isAwaitingGate(), true, 'gate pendiente tras el commit');
    assert.equal(app.isPublicBuffer(), false, 'el timer de 5 s NO arranca en el commit');
    assert.equal(fake.pending.size, 0, 'ningún timer programado en el commit');
  });

  it('el commit (status/current/history/lock) existe antes del primer mensaje de espera', () => {
    // Arrange
    globalThis.document = stubDocument();
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    // Act
    const s = app.handleDrawClick();
    // Assert: commit sincrónico completo (RN-SOR-02 intacto)
    assert.ok(s, 'commit');
    assert.equal(s.status, 'drawn');
    assert.ok(core.state.current, 'current seteado');
    assert.equal(core.state.current.id, s.id);
    assert.equal(core.state.history.length, 1, 'una entrada de historial');
    assert.equal(core.state.history[0].id, s.id);
    assert.equal(core.state.locked, true, 'catálogo bloqueado');
    // Assert: el mensaje de espera por defecto es la fase neutra sin título
    const slot = { v: null };
    const mirror = { setItem(k, v) { slot.v = v; }, getItem() { return slot.v; } };
    app.broadcast(mirror);
    const pub = require(path.join(root, 'js', 'public.js'));
    const back = pub.parseTransportValue(mirror.getItem());
    assert.ok(pub.isStateMessage(back), 'el espejo lleva un state message');
    assert.equal(back.phase, 'awaiting-gate', 'fase de espera neutra por defecto');
    assert.equal(back.current, null, 'sin título en el mensaje de espera');
    assert.equal(back.scrollPool, null, 'sin scrollPool pre-gate');
  });

  it('sin sorteo no hay gate (triangulate)', () => {
    // Arrange: sesión fresca, nada commiteado
    // Act + Assert
    assert.equal(app.isAwaitingGate(), false);
    assert.equal(app.isPublicBuffer(), false);
    assert.equal(app.handleRevealGate(), null, 'revelar sin gate es no-op');
  });
});
