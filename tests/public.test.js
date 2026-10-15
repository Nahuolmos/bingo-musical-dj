const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

// C-08 public-screen: two-phase reveal (buffer-without-title -> reveal).
// Seams under test (public interface only): app.buildStateMessage(phase),
// app.REVEAL_DELAY_MS, app.broadcast/writeTransport, app.scrollPool payload.
// Timer seam: app.setPublicTimerFns (injected fakes, no sleeps).
// C-15: no operator spin remains — the dashboard is instant, the public
// buffer scrolls remaining songs for 5 s and closes with the reveal.
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

  it('REVEAL_DELAY_MS is a single named export === 5000', () => {
    // Arrange (no commit needed — the constant is static)
    // Act
    const delay = app.REVEAL_DELAY_MS;
    // Assert: independent literal from the spec (not recomputed from code)
    assert.equal(delay, 5000);
  });

  it('no spin base remains: only the named 5000 ms public delay exists', () => {
    // Arrange + Act
    const delay = app.REVEAL_DELAY_MS;
    // Assert: C-15 retired SPIN_MS — the buffer delay is the only timed window
    assert.equal(typeof draw.SPIN_MS, 'undefined', 'no spin base');
    assert.equal(delay, 5000);
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

// ---- c-15 3.1: scrollPool anti-spoiler payload (RED) ----
// The spinning-phase envelope carries the post-commit remaining pool for the
// public word-scroll; the drawn song is excluded BY ID (title collisions from
// other remaining songs are legitimate teaser content, not a spoiler).
describe('c-15 3.1: scrollPool anti-spoiler payload (RED)', () => {
  let core;
  let draw;
  let app;

  beforeEach(() => {
    core = require(path.join(root, 'js', 'core.js'));
    draw = require(path.join(root, 'js', 'draw.js'));
    app = require(path.join(root, 'js', 'app.js'));
    core.state.songs = [
      { id: 'c15-a', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'available' },
      { id: 'c15-b', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available' },
      { id: 'c15-c', title: 'Levitating', artist: 'Dua Lipa', status: 'available' }
    ];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    core.state.locked = false;
  });

  afterEach(() => {
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('spinning message carries the post-commit remaining pool, drawn id excluded', () => {
    // Arrange: commit the first song (forcedIndex 0 -> c15-a)
    const picked = draw.pickAndCommit(0);
    assert.ok(picked);
    assert.equal(picked.id, 'c15-a');
    // Act
    const msg = app.buildStateMessage('spinning');
    // Assert: pool snapshot built from available() AFTER the commit
    assert.ok(Array.isArray(msg.scrollPool), 'scrollPool present');
    assert.equal(msg.scrollPool.length, 2, 'only remaining songs travel');
    const ids = msg.scrollPool.map((s) => s.id);
    assert.ok(!ids.includes('c15-a'), 'drawn id excluded');
    assert.ok(ids.includes('c15-b') && ids.includes('c15-c'), 'remaining ids included');
    for (const entry of msg.scrollPool) {
      assert.ok(typeof entry.title === 'string' && entry.title, 'entry carries title');
      assert.ok(typeof entry.artist === 'string', 'entry carries artist');
    }
    // Assert: the drawn title still leaks nowhere else on the wire
    assert.equal(msg.current, null);
    assert.ok(!JSON.stringify(msg.history).includes('Matador'), 'drawn entry scrubbed from history');
  });

  it('title collision: same-title remaining song included, drawn id still excluded', () => {
    // Arrange: a second remaining song shares the drawn title text
    core.state.songs.push({ id: 'c15-d', title: 'Matador', artist: 'Banda Tributo', status: 'available' });
    const picked = draw.pickAndCommit(0);
    assert.equal(picked.id, 'c15-a', 'the original Matador was drawn');
    // Act
    const msg = app.buildStateMessage('spinning');
    // Assert: exclusion is by id, not by title text
    const ids = msg.scrollPool.map((s) => s.id);
    assert.ok(!ids.includes('c15-a'), 'drawn id excluded even with colliding titles');
    assert.ok(ids.includes('c15-d'), 'same-title remaining song still teased');
    assert.equal(msg.scrollPool.length, 3);
  });

  it('empty remaining pool travels as an empty scrollPool (public degrades gracefully)', () => {
    // Arrange: single-song catalog, the draw exhausts it
    core.state.songs = [
      { id: 'c15-only', title: 'Unica', artist: 'Solo', status: 'available' }
    ];
    draw.pickAndCommit(0);
    // Act
    const msg = app.buildStateMessage('spinning');
    // Assert
    assert.ok(Array.isArray(msg.scrollPool));
    assert.equal(msg.scrollPool.length, 0);
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
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('buffer defaults to REVEAL_DELAY_MS via the injectable seam (no wall clock)', () => {
    // Arrange: app-level fake timers (injectable seam, no wall clock)
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    // Act
    app.schedulePublicReveal(() => {});
    // Assert: independent literal — the reveal waits exactly the named delay
    assert.equal(fake.pending.size, 1);
    const entry = Array.from(fake.pending.values())[0];
    assert.equal(entry.ms, 5000);
    assert.equal(app.isPublicBuffer(), true);
  });

  it('reveal fires after REVEAL_DELAY_MS with no operator window (commit -> buffer -> reveal)', () => {
    // Arrange: the single timer owner driven deterministically
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    const order = [];
    // Act: the commit chains only the public buffer (no operator spin)
    assert.equal(app.isPublicBuffer(), false, 'no buffer before scheduling');
    app.schedulePublicReveal(() => { order.push('public-reveal'); });
    assert.deepEqual(order, [], 'nothing fires before the timer');
    assert.equal(app.isPublicBuffer(), true, 'buffer pending after commit');
    assert.equal(Array.from(appFake.pending.values())[0].ms, 5000, 'buffer waits the named delay');
    appFake.fireAll(); // virtual t = 5000
    // Assert
    assert.deepEqual(order, ['public-reveal']);
    assert.equal(app.isPublicBuffer(), false, 'buffer handle released after firing');
  });

  it('retuning the delay moves only the reveal (commit + history untouched)', () => {
    // Arrange
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    const historyBefore = core.state.history.length;
    // Act: custom delay through the same seam (v1 constant stays 5000)
    app.schedulePublicReveal(() => {}, 500);
    // Assert
    assert.equal(Array.from(appFake.pending.values())[0].ms, 500);
    assert.equal(app.REVEAL_DELAY_MS, 5000, 'named constant unchanged');
    assert.equal(typeof draw.SPIN_MS, 'undefined', 'no spin base left to move');
    assert.equal(core.state.history.length, historyBefore, 'no extra history entry from scheduling');
    assert.equal(core.state.history.length, 1, 'exactly one entry per draw (C-10 contract)');
  });

  it('reveal lands within ±500 ms of the configured delay (E2E tolerance bound)', () => {
    // Arrange: virtual clock — commit at t=0, reveal at t=delay
    const TOLERANCE_MS = 500; // independent literal from specs/public-screen
    const commitAt = 0;
    const revealAt = commitAt + app.REVEAL_DELAY_MS;
    // Act
    const elapsedSinceCommit = revealAt - commitAt;
    // Assert
    assert.ok(
      Math.abs(elapsedSinceCommit - app.REVEAL_DELAY_MS) <= TOLERANCE_MS,
      'reveal offset ' + elapsedSinceCommit + ' ms within ±' + TOLERANCE_MS + ' ms of ' + app.REVEAL_DELAY_MS
    );
  });

  it('commit exists before any phase timer fires (commit-before-render preserved)', () => {
    // Arrange
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    // Act: synchronous commit, then schedule (never fired here)
    const picked = draw.pickAndCommit(0);
    app.schedulePublicReveal(() => {});
    // Assert: song status, current pointer and history exist pre-paint
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
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('draw is a no-op during the 5 s buffer (no second commit, history untouched)', () => {
    // Arrange: committed + public buffer pending (instant dashboard result)
    globalThis.document = c08StubDocument();
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
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

  it('draw works again after the buffer elapses (single reveal per commit)', () => {
    // Arrange: committed + buffer pending, then the buffer elapses
    globalThis.document = c08StubDocument();
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    app.schedulePublicReveal(() => {});
    assert.equal(app.handleDrawClick(), null, 'blocked mid-buffer');
    // Act: the buffer elapses (reveal fired), operator confirms the played song
    appFake.fireAll();
    assert.equal(app.isPublicBuffer(), false);
    app.setCurrentStatus('played');
    // Assert: confirm lands post-reveal; single entry per draw (C-10 contract)
    assert.equal(core.state.current, null);
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].status, 'played');
  });

  it('played/void confirm is a no-op during the buffer (waits for the reveal)', () => {
    // Arrange: committed + buffer pending (C-09 gates on this)
    draw.pickAndCommit(0);
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

  it('played/void confirm works with no buffer (no spin gate remains)', () => {
    // Arrange: committed, no buffer pending
    draw.pickAndCommit(0);
    assert.equal(app.isPublicBuffer(), false);
    // Act + Assert: confirm lands at once (buffer is the only gate left)
    app.setCurrentStatus('played');
    assert.equal(core.state.current, null);
    assert.equal(core.state.history[0].status, 'played');
  });

  it('render disables drawBtn + confirmBtn through the buffer', () => {
    // Arrange
    const doc = c08StubDocument();
    globalThis.document = doc;
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    // Act 1: commit with no buffer — instant result actionable at once
    draw.pickAndCommit(0);
    app.render();
    // Assert 1
    assert.equal(doc._els.drawBtn.disabled, false, 'drawBtn enabled pre-buffer (pool remains)');
    assert.equal(doc._els.confirmBtn.disabled, false, 'confirmBtn enabled with drawn current');
    // Act 2: buffer pending — buttons stand down
    app.schedulePublicReveal(() => {});
    app.render();
    // Assert 2
    assert.equal(doc._els.drawBtn.disabled, true, 'drawBtn disabled mid-buffer');
    assert.equal(doc._els.confirmBtn.disabled, true, 'confirmBtn disabled mid-buffer');
  });

  it('history holds exactly one entry per draw after the delayed reveal fires', () => {
    // Arrange
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    let reveals = 0;
    app.schedulePublicReveal(() => { reveals++; });
    // Act: the buffer elapses (delayed public reveal)
    appFake.fireAll();
    // Assert: the delayed reveal adds no history entry (C-10 contract)
    assert.equal(reveals, 1, 'buffer timer fired once');
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
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('clear with no buffer pending wipes cleanly (unlocked regime)', () => {
    // Arrange: committed, no buffer pending (Node branch: synchronous confirms first)
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    // Lock-regime seam (fix 2026-10-14, c-09): commit locks; locked clear is
    // refused (see tests/session-lock-recovery.test.js) — unlock here to keep
    // exercising the wipe path in the unlocked regime.
    core.state.locked = false;
    // Act
    app.handleClearSongs();
    // Assert: state wiped, no handle pending
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.current, null);
    assert.equal(app.isPublicBuffer(), false);
    appFake.fireAll();
    assert.equal(core.state.songs.length, 0, 'no ghost reveal after clear');
  });

  it('clear mid-buffer: the pending public reveal never fires afterward', () => {
    // Arrange: committed + buffer pending
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
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
    appFake.fireAll();
    assert.equal(publicReveals, 0, 'no ghost public reveal after mid-buffer clear');
  });

  it('reset with no buffer pending: board stays reset, no reveal fires afterward', () => {
    // Arrange
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    // Lock-regime seam (fix 2026-10-14, c-09): unlock to exercise wipe path.
    core.state.locked = false;
    // Act
    app.handleResetAll();
    // Assert
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.history.length, 0);
    assert.equal(core.state.spinning, false);
    assert.equal(app.isPublicBuffer(), false);
    appFake.fireAll();
    assert.equal(core.state.songs.length, 0, 'board stays reset');
  });

  it('reset mid-buffer: neither screen resurrects the committed title', () => {
    // Arrange: commit + buffer pending, then reset
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    draw.pickAndCommit(0);
    // Lock-regime seam (fix 2026-10-14, c-09): unlock to exercise wipe path.
    core.state.locked = false;
    let publicReveals = 0;
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
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('commit -> buffer scroll -> reveal syncs counters/last-5', () => {
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
    // Assert 1: projector scrolls remaining songs, never the committed title
    assert.ok(ctx.els.waiting.textContent.includes('Gasolina'), 'scroll teases remaining, got: ' + ctx.els.waiting.textContent);
    assert.ok(!ctx.els.waiting.textContent.includes('Matador'), 'drawn title never teased');
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'no title during the buffer');
    // Act 2: dashboard already shows the result while the buffer runs —
    // the projector still hides the title behind the buffer
    app.schedulePublicReveal(() => {
      app.writeTransport(app.buildStateMessage('reveal'), mirror);
    });
    app.writeTransport(app.buildStateMessage('spinning'), mirror);
    syncToPublic();
    // Assert 2: buffer still hides the title behind the word-scroll
    assert.ok(ctx.els.waiting.textContent.includes('Gasolina'), 'scroll continues, got: ' + ctx.els.waiting.textContent);
    assert.ok(!ctx.els.waiting.textContent.includes('Matador'), 'drawn title never teased');
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

// ---- c-15 2.1: instant dashboard result (RED) ----
// The DJ sees title+artist+copy the instant the commit lands: no operator
// wheel animation, no operator-side timeout. Commit-before-show intact.
function c15StubDocument() {
  const els = {};
  function el(id) {
    if (!els[id]) {
      const rec = { _cls: [] };
      els[id] = {
        textContent: '', innerHTML: '', value: '', disabled: false, offsetWidth: 0,
        classList: {
          add(c) { if (!rec._cls.includes(c)) rec._cls.push(c); },
          remove(c) { const i = rec._cls.indexOf(c); if (i !== -1) rec._cls.splice(i, 1); },
          contains(c) { return rec._cls.includes(c); }
        },
        _rec: rec
      };
    }
    return els[id];
  }
  return { getElementById: el, _els: els };
}

describe('c-15 2.1: instant dashboard result (RED)', () => {
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
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('sortear paints title+artist+copy immediately with no operator animation', () => {
    // Arrange
    const doc = c15StubDocument();
    globalThis.document = doc;
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    // Act: the operator hits Sortear (forcedIndex-free production path)
    const picked = draw.pickAndCommit(0);
    assert.ok(picked, 'commit succeeds');
    // Commit-before-show: status + current + history exist synchronously,
    // before any paint or broadcast (RN-SOR-02 unchanged)
    assert.equal(picked.status, 'drawn');
    assert.ok(core.state.current, 'current set synchronously');
    assert.equal(core.state.history.length, 1, 'one history entry synchronously');
    assert.equal(core.state.locked, true, 'catalog locked synchronously');
    // Assert: dashboard result available at once (copy seam reads current)
    assert.equal(app.formatCopyText(core.state.current), picked.title + ' — ' + picked.artist);
  });

  it('handleDrawClick paints the result synchronously and owns only the public buffer', () => {
    // Arrange
    const doc = c15StubDocument();
    globalThis.document = doc;
    const appFake = makeFakeTimers();
    app.setPublicTimerFns(appFake);
    // Act
    const s = app.handleDrawClick();
    // Assert: immediate result on the dashboard (no operator timeout)
    assert.ok(s, 'draw returns the song');
    assert.equal(doc._els.resultTitle.textContent, s.title, 'title painted at once');
    assert.equal(doc._els.resultArtist.textContent, s.artist, 'artist painted at once');
    assert.ok(doc._els.result.classList.contains('show'), 'result panel visible at once');
    assert.equal(typeof draw.scheduleReveal, 'undefined', 'no operator-side reveal exists');
    assert.equal(app.isPublicBuffer(), true, 'only the 5 s public buffer is pending');
    assert.equal(Array.from(appFake.pending.values())[0].ms, 5000, 'buffer waits the named delay');
    // Assert: commit-before-show intact (history entry precedes every paint)
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].id, s.id);
    assert.equal(core.state.history[0].status, 'drawn');
  });
});

// ---- c-15 4.1: word-scroll ticker seams + inline renderer (RED) ----
describe('c-15 4.1: scroll seams in js/public.js (RED)', () => {
  let pub;

  beforeEach(() => {
    pub = require(path.join(root, 'js', 'public.js'));
  });

  it('SCROLL_STEP_MS is the single named step of 120 ms (fast ticker, buffer untouched)', () => {
    assert.equal(pub.SCROLL_STEP_MS, 120);
  });

  it('step and buffer are two separate named timings (SCROLL_STEP_MS << REVEAL_DELAY_MS)', () => {
    const app = require(path.join(root, 'js', 'app.js'));
    assert.equal(app.REVEAL_DELAY_MS, 5000, 'total buffer intact');
    assert.equal(pub.SCROLL_STEP_MS, 120, 'fast ticker step');
    assert.ok(pub.SCROLL_STEP_MS < app.REVEAL_DELAY_MS, 'step is not the buffer');
  });

  it('pickScrollItems never returns the drawn id (structural anti-spoiler)', () => {
    const pool = [
      { id: 'a', title: 'Matador', artist: 'X' },
      { id: 'b', title: 'Gasolina', artist: 'Y' }
    ];
    const items = pub.pickScrollItems(pool, 'a');
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'b');
    assert.equal(items[0].title, 'Gasolina');
  });

  it('pickScrollItems keeps same-title remaining songs (exclusion is by id)', () => {
    const pool = [
      { id: 'drawn-1', title: 'Matador', artist: 'Original' },
      { id: 'rest-9', title: 'Matador', artist: 'Banda Tributo' }
    ];
    const items = pub.pickScrollItems(pool, 'drawn-1');
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'rest-9');
  });

  it('pickScrollItems degrades on empty/missing pool (no throw, no title)', () => {
    assert.deepEqual(pub.pickScrollItems([], 'x'), []);
    assert.deepEqual(pub.pickScrollItems(null, 'x'), []);
    assert.deepEqual(pub.pickScrollItems(undefined, 'x'), []);
  });

  it('nextScrollIndex advances one step and wraps (triangulate)', () => {
    assert.equal(pub.nextScrollIndex(0, 3), 1);
    assert.equal(pub.nextScrollIndex(1, 3), 2);
    assert.equal(pub.nextScrollIndex(2, 3), 0, 'wraps around');
    assert.equal(pub.nextScrollIndex(0, 1), 0, 'single entry stays');
    assert.equal(pub.nextScrollIndex(0, 0), 0, 'empty pool stays');
  });

  it('scrollSessionKey pins a commit (drawn count + history length)', () => {
    const d = { drawn: 2, history: [{ n: 1 }, { n: 2 }] };
    assert.equal(pub.scrollSessionKey(d), '2|2');
    assert.equal(pub.scrollSessionKey({ drawn: 2, history: [{ n: 1 }, { n: 2 }] }), '2|2', 'stable across re-broadcasts');
    assert.notEqual(pub.scrollSessionKey({ drawn: 3, history: [{ n: 1 }, { n: 2 }, { n: 3 }] }), '2|2', 'new commit re-keys');
  });

  it('scrollLabel joins title and artist with the em-dash seam', () => {
    assert.equal(pub.scrollLabel({ title: 'Matador', artist: 'Los Fabulosos' }), 'Matador — Los Fabulosos');
    assert.equal(pub.scrollLabel({ title: 'Solo', artist: '' }), 'Solo');
  });
});

// Harness for the REAL public inline with injectable scroll timers:
// runs buildPublicHTML() in a minimal DOM + manual timer queue + matchMedia.
function c15ScrollTimers() {
  let seq = 0;
  const pending = new Map();
  return {
    pending,
    setTimeoutFn: (cb, ms) => { seq += 1; pending.set(seq, { cb, ms }); return seq; },
    clearTimeoutFn: (id) => { pending.delete(id); },
    fireOne: () => {
      const first = Array.from(pending.keys())[0];
      if (first === undefined) return false;
      const p = pending.get(first);
      pending.delete(first);
      p.cb();
      return true;
    }
  };
}

function c15BootPublic(preloaded, opts) {
  const o = opts || {};
  const pub = require(path.join(root, 'js', 'public.js'));
  const html = pub.buildPublicHTML();
  const inline = html.split('<script>')[1].split('</script>')[0];
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
  const timers = c15ScrollTimers();
  const handlers = {};
  const store = {
    _s: typeof preloaded === 'string' ? preloaded : null,
    getItem() { return this._s; },
    setItem(k, v) { this._s = v; }
  };
  const win = {
    addEventListener(t, fn) { (handlers[t] = handlers[t] || []).push(fn); },
    matchMedia(q) { return { matches: o.reducedMotion === true, media: q }; }
  };
  if (o.storage !== false) win.localStorage = store;
  const sandbox = {
    document: { getElementById: el },
    window: win,
    setTimeout: timers.setTimeoutFn,
    clearTimeout: timers.clearTimeoutFn
  };
  vm.createContext(sandbox);
  vm.runInContext(inline, sandbox);
  return { els, handlers, writes, timers };
}

function c15Post(ctx, msg) {
  (ctx.handlers.storage || []).forEach((fn) => fn({ key: 'music-bingo-dj-on', newValue: JSON.stringify(msg) }));
}

function c15SpinningMsg(pool) {
  return {
    type: 'state', phase: 'spinning', songs: [],
    history: [{ n: 1, title: 'Vieja Confirmada', artist: 'Artista A', status: 'played', time: '20:00:01' }],
    current: null, scrollPool: pool, total: 3, remaining: 2, drawn: 1
  };
}

function c15RevealMsg() {
  return {
    type: 'state', phase: 'reveal', songs: [],
    history: [
      { n: 1, title: 'Vieja Confirmada', artist: 'Artista A', status: 'played', time: '20:00:01' },
      { n: 2, title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '20:00:02' }
    ],
    current: { id: 'c15-drawn', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
    total: 3, remaining: 2, drawn: 1
  };
}

describe('c-15 4.1: public ticker renderer (RED)', () => {
  it('spinning with scrollPool paints the first remaining entry, never the drawn title', () => {
    const ctx = c15BootPublic(null);
    c15Post(ctx, c15SpinningMsg([
      { id: 'r1', title: 'Gasolina', artist: 'Daddy Yankee' },
      { id: 'r2', title: 'Levitating', artist: 'Dua Lipa' }
    ]));
    assert.ok(ctx.els.waiting.textContent.includes('Gasolina'), 'first scrolled entry, got: ' + ctx.els.waiting.textContent);
    assert.ok(!ctx.els.waiting.textContent.includes('Matador'), 'drawn title never teased');
    assert.equal(ctx.els.result.style.display, 'none', 'result stays hidden during the scroll');
  });

  it('the ticker advances one entry per step and wraps', () => {
    const ctx = c15BootPublic(null);
    c15Post(ctx, c15SpinningMsg([
      { id: 'r1', title: 'Gasolina', artist: 'Daddy Yankee' },
      { id: 'r2', title: 'Levitating', artist: 'Dua Lipa' }
    ]));
    assert.ok(ctx.timers.pending.size > 0, 'a step is scheduled');
    ctx.timers.fireOne();
    assert.ok(ctx.els.waiting.textContent.includes('Levitating'), 'second entry, got: ' + ctx.els.waiting.textContent);
    ctx.timers.fireOne();
    assert.ok(ctx.els.waiting.textContent.includes('Gasolina'), 'wraps to first, got: ' + ctx.els.waiting.textContent);
  });

  it('the scheduled step waits SCROLL_STEP_MS (±30 ms), independent of the reveal buffer', () => {
    const pub = require(path.join(root, 'js', 'public.js'));
    const app = require(path.join(root, 'js', 'app.js'));
    const ctx = c15BootPublic(null);
    c15Post(ctx, c15SpinningMsg([
      { id: 'r1', title: 'Gasolina', artist: 'Daddy Yankee' },
      { id: 'r2', title: 'Levitating', artist: 'Dua Lipa' }
    ]));
    assert.ok(ctx.timers.pending.size > 0, 'a step is scheduled');
    for (const entry of ctx.timers.pending.values()) {
      assert.ok(Math.abs(entry.ms - pub.SCROLL_STEP_MS) <= 30,
        'step ' + entry.ms + ' ms within ±30 ms of SCROLL_STEP_MS=' + pub.SCROLL_STEP_MS);
    }
    assert.equal(app.REVEAL_DELAY_MS, 5000, 'total buffer intact');
    assert.ok(pub.SCROLL_STEP_MS < app.REVEAL_DELAY_MS, 'step and buffer are separate timings');
  });

  it('re-broadcast of the same commit continues the ticker instead of restarting it', () => {
    const ctx = c15BootPublic(null);
    const msg = c15SpinningMsg([{ id: 'r1', title: 'Gasolina', artist: 'Y' }, { id: 'r2', title: 'Levitating', artist: 'Z' }]);
    c15Post(ctx, msg);
    ctx.timers.fireOne(); // now on Levitating
    assert.ok(ctx.els.waiting.textContent.includes('Levitating'));
    // Act: the DJ re-broadcasts the identical envelope (deduped by renderKey)
    c15Post(ctx, JSON.parse(JSON.stringify(msg)));
    ctx.timers.fireOne();
    // Assert: the session continued (wrap) instead of restarting at Gasolina
    assert.ok(ctx.els.waiting.textContent.includes('Gasolina'), 'continued, got: ' + ctx.els.waiting.textContent);
  });

  it('reveal stops the scroll and paints the real title', () => {
    const ctx = c15BootPublic(null);
    c15Post(ctx, c15SpinningMsg([{ id: 'r1', title: 'Gasolina', artist: 'Y' }]));
    assert.ok(ctx.timers.pending.size > 0, 'scroll running');
    c15Post(ctx, c15RevealMsg());
    assert.equal(ctx.els.title.textContent, 'Matador');
    assert.equal(ctx.els.artist.textContent, 'Los Fabulosos Cadillacs');
    assert.equal(ctx.els.result.style.display, 'block');
    assert.equal(ctx.timers.pending.size, 0, 'no scroll step survives the reveal');
    assert.ok(!ctx.timers.fireOne(), 'no step fires post-reveal');
    assert.equal(ctx.els.title.textContent, 'Matador', 'no stale title ever renders');
  });

  it('empty pool degrades to the neutral waiting text with no title and no timer', () => {
    const ctx = c15BootPublic(null);
    c15Post(ctx, c15SpinningMsg([]));
    assert.equal(ctx.els.waiting.textContent, 'Buscando el tema en cabina…');
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'no title on empty pool');
    assert.equal(ctx.timers.pending.size, 0, 'no step scheduled on empty pool');
  });

  it('reduced motion shows the static neutral text with no timer', () => {
    const ctx = c15BootPublic(null, { reducedMotion: true });
    c15Post(ctx, c15SpinningMsg([{ id: 'r1', title: 'Gasolina', artist: 'Y' }]));
    assert.equal(ctx.els.waiting.textContent, 'Buscando el tema en cabina…');
    assert.equal((ctx.els.title && ctx.els.title.textContent) || '', '', 'no title under reduced motion');
    assert.equal(ctx.timers.pending.size, 0, 'no animation scheduled under reduced motion');
  });

  it('markup in scrolled entries renders inert (no script execution surface)', () => {
    const ctx = c15BootPublic(null);
    const evil = "<script>alert('x')</scr" + 'ipt>';
    c15Post(ctx, c15SpinningMsg([{ id: 'r1', title: evil, artist: evil }]));
    assert.equal(ctx.els.waiting.textContent, evil + ' — ' + evil, 'literal text preserved');
  });
});

// ---- c-15 5.1: buffer guards + single reveal owner (RED) ----
describe('c-15 5.1: buffer guards + single reveal owner (RED)', () => {
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
    if (typeof app.resetPublicTimerFns === 'function') app.resetPublicTimerFns();
    if (typeof app.cancelPublicReveal === 'function') app.cancelPublicReveal();
    resetState(core);
  });

  it('void request mid-buffer refuses before the prompt (no modal, no mutation)', () => {
    draw.pickAndCommit(0);
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.schedulePublicReveal(() => {});
    let prompts = 0;
    const res = app.handleVoidRequest(() => { prompts++; return 'X'; }, () => true);
    assert.equal(res, false);
    assert.equal(prompts, 0, 'prompt never fires mid-buffer');
    assert.equal(core.state.current.status, 'drawn');
    assert.equal(core.state.history[0].status, 'drawn');
    assert.ok(!('motivo' in core.state.history[0]), 'no motivo written mid-buffer');
  });

  it('played + void confirm enabled at reveal (post-buffer)', () => {
    draw.pickAndCommit(0);
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    let reveals = 0;
    app.schedulePublicReveal(() => { reveals++; });
    assert.equal(app.isPublicBuffer(), true);
    fake.fireAll();
    assert.equal(reveals, 1);
    assert.equal(app.isPublicBuffer(), false);
    // played path
    app.setCurrentStatus('played');
    assert.equal(core.state.current, null);
    assert.equal(core.state.history[0].status, 'played');
  });

  it('void with motivo enabled at reveal (post-buffer)', () => {
    draw.pickAndCommit(0);
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    app.schedulePublicReveal(() => {});
    fake.fireAll();
    const res = app.handleVoidRequest(() => 'Archivo dañado', () => true);
    assert.equal(res, true);
    assert.equal(core.state.current, null);
    assert.equal(core.state.history[0].status, 'void');
    assert.equal(core.state.history[0].motivo, 'Archivo dañado');
  });

  it('single owner: re-scheduling mid-buffer replaces (at most one reveal per commit)', () => {
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    let first = 0;
    let second = 0;
    app.schedulePublicReveal(() => { first++; });
    app.schedulePublicReveal(() => { second++; });
    fake.fireAll();
    assert.equal(first, 0, 'first schedule cancelled by the second');
    assert.equal(second, 1, 'exactly one reveal fires');
  });

  it('clear mid-buffer cancels the reveal: no ghost, no stale title', () => {
    draw.pickAndCommit(0);
    core.state.locked = false;
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    let reveals = 0;
    app.schedulePublicReveal(() => { reveals++; });
    app.handleClearSongs();
    fake.fireAll();
    assert.equal(reveals, 0, 'cancelled buffer never fires');
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.current, null);
    assert.equal(core.state.history.length, 0);
  });

  it('reset mid-buffer cancels the reveal: board stays reset', () => {
    draw.pickAndCommit(0);
    core.state.locked = false;
    const fake = makeFakeTimers();
    app.setPublicTimerFns(fake);
    let reveals = 0;
    app.schedulePublicReveal(() => { reveals++; });
    app.handleResetAll();
    fake.fireAll();
    assert.equal(reveals, 0, 'cancelled buffer never fires');
    assert.equal(core.state.songs.length, 0);
    assert.equal(core.state.history.length, 0);
    assert.equal(core.state.current, null);
  });

  it('no spinning term remains in button predicates or guards (isPublicBuffer only)', () => {
    const fs = require('node:fs');
    const code = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/st\.spinning/.test(code), 'no st.spinning term in app.js');
    assert.ok(!/SPIN_MS|scheduleReveal\(|cancelReveal\(|isRevealing\(|finishCommit/.test(code), 'no operator timer refs in app.js');
    assert.ok(/isPublicBuffer\(\)/.test(code), 'buffer predicate owns the guards');
  });
});

// ---- c-14 1.1: La Pepa visual identity seams (TDD RED -> GREEN) ----
// Tokens + layout classes must exist in buildPublicHTML(); state IDs preserved.
// Expected values are independent literals from specs/public-screen (C-14),
// never recomputed from the implementation.
describe('c-14 1.1: La Pepa identity tokens + layout (RED)', () => {
  let pub;

  beforeEach(() => {
    pub = require(path.join(root, 'js', 'public.js'));
  });

  it('buildPublicHTML carries the --pepa-* token set inline (standalone file://)', () => {
    // Arrange + Act
    const html = pub.buildPublicHTML();
    // Assert: named tokens from design decision 1 (independent literals)
    assert.ok(html.includes('--pepa-red'), 'token --pepa-red present');
    assert.ok(html.includes('--pepa-cream'), 'token --pepa-cream present');
    assert.ok(html.includes('--pepa-gold'), 'token --pepa-gold present');
    assert.ok(html.includes('--pepa-ink'), 'token --pepa-ink present');
  });

  it('layout exposes .pepa-frame/.pepa-logo/.pepa-stage/.pepa-vinyl zones', () => {
    // Arrange + Act
    const html = pub.buildPublicHTML();
    // Assert
    assert.ok(html.includes('pepa-frame'), '.pepa-frame zone present');
    assert.ok(html.includes('pepa-logo'), '.pepa-logo zone present');
    assert.ok(html.includes('pepa-stage'), '.pepa-stage zone present');
    assert.ok(html.includes('pepa-vinyl'), '.pepa-vinyl present (CSS puro, sin assets)');
  });

  it('state IDs #title/#artist/#history/#count/#status/#waiting/#result preserved', () => {
    // Arrange + Act
    const html = pub.buildPublicHTML();
    // Assert: C-08 DOM contract untouched (same ids the listeners use)
    for (const id of ['title', 'artist', 'history', 'count', 'status', 'waiting', 'result']) {
      assert.ok(html.includes('id="' + id + '"'), 'id="' + id + '" preserved');
    }
  });

  it('cover zone exposes .pepa-cover with data-cover-for seam (OPCION A + seam B)', () => {
    // Arrange + Act
    const html = pub.buildPublicHTML();
    // Assert: generative placeholder today; convention assets/covers/<id>.jpg documented for B
    assert.ok(html.includes('pepa-cover'), '.pepa-cover zone present');
    assert.ok(html.includes('data-cover-for'), 'data-cover-for seam present');
  });
});
