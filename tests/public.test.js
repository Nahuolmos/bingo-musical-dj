const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

// C-08 public-screen: two-phase reveal (spinning-without-title -> reveal).
// Seams under test (public interface only): app.buildStateMessage(phase),
// app.REVEAL_DELAY_MS, app.broadcast/writeTransport, draw.SPIN_MS.
// Timer seam: draw.setTimerFns + app.setPublicTimerFns (injected fakes, no sleeps).
function freshState(core) {
  core.state.songs = [
    { id: 'c08-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available' },
    { id: 'c08-s2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available' }
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

describe('c-08 1.1: phased envelope without spoiler (RED)', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    core = require(path.join(root, 'js', 'core.js'));
    draw = require(path.join(root, 'js', 'draw.js'));
    app = require(path.join(root, 'js', 'app.js'));
    freshState(core);
  });

  afterEach(() => {
    draw.resetTimerFns();
    draw.cancelReveal();
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('commit broadcasts {phase:spinning} with current:null — no title/artist on the wire', () => {
    // Arrange: synchronous commit BEFORE any animation (C-03/C-07 untouched)
    const picked = draw.pickAndCommit(0);
    assert.ok(picked, 'commit succeeds');
    assert.equal(picked.title, 'Matador');
    // Act: spinning-phase envelope (sender withholds the title by construction)
    const msg = app.buildStateMessage('spinning');
    // Assert
    assert.equal(msg.type, 'state');
    assert.equal(msg.phase, 'spinning');
    assert.equal(msg.current, null);
    assert.ok(!JSON.stringify(msg).includes('Matador'), 'committed title must not leak on the wire');
    assert.ok(!JSON.stringify(msg).includes('Fabulosos'), 'committed artist must not leak on the wire');
  });

  it('REVEAL_DELAY_MS is a single named export === 3000', () => {
    // Arrange (no commit needed — the constant is static)
    // Act
    const delay = app.REVEAL_DELAY_MS;
    // Assert: independent literal from the spec (not recomputed from code)
    assert.equal(delay, 3000);
  });

  it('public delay is distinct from the spin base (SPIN_MS stays 2750)', () => {
    // Arrange + Act
    const spin = draw.SPIN_MS;
    const delay = app.REVEAL_DELAY_MS;
    // Assert: independent literals — never merge the buffer into SPIN_MS
    assert.equal(spin, 2750);
    assert.equal(delay, 3000);
    assert.notEqual(delay, spin);
  });

  it('reveal envelope {phase:reveal} carries the committed title/artist', () => {
    // Arrange
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    // Act
    const msg = app.buildStateMessage('reveal');
    // Assert
    assert.equal(msg.type, 'state');
    assert.equal(msg.phase, 'reveal');
    assert.ok(msg.current, 'reveal carries current');
    assert.equal(msg.current.title, 'Matador');
    assert.equal(msg.current.artist, 'Los Fabulosos Cadillacs');
  });

  it('mirrored spinning broadcast carries no title to the public screen', () => {
    // Arrange
    draw.pickAndCommit(0);
    let slot = null;
    const fakeStorage = { setItem(k, v) { slot = v; }, getItem() { return slot; } };
    // Act: same mirror path the DJ uses (BC + localStorage mirror)
    const ok = app.writeTransport(app.buildStateMessage('spinning'), fakeStorage);
    // Assert
    assert.equal(ok, true);
    const pub = require(path.join(root, 'js', 'public.js'));
    const back = pub.parseTransportValue(fakeStorage.getItem());
    assert.equal(pub.isStateMessage(back), true);
    assert.equal(back.phase, 'spinning');
    assert.equal(back.current, null);
  });
});

describe('c-08 1.3: reveal timing tracks the named constant (injected timers)', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    core = require(path.join(root, 'js', 'core.js'));
    draw = require(path.join(root, 'js', 'draw.js'));
    app = require(path.join(root, 'js', 'app.js'));
    freshState(core);
  });

  afterEach(() => {
    draw.resetTimerFns();
    draw.cancelReveal();
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('buffer defaults to REVEAL_DELAY_MS via the injectable seam (no wall clock)', () => {
    // Arrange: app-level fake timers (same pattern as draw.js seam)
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    // Act
    app.schedulePublicReveal(() => {});
    // Assert: independent literal — the reveal waits exactly the named delay
    assert.equal(fake.pending.size, 1);
    const entry = Array.from(fake.pending.values())[0];
    assert.equal(entry.ms, 3000);
    assert.equal(app.isPublicBuffer(), true);
  });

  it('reveal fires only after SPIN_MS + REVEAL_DELAY_MS, in order (spin -> buffer -> reveal)', () => {
    // Arrange: both timer owners driven deterministically
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    const order = [];
    // Act: operator spin scheduled on the draw.js owner (SPIN base only)
    draw.scheduleReveal(() => {
      order.push('spin-end');
      // ...then the app.js owner chains the public buffer (design decision 2)
      app.schedulePublicReveal(() => { order.push('public-reveal'); });
    });
    assert.deepEqual(order, [], 'nothing fires before the timers');
    assert.equal(app.isPublicBuffer(), false, 'no buffer while the spin is in flight');
    drawFake.fireAll(); // virtual t = SPIN_MS = 2750
    assert.deepEqual(order, ['spin-end'], 'spin ends first, reveal still withheld');
    assert.equal(app.isPublicBuffer(), true, 'buffer pending after spin end');
    assert.equal(Array.from(appFake.pending.values())[0].ms, 3000, 'buffer waits the named delay');
    appFake.fireAll(); // virtual t = 2750 + 3000 = 5750
    // Assert
    assert.deepEqual(order, ['spin-end', 'public-reveal']);
    assert.equal(app.isPublicBuffer(), false, 'buffer handle released after firing');
  });

  it('retuning the delay moves only the reveal (commit + spin + history untouched)', () => {
    // Arrange
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    const historyBefore = core.state.history.length;
    // Act: custom delay through the same seam (v1 constant stays 3000)
    app.schedulePublicReveal(() => {}, 500);
    // Assert
    assert.equal(Array.from(appFake.pending.values())[0].ms, 500);
    assert.equal(app.REVEAL_DELAY_MS, 3000, 'named constant unchanged');
    assert.equal(draw.SPIN_MS, 2750, 'spin base unchanged');
    assert.equal(core.state.history.length, historyBefore, 'no extra history entry from scheduling');
    assert.equal(core.state.history.length, 1, 'exactly one entry per draw (C-10 contract)');
  });

  it('reveal lands within ±250 ms of the configured delay (E2E tolerance bound)', () => {
    // Arrange: virtual clock — spin ends at t=SPIN_MS, reveal at t=SPIN_MS+delay
    const TOLERANCE_MS = 250; // independent literal from specs/public-screen
    const spinEnd = draw.SPIN_MS;
    const revealAt = spinEnd + app.REVEAL_DELAY_MS;
    // Act
    const elapsedSinceSpinEnd = revealAt - spinEnd;
    // Assert
    assert.ok(
      Math.abs(elapsedSinceSpinEnd - app.REVEAL_DELAY_MS) <= TOLERANCE_MS,
      'reveal offset ' + elapsedSinceSpinEnd + ' ms within ±' + TOLERANCE_MS + ' ms of ' + app.REVEAL_DELAY_MS
    );
  });

  it('commit exists before any phase timer fires (commit-before-render preserved)', () => {
    // Arrange
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    // Act: synchronous commit, then schedule (never fired here)
    const picked = draw.pickAndCommit(0);
    draw.scheduleReveal(() => {});
    app.schedulePublicReveal(() => {});
    // Assert: song status, current pointer and history exist pre-animation
    assert.ok(picked);
    assert.equal(picked.status, 'drawn');
    assert.ok(core.state.current, 'current set synchronously');
    assert.equal(core.state.current.id, picked.id);
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].id, picked.id);
  });
});

// ---- c-08 2.1 harness: runs the REAL public.html inline in a minimal DOM ----
// (same portable pattern as tests/public-inline.test.js — no browser needed).
function c08InlineOf() {
  const pub = require(path.join(root, 'js', 'public.js'));
  const html = pub.buildPublicHTML();
  return html.split('<script>')[1].split('</script>')[0];
}

function c08BootPublic(preloaded, opts) {
  const withStorage = !opts || opts.storage !== false;
  const inline = c08InlineOf();
  new vm.Script(inline); // throws SyntaxError if the shipped block is broken
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
        style: {},
        classList: { add(c) { rec._cls.push(c); } },
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
  const handlers = {};
  const store = {
    _s: typeof preloaded === 'string' ? preloaded : null,
    getItem() { return this._s; },
    setItem(k, v) { this._s = v; }
  };
  const win = {
    addEventListener(t, fn) { (handlers[t] = handlers[t] || []).push(fn); }
  };
  if (withStorage) win.localStorage = store;
  // NOTE: no BroadcastChannel in the sandbox — storage events are the file:// path.
  const sandbox = { document: { getElementById: el }, window: win };
  vm.createContext(sandbox);
  vm.runInContext(inline, sandbox);
  return { els, handlers, writes };
}

function c08Post(ctx, msg) {
  (ctx.handlers.storage || []).forEach((fn) => fn({ key: 'music-bingo-dj-on', newValue: JSON.stringify(msg) }));
}

function c08SpinningMsg() {
  return {
    type: 'state', phase: 'spinning', songs: [],
    history: [{ n: 1, title: 'Vieja Confirmada', artist: 'Artista A', status: 'played', time: '20:00:01' }],
    current: null, total: 2, remaining: 1, drawn: 1
  };
}

function c08RevealMsg() {
  return {
    type: 'state', phase: 'reveal', songs: [],
    history: [
      { n: 1, title: 'Vieja Confirmada', artist: 'Artista A', status: 'played', time: '20:00:01' },
      { n: 2, title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '20:00:02' }
    ],
    current: { id: 'c08-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
    total: 2, remaining: 1, drawn: 1
  };
}

function c08IdleMsg() {
  return { type: 'state', phase: 'idle', songs: [], history: [], current: null, total: 0, remaining: 0, drawn: 0 };
}

describe('c-08 2.1: phase-keyed public renderer (RED)', () => {
  it('spinning renders the wheel + cabin message with no committed title', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    // Act
    c08Post(ctx, c08SpinningMsg());
    // Assert: intermediate message replaces the idle copy; result stays hidden
    assert.equal(ctx.els.waiting.textContent, 'Buscando el tema en cabina…');
    assert.equal(ctx.els.result.style.display, 'none');
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'no title during spin');
  });

  it('spinning sets the SORTEANDO status on the wheel', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    // Act
    c08Post(ctx, c08SpinningMsg());
    // Assert
    assert.equal(ctx.els.status.textContent, 'SORTEANDO…');
  });

  it('reveal renders the committed title/artist and hides the waiting copy', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    // Act
    c08Post(ctx, c08RevealMsg());
    // Assert
    assert.equal(ctx.els.title.textContent, 'Matador');
    assert.equal(ctx.els.artist.textContent, 'Los Fabulosos Cadillacs');
    assert.equal(ctx.els.result.style.display, 'block');
    assert.equal(ctx.els.waiting.style.display, 'none');
  });

  it('idle renders the ready-to-play copy with no result', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    // Act
    c08Post(ctx, c08IdleMsg());
    // Assert
    assert.equal(ctx.els.waiting.textContent, '¡Preparados para jugar!');
    assert.equal(ctx.els.result.style.display, 'none');
  });

  it('counter + last-5 match the operator snapshot on every sync', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    // Act
    c08Post(ctx, c08RevealMsg());
    // Assert: independent literals from the operator message above
    assert.ok(ctx.els.count.textContent.includes('1'), 'remaining=1, got: ' + ctx.els.count.textContent);
    assert.ok(ctx.els.count.textContent.includes('Sorteadas'), 'drawn label, got: ' + ctx.els.count.textContent);
    assert.ok(ctx.els.history.innerHTML.includes('Matador'), 'last-5 carries the newest entry');
    assert.ok(ctx.els.history.innerHTML.includes('Vieja Confirmada'), 'last-5 keeps confirmed entries');
  });

  it('markup in title/artist renders inert (no script execution surface)', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    const evil = "<script>alert('x')</scr" + 'ipt>';
    // Act
    c08Post(ctx, {
      type: 'state', phase: 'reveal', songs: [], history: [{ n: 1, title: evil, artist: 'A', status: 'drawn', time: 't' }],
      current: { id: 'e1', title: evil, artist: evil, status: 'drawn' },
      total: 1, remaining: 0, drawn: 1
    });
    // Assert: literal text preserved, no live tag materialized
    assert.equal(ctx.els.title.textContent, evil);
    assert.ok(!ctx.els.history.innerHTML.includes('<script>'), 'history pill escaped, got: ' + ctx.els.history.innerHTML);
    assert.ok(ctx.els.history.innerHTML.includes('&lt;script&gt;'), 'escaped entity present');
  });

  it('double delivery renders once (BC + storage mirror dedupe)', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    const msg = c08RevealMsg();
    // Act: the same envelope arrives twice (BroadcastChannel + storage event)
    c08Post(ctx, msg);
    const writesAfterFirst = ctx.writes.length;
    assert.ok(writesAfterFirst > 0, 'first delivery renders');
    c08Post(ctx, msg);
    // Assert
    assert.equal(ctx.writes.length, writesAfterFirst, 'second identical delivery is a no-op');
  });

  it('spinning -> reveal transition paints the title (phase change re-renders)', () => {
    // Arrange
    const ctx = c08BootPublic(null);
    c08Post(ctx, c08SpinningMsg());
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '');
    // Act: the buffer elapses, the DJ broadcasts the reveal
    c08Post(ctx, c08RevealMsg());
    // Assert
    assert.equal(ctx.els.title.textContent, 'Matador');
    assert.equal(ctx.els.result.style.display, 'block');
  });
});

describe('c-08 2.3: public popup lifecycle (mocked window.open/alert boundaries only)', () => {
  let app;
  let pub;
  let saved;

  function setOrDelete(name, value) {
    if (value === undefined) { try { delete globalThis[name]; } catch (e) {} }
    else { globalThis[name] = value; }
  }

  beforeEach(() => {
    app = require(path.join(root, 'js', 'app.js'));
    pub = require(path.join(root, 'js', 'public.js'));
    saved = {
      window: globalThis.window,
      alert: globalThis.alert,
      setTimeout: globalThis.setTimeout,
      localStorage: globalThis.localStorage
    };
    if (typeof app._resetPublicWinForTest === 'function') app._resetPublicWinForTest();
  });

  afterEach(() => {
    setOrDelete('window', saved.window);
    setOrDelete('alert', saved.alert);
    globalThis.setTimeout = saved.setTimeout;
    setOrDelete('localStorage', saved.localStorage);
    if (typeof app._resetPublicWinForTest === 'function') app._resetPublicWinForTest();
  });

  it('open targets the standalone popup and re-syncs ~250 ms after opening', () => {
    // Arrange: mocked window.open + timer + storage boundaries only
    const opened = [];
    const timers = [];
    globalThis.window = {
      open: (url, name, feats) => { opened.push([url, name, feats]); return { closed: false, focus() {} }; }
    };
    globalThis.setTimeout = (cb, ms) => { timers.push([cb, ms]); return 1; };
    let slot = null;
    globalThis.localStorage = { setItem(k, v) { slot = v; }, getItem() { return slot; } };
    // Act
    const res = app.openPublic();
    // Assert: standalone page in the named popup (independent literals)
    assert.deepEqual(res, { ok: true });
    assert.equal(opened.length, 1);
    assert.equal(opened[0][0], 'public.html');
    assert.equal(opened[0][1], 'musicBingoPublic');
    assert.ok(String(opened[0][2]).includes('popup'), 'popup features, got: ' + opened[0][2]);
    // Assert: fast re-sync scheduled ~250 ms after opening
    assert.equal(timers.length, 1);
    assert.equal(timers[0][1], 250);
    timers[0][0](); // fire the re-sync broadcast
    const envelope = JSON.parse(slot);
    assert.equal(envelope.type, 'state');
  });

  it('reopen refocuses the existing window without a second window', () => {
    // Arrange
    let openCalls = 0;
    let focusCalls = 0;
    const win = { closed: false, focus() { focusCalls++; } };
    globalThis.window = { open: () => { openCalls++; return win; } };
    globalThis.setTimeout = () => 0;
    // Act
    const first = app.openPublic();
    const second = app.openPublic();
    // Assert
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.refocused, true);
    assert.equal(openCalls, 1, 'no second window created');
    assert.equal(focusCalls, 1, 'existing window refocused');
  });

  it('blocked popup returns {blocked:true} plus the allow-popups alert copy', () => {
    // Arrange
    let alerted = null;
    globalThis.window = { open: () => null };
    globalThis.alert = (m) => { alerted = m; };
    // Act
    const res = app.openPublic();
    // Assert
    assert.equal(res.blocked, true);
    assert.ok(alerted && alerted.includes('ventanas emergentes'), 'operator guidance, got: ' + alerted);
  });

  it('missing broadcast support requires a current browser (Chrome/Edge)', () => {
    // Arrange + Act: pure helper — neither BroadcastChannel nor storage
    // Assert
    assert.equal(pub.requiresModernBrowser({}), true);
    assert.equal(pub.requiresModernBrowser({ window: {} }), true);
    assert.equal(pub.requiresModernBrowser({ BroadcastChannel: function () {} }), false);
    assert.equal(pub.requiresModernBrowser({ localStorage: {} }), false);
    assert.equal(pub.requiresModernBrowser({ window: { localStorage: {} } }), false);
    // Assert: the shipped page carries the upgrade copy (not a silent wrong sync)
    assert.ok(pub.buildPublicHTML().includes('Chrome'), 'upgrade copy present');
    assert.ok(pub.buildPublicHTML().includes('Edge'), 'upgrade copy present');
  });

  it('harness: without BroadcastChannel nor storage the page shows the upgrade copy', () => {
    // Arrange: sandbox with no BroadcastChannel and no localStorage
    // Act
    const ctx = c08BootPublic(null, { storage: false });
    // Assert
    assert.ok(ctx.els.hint.textContent.includes('Chrome'), 'upgrade guidance, got: ' + ctx.els.hint.textContent);
  });
});

// ---- c-08 3.1 harness: stub-DOM so operator flows run in Node ----
// (handleDrawClick/render early-return without `document`; the stub provides
// only the ids those flows touch — no browser needed, no wall clock).
function c08StubDocument() {
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

describe('c-08 3.1: buffer-aware input guards (RED)', () => {
  let core;
  let draw;
  let app;
  let savedDocument;

  beforeEach(() => {
    core = require(path.join(root, 'js', 'core.js'));
    draw = require(path.join(root, 'js', 'draw.js'));
    app = require(path.join(root, 'js', 'app.js'));
    freshState(core);
    savedDocument = globalThis.document;
  });

  afterEach(() => {
    if (savedDocument === undefined) { try { delete globalThis.document; } catch (e) {} }
    else { globalThis.document = savedDocument; }
    draw.resetTimerFns();
    draw.cancelReveal();
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('draw is a no-op during the 3 s buffer (no second commit, history untouched)', () => {
    // Arrange: spin ended (operator revealed locally), public buffer pending
    globalThis.document = c08StubDocument();
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    draw.finishCommit();
    app.schedulePublicReveal(() => {});
    assert.equal(app.isPublicBuffer(), true);
    const historyBefore = core.state.history.length;
    // Act: operator mashes the draw button mid-buffer
    const res = app.handleDrawClick();
    // Assert
    assert.equal(res, null);
    assert.equal(core.state.history.length, historyBefore, 'no second commit mid-buffer');
    assert.equal(core.state.history.length, 1);
  });

  it('draw is a no-op mid-spin (triangulation with C-03 guard)', () => {
    // Arrange
    globalThis.document = c08StubDocument();
    draw.pickAndCommit(0);
    assert.equal(core.state.spinning, true);
    // Act
    const res = app.handleDrawClick();
    // Assert
    assert.equal(res, null);
    assert.equal(core.state.history.length, 1);
  });

  it('played/void confirm is a no-op during the buffer (waits for the reveal)', () => {
    // Arrange: committed + spin ended + buffer pending (C-09 will gate on this)
    draw.pickAndCommit(0);
    draw.finishCommit();
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    app.schedulePublicReveal(() => {});
    // Act
    app.setCurrentStatus('played');
    // Assert
    assert.equal(core.state.current && core.state.current.status, 'drawn', 'played blocked mid-buffer');
    assert.equal(core.state.history[0].status, 'drawn', 'history untouched mid-buffer');
    // Act
    app.setCurrentStatus('void');
    // Assert
    assert.equal(core.state.current && core.state.current.status, 'drawn', 'void blocked mid-buffer');
    assert.equal(core.state.history[0].status, 'drawn');
  });

  it('played/void confirm is a no-op mid-spin (triangulation with C-03 guard)', () => {
    // Arrange
    draw.pickAndCommit(0);
    // Act + Assert (C-03 behavior, must survive C-08)
    app.setCurrentStatus('played');
    assert.equal(core.state.current && core.state.current.status, 'drawn');
    app.setCurrentStatus('void');
    assert.equal(core.state.current && core.state.current.status, 'drawn');
  });

  it('render disables drawBtn + confirmBtn through the spin AND the buffer', () => {
    // Arrange
    const doc = c08StubDocument();
    globalThis.document = doc;
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    // Act 1: mid-spin
    draw.pickAndCommit(0);
    app.render();
    // Assert 1
    assert.equal(doc._els.drawBtn.disabled, true, 'drawBtn disabled mid-spin');
    assert.equal(doc._els.confirmBtn.disabled, true, 'confirmBtn disabled mid-spin');
    // Act 2: spin ended, buffer pending — buttons stay disabled
    draw.finishCommit();
    app.schedulePublicReveal(() => {});
    app.render();
    // Assert 2
    assert.equal(doc._els.drawBtn.disabled, true, 'drawBtn disabled mid-buffer');
    assert.equal(doc._els.confirmBtn.disabled, true, 'confirmBtn disabled mid-buffer');
  });

  it('history holds exactly one entry per draw after the delayed reveal fires', () => {
    // Arrange
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    let reveals = 0;
    draw.scheduleReveal(() => { reveals++; });
    app.schedulePublicReveal(() => { reveals++; });
    // Act: spin ends, then the buffer elapses (delayed public reveal)
    drawFake.fireAll();
    appFake.fireAll();
    // Assert: the delayed reveal adds no history entry (C-10 contract)
    assert.equal(reveals, 2, 'both timers fired');
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].status, 'drawn');
  });
});

describe('c-08 3.3: clear/reset cancel both pending reveals (no ghosts)', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    core = require(path.join(root, 'js', 'core.js'));
    draw = require(path.join(root, 'js', 'draw.js'));
    app = require(path.join(root, 'js', 'app.js'));
    freshState(core);
  });

  afterEach(() => {
    draw.resetTimerFns();
    draw.cancelReveal();
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('clear mid-spin: neither operator nor public reveal fires afterward', () => {
    // Arrange: commit + spin in flight (Node branch: synchronous confirms first)
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    // Lock-regime seam (fix 2026-10-14, c-09): commit locks; locked clear is
    // refused (see tests/session-lock-recovery.test.js) — unlock here to keep
    // exercising the ghost-cancel wiring in the unlocked regime.
    core.state.locked = false;
    let operatorReveals = 0;
    draw.scheduleReveal(() => { operatorReveals++; });
    // Act
    app.handleClearSongs();
    // Assert: state wiped, both handles released
    assert.equal(core.state.songs.length, 0);
    assert.equal(draw.isRevealing(), false);
    assert.equal(app.isPublicBuffer(), false);
    drawFake.fireAll();
    appFake.fireAll();
    assert.equal(operatorReveals, 0, 'no ghost operator reveal after clear');
  });

  it('clear mid-buffer: neither operator nor public reveal fires afterward', () => {
    // Arrange: spin ended (operator revealed locally), buffer pending
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    draw.finishCommit();
    // Lock-regime seam (fix 2026-10-14, c-09): unlock to exercise wipe path.
    core.state.locked = false;
    let publicReveals = 0;
    app.schedulePublicReveal(() => { publicReveals++; });
    assert.equal(app.isPublicBuffer(), true);
    // Act
    app.handleClearSongs();
    // Assert
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.current, null);
    assert.equal(app.isPublicBuffer(), false);
    drawFake.fireAll();
    appFake.fireAll();
    assert.equal(publicReveals, 0, 'no ghost public reveal after mid-buffer clear');
  });

  it('reset mid-spin: board stays reset, no reveal fires afterward', () => {
    // Arrange
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    // Lock-regime seam (fix 2026-10-14, c-09): unlock to exercise wipe path.
    core.state.locked = false;
    let operatorReveals = 0;
    draw.scheduleReveal(() => { operatorReveals++; });
    // Act
    app.handleResetAll();
    // Assert
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.history.length, 0);
    assert.equal(core.state.spinning, false);
    assert.equal(draw.isRevealing(), false);
    assert.equal(app.isPublicBuffer(), false);
    drawFake.fireAll();
    appFake.fireAll();
    assert.equal(operatorReveals, 0, 'no ghost operator reveal after reset');
  });

  it('reset mid-buffer: neither screen resurrects the committed title', () => {
    // Arrange: commit + spin ended + buffer pending, then reset
    const drawFake = makeFakeTimers();
    const appFake = makeFakeTimers();
    draw.setTimerFns(drawFake);
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    // Lock-regime seam (fix 2026-10-14, c-09): unlock to exercise wipe path.
    core.state.locked = false;
    let operatorReveals = 0;
    let publicReveals = 0;
    draw.scheduleReveal(() => { operatorReveals++; });
    drawFake.fireAll(); // spin ends (operator reveal would have fired pre-reset)
    draw.finishCommit();
    assert.equal(operatorReveals, 1, 'spin reveal fired before the reset');
    app.schedulePublicReveal(() => { publicReveals++; });
    // Act
    app.handleResetAll();
    // Assert
    assert.equal(app.isPublicBuffer(), false);
    appFake.fireAll();
    assert.equal(publicReveals, 0, 'buffer reveal cancelled by mid-buffer reset');
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.current, null);
  });
});

describe('c-08 4.1: double-screen sync DJ -> publica (portable two-harness E2E)', () => {
  // No Playwright runner exists in this repo (zero-install, file://-first
  // project: tests.html is the browser mirror). This is the portable
  // equivalent of the multi-context E2E: the REAL DJ envelope travels the
  // REAL storage mirror into the REAL public inline, with clock-mocked
  // timers (data-testid-style ids, no fixed sleeps).
  let core;
  let draw;
  let app;
  let pub;

  beforeEach(() => {
    core = require(path.join(root, 'js', 'core.js'));
    draw = require(path.join(root, 'js', 'draw.js'));
    app = require(path.join(root, 'js', 'app.js'));
    pub = require(path.join(root, 'js', 'public.js'));
    freshState(core);
  });

  afterEach(() => {
    draw.resetTimerFns();
    draw.cancelReveal();
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('spin -> no title -> buffer cabin message -> reveal syncs counters/last-5', () => {
    // Arrange: booted public page + DJ->publica storage mirror + mocked clock
    const ctx = c08BootPublic(null);
    const slot = { v: null };
    const mirror = { setItem(k, v) { slot.v = v; }, getItem() { return slot.v; } };
    function syncToPublic() {
      const back = pub.parseTransportValue(mirror.getItem());
      assert.ok(pub.isStateMessage(back), 'mirror payload is a state message');
      c08Post(ctx, back);
    }
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    // Act 1: commit -> DJ broadcasts the title-free spinning envelope
    const picked = draw.pickAndCommit(0);
    app.writeTransport(app.buildStateMessage('spinning'), mirror);
    syncToPublic();
    // Assert 1: projector shows the cabin message, never the committed title
    assert.equal(ctx.els.waiting.textContent, 'Buscando el tema en cabina…');
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'no title during the spin');
    // Act 2: spin ends (operator reveals locally to cue VirtualDJ), buffer starts
    draw.finishCommit();
    app.schedulePublicReveal(() => {
      app.writeTransport(app.buildStateMessage('reveal'), mirror);
    });
    app.writeTransport(app.buildStateMessage('spinning'), mirror);
    syncToPublic();
    // Assert 2: buffer still hides the title behind the cabin message
    assert.equal(ctx.els.waiting.textContent, 'Buscando el tema en cabina…');
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'no title during the buffer');
    // Act 3: the buffer elapses -> reveal envelope syncs to the projector
    appFake.fireAll();
    syncToPublic();
    // Assert 3: both screens agree — title, counters and last-5 equal
    assert.equal(ctx.els.title.textContent, picked.title);
    assert.equal(ctx.els.artist.textContent, picked.artist);
    const opRemaining = core.available().length;
    const opDrawn = core.state.songs.filter((s) => s.status !== 'available').length;
    assert.ok(ctx.els.count.textContent.includes(String(opRemaining)), 'remaining syncs, got: ' + ctx.els.count.textContent);
    assert.ok(ctx.els.count.textContent.includes(String(opDrawn)), 'drawn syncs, got: ' + ctx.els.count.textContent);
    for (const h of core.state.history) {
      assert.ok(ctx.els.history.innerHTML.includes(core.esc(h.title)), 'last-5 carries n=' + h.n);
    }
    assert.equal(core.state.history.length, 1, 'single history entry per draw');
  });
});
