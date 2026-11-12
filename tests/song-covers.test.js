const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');

function fresh() {
  for (const m of ['core.js', 'import.js', 'draw.js', 'store.js', 'public.js', 'app.js']) {
    delete require.cache[require.resolve(path.join(root, 'js', m))];
  }
  const core = require(path.join(root, 'js', 'core.js'));
  const imp = require(path.join(root, 'js', 'import.js'));
  const store = require(path.join(root, 'js', 'store.js'));
  const pub = require(path.join(root, 'js', 'public.js'));
  const app = require(path.join(root, 'js', 'app.js'));
  core.state.songs = [];
  core.state.history = [];
  core.state.current = null;
  core.state.spinning = false;
  core.state.locked = false;
  return { core, imp, store, pub, app };
}

function memStorage() {
  let slot = null;
  return {
    getItem() { return slot; },
    setItem(k, v) { slot = String(v); },
    removeItem() { slot = null; },
    _slot() { return slot; },
  };
}

function itunesFetch(results) {
  return () => Promise.resolve({ ok: true, json: () => Promise.resolve({ results }) });
}

function deezerFetch(data) {
  return () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
}

describe('c-16 1.1: Song carries coverUrl null, schemaVersion 2', () => {
  it('createSong exposes coverUrl null by default', () => {
    const { core } = fresh();
    const s = core.createSong('Gasolina', 'Daddy Yankee');
    assert.equal(s.coverUrl, null);
    assert.equal(s.status, 'available');
  });

  it('createSession and shared state carry schemaVersion 2', () => {
    const { core } = fresh();
    assert.equal(core.createSession().schemaVersion, 2);
    assert.equal(core.state.schemaVersion, 2);
  });

  it('normalizeLine, parseText and buildDemoSongs emit coverUrl null', () => {
    const { imp, app } = fresh();
    assert.equal(imp.normalizeLine('Shakira - Hips Don\'t Lie').coverUrl, null);
    assert.equal(imp.parseText('Queen,Don\'t Stop Me Now')[0].coverUrl, null);
    assert.equal(imp.parseText('Dua Lipa;Levitating')[0].coverUrl, null);
    assert.ok(app.buildDemoSongs().length === 12);
    for (const s of app.buildDemoSongs()) assert.equal(s.coverUrl, null);
  });
});

describe('c-16 1.2: store migrates v1 covers to null, rejects future', () => {
  it('v1 snapshot restores list+history+locked with covers null', () => {
    const { store } = fresh();
    const st = memStorage();
    st.setItem('mbdj.v1', JSON.stringify({
      songs: [{ id: 's1', title: 'Matador', artist: 'LFC', status: 'available' }],
      history: [{ n: 1, id: 's1', title: 'Matador', artist: 'LFC', status: 'drawn', time: '21:15:03' }],
      current: null, locked: true, startedAt: 'x', savedAt: 'y', schemaVersion: 1,
    }));
    const back = store.load(st);
    assert.equal(back.ok, true);
    assert.equal(back.snapshot.songs[0].coverUrl, null);
    assert.equal(back.snapshot.locked, true);
    assert.equal(back.snapshot.history.length, 1);
  });

  it('v99 stays corrupt, save writes schemaVersion 2', () => {
    const { store } = fresh();
    const st = memStorage();
    st.setItem('mbdj.v1', JSON.stringify({ songs: [], history: [], current: null, locked: false, startedAt: 'x', savedAt: 'y', schemaVersion: 99 }));
    assert.equal(store.load(st).reason, 'corrupt');
    const st2 = memStorage();
    assert.equal(store.save({ songs: [], history: [], current: null, locked: false, startedAt: 'x' }, st2).ok, true);
    assert.equal(JSON.parse(st2._slot()).schemaVersion, 2);
    assert.equal(store.SCHEMA_VERSION, 2);
  });
});

describe('c-16 2.1: resolveCoverURL best-effort with mocked fetch', () => {
  it('match stores 600 artwork URL', async () => {
    const { imp } = fresh();
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      itunesFetch([{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100bb.jpg' }])
    );
    assert.equal(url, 'https://x/600x600bb.jpg');
  });

  it('prefers the exact-insensitive match over the first result', async () => {
    const { imp } = fresh();
    const url = await imp.resolveCoverURL(
      { title: 'Matador', artist: 'Los Fabulosos Cadillacs' },
      itunesFetch([
        { trackName: 'Otro Tema', artistName: 'Otra Banda', artworkUrl100: 'https://x/100x100a.jpg' },
        { trackName: 'matador', artistName: 'los fabulosos cadillacs', artworkUrl100: 'https://x/100x100b.jpg' },
      ])
    );
    assert.equal(url, 'https://x/600x600b.jpg');
  });

  it('no match, throw, timeout and missing fetch all resolve null', async () => {
    const { imp } = fresh();
    assert.equal(await imp.resolveCoverURL({ title: 'Zzz', artist: 'Yyy' }, itunesFetch([])), null);
    assert.equal(await imp.resolveCoverURL({ title: 'A', artist: 'B' }, () => { throw new Error('offline'); }), null);
    assert.equal(await imp.resolveCoverURL({ title: 'A', artist: 'B' }, null), null);
    assert.equal(await imp.resolveCoverURL({ title: '', artist: 'B' }, itunesFetch([])), null);
    // Pre-show tuning: default timeout is 12 s + 1 retry, so the hang case
    // uses injected opts to stay fast (fast-timeout seam, same code path).
    const hang = () => new Promise(() => {});
    let hangCalls = 0;
    const countingHang = () => { hangCalls++; return hang(); };
    assert.equal(await imp.resolveCoverURL({ title: 'A', artist: 'B' }, countingHang, { timeoutMs: 30, retries: 1 }), null);
    // Deezer (transient) → iTunes simple (transient ×2 con 1 reintento)
    assert.equal(hangCalls, 3);
  });

  it('enrichCovers is sequential and idempotent, null without fetch', async () => {
    const { imp } = fresh();
    const songs = [
      { title: 'Gasolina', artist: 'Daddy Yankee', coverUrl: null },
      { title: 'Keep', artist: 'K', coverUrl: 'https://keep.jpg' },
    ];
    const rep = await imp.enrichCovers(
      songs,
      itunesFetch([{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100bb.jpg' }])
    );
    assert.deepEqual(rep, { resolved: 1, total: 2 });
    assert.equal(songs[0].coverUrl, 'https://x/600x600bb.jpg');
    assert.equal(songs[1].coverUrl, 'https://keep.jpg');
    const rep2 = await imp.enrichCovers([{ title: 'A', coverUrl: null }], null);
    assert.deepEqual(rep2, { resolved: 0, total: 1 });
  });
});

describe('c-16 2.2: paste/demo/file enrich post-import, locked resolves nothing', () => {
  it('online paste resolves covers with counts intact', async () => {
    const { core, app } = fresh();
    const r = app.handlePasteImport(
      'Vilma Palma e Vampiros - La Pachanga',
      itunesFetch([{ trackName: 'La Pachanga', artistName: 'Vilma Palma e Vampiros', artworkUrl100: 'https://x/100x100bb.jpg' }])
    );
    assert.equal(r.added, 1);
    assert.match(r.message, /1.*nueva\(s\)/);
    const rep = await r.covers;
    assert.equal(rep.resolved, 1);
    assert.equal(core.state.songs[0].coverUrl, 'https://x/600x600bb.jpg');
    assert.match(r.message, /Tapas resueltas: 1\/1/);
  });

  it('offline paste imports coverless with a visible note', async () => {
    const { core, app } = fresh();
    const r = app.handlePasteImport('Soda Stereo - De Musica Ligera');
    assert.equal(r.added, 1);
    await r.covers;
    assert.equal(core.state.songs[0].coverUrl, null);
    assert.match(r.message, /Tapas omitidas \(sin conexi/);
    assert.match(r.message, /1.*nueva\(s\)/);
  });

  it('locked paste/demo issue zero fetches with BLOCKED_MESSAGE', async () => {
    const { core, app } = fresh();
    core.state.locked = true;
    let calls = 0;
    const counting = () => { calls++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }); };
    try {
      const rp = app.handlePasteImport('A - B', counting);
      assert.equal(rp.blocked, true);
      assert.equal(rp.message, app.BLOCKED_MESSAGE);
      const rd = app.handleDemoImport(counting);
      assert.equal(rd.blocked, true);
      assert.equal(calls, 0);
      assert.equal(core.state.songs.length, 0);
    } finally {
      core.state.locked = false;
    }
  });

  it('file seam resolves covers online with the same contract', async () => {
    const { core, app } = fresh();
    const r = app.handleFileSongs(
      [{ id: 'f1', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available', coverUrl: null }],
      'lista.csv',
      itunesFetch([{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100bb.jpg' }])
    );
    assert.equal(r.added, 1);
    await r.covers;
    assert.equal(core.state.songs[0].coverUrl, 'https://x/600x600bb.jpg');
  });
});

describe('c-16 3.1: manual cover field with lock gate and XSS rejection', () => {
  it('normalizeCoverValue: clear, remote, local, rejections', () => {
    const { app } = fresh();
    assert.deepEqual(app.normalizeCoverValue('   '), { ok: true, value: null, cleared: true });
    assert.equal(app.normalizeCoverValue('https://x.com/a.jpg').value, 'https://x.com/a.jpg');
    assert.equal(app.normalizeCoverValue('tapa.png').value, 'assets/covers/tapa.png');
    assert.equal(app.normalizeCoverValue('javascript:alert(1)').ok, false);
    assert.equal(app.normalizeCoverValue('data:image/png;base64,x').ok, false);
    assert.equal(app.normalizeCoverValue('<script>x</script>').ok, false);
    assert.equal(app.normalizeCoverValue('sub/dir.png').ok, false);
    assert.equal(app.normalizeCoverValue('..\\x.png').ok, false);
  });

  it('set, local, clear persist; invalid and XSS never mutate', () => {
    const { core, app } = fresh();
    core.state.songs = [{ id: 's1', title: 'T', artist: 'A', status: 'available', coverUrl: null }];
    const st = memStorage();
    assert.equal(app.handleCoverRequest('s1', 'https://x.com/a.jpg', { storage: st }).ok, true);
    assert.equal(core.state.songs[0].coverUrl, 'https://x.com/a.jpg');
    assert.ok(st._slot().includes('x.com'), 'persisted via autosave seam');
    assert.equal(app.handleCoverRequest('s1', 'tapa.png', { storage: st }).ok, true);
    assert.equal(core.state.songs[0].coverUrl, 'assets/covers/tapa.png');
    assert.equal(app.handleCoverRequest('s1', '  ', { storage: st }).ok, true);
    assert.equal(core.state.songs[0].coverUrl, null);
    assert.equal(app.handleCoverRequest('s1', 'javascript:alert(1)', { storage: st }).ok, false);
    assert.equal(app.handleCoverRequest('s1', '<img src=x onerror=alert(1)>', { storage: st }).ok, false);
    assert.equal(core.state.songs[0].coverUrl, null);
    assert.equal(app.handleCoverRequest('missing', 'https://x.com/a.jpg', { storage: st }).reason, 'not-found');
  });

  it('locked cover request is refused with zero mutation', () => {
    const { core, app } = fresh();
    core.state.songs = [{ id: 's1', title: 'T', artist: 'A', status: 'available', coverUrl: null }];
    core.state.locked = true;
    try {
      const r = app.handleCoverRequest('s1', 'https://x.com/a.jpg');
      assert.equal(r.blocked, true);
      assert.equal(r.message, app.BLOCKED_MESSAGE);
      assert.equal(r.message, 'Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.');
      assert.equal(core.state.songs[0].coverUrl, null);
    } finally {
      core.state.locked = false;
    }
  });
});

describe('c-16 3.2: row renders input+Fijar+preview, disabled when locked', () => {
  let savedDocument;
  beforeEach(() => { savedDocument = global.document; });
  afterEach(() => {
    if (savedDocument === undefined) delete global.document;
    else global.document = savedDocument;
  });

  function renderWith(state) {
    const { core, app } = fresh();
    core.state.songs = state.songs;
    core.state.history = [];
    core.state.current = null;
    core.state.locked = state.locked;
    const els = {};
    function mk(id) {
      if (!els[id]) els[id] = { textContent: '', innerHTML: '', value: '', disabled: false, style: {}, classList: { add() {}, remove() {} }, addEventListener() {} };
      return els[id];
    }
    global.document = { getElementById: mk };
    app.render();
    return els.songList.innerHTML;
  }

  it('unlocked row shows escaped value, preview image and placeholder', () => {
    const html = renderWith({
      locked: false,
      songs: [
        { id: 's1', title: 'T', artist: 'A', status: 'available', addedAt: 'x', coverUrl: 'https://x.com/a.jpg' },
        { id: 's2', title: 'U', artist: 'B', status: 'available', addedAt: 'x', coverUrl: null },
      ],
    });
    assert.ok(html.includes('data-cover-for="s1"'), 'input per row');
    assert.ok(html.includes('data-cover-set="s2"'), 'Fijar per row');
    assert.ok(html.includes('value="https://x.com/a.jpg"'), 'escaped value');
    assert.ok(html.includes('coverthumb'), 'image preview');
    assert.ok(html.includes('coverph'), 'placeholder for coverless');
    assert.ok(!html.includes('disabled'), 'no disable when unlocked');
  });

  it('locked row disables every cover control', () => {
    const html = renderWith({
      locked: true,
      songs: [{ id: 's1', title: 'T', artist: 'A', status: 'available', addedAt: 'x', coverUrl: null }],
    });
    const n = (html.match(/disabled/g) || []).length;
    assert.ok(n >= 2, 'input+Fijar disabled, got ' + n);
  });
});

describe('c-16 4.1/4.2: public cover prefers image, spinning scrubs artwork', () => {
  it('coverUrl yields image with identical hue/initial, null keeps C-14 placeholder', () => {
    const { pub } = fresh();
    const plain = pub.coverFor({ id: 'c16-1', title: 'Matador' });
    const img = pub.coverFor({ id: 'c16-1', title: 'Matador', coverUrl: 'https://x.com/a.jpg' });
    assert.equal(plain.kind, 'placeholder');
    assert.equal(img.kind, 'image');
    assert.equal(img.src, 'https://x.com/a.jpg');
    assert.equal(img.background, plain.background);
    assert.equal(img.initial, 'M');
    assert.equal(pub.coverFor({ id: 'c16-1', title: 'Matador', coverUrl: '  ' }).kind, 'placeholder');
    assert.equal(pub.coverFor(null).kind, 'placeholder');
  });

  it('inline mirror matches module behavior and parses without SyntaxError', () => {
    const { pub } = fresh();
    const inline = pub.buildPublicHTML().split('<script>')[1].split('</script>')[0];
    assert.doesNotThrow(() => { new vm.Script(inline); });
    const sandbox = { document: { getElementById: () => null }, window: { addEventListener() {}, localStorage: null } };
    vm.createContext(sandbox);
    vm.runInContext(inline + '\nthis.__c16 = { a: coverForInline({id:"c16-1",title:"Matador",coverUrl:"https://x.com/a.jpg"}), b: coverForInline({id:"c16-1",title:"Matador"}) };', sandbox);
    assert.equal(sandbox.__c16.a.kind, 'image');
    assert.equal(sandbox.__c16.a.src, 'https://x.com/a.jpg');
    assert.equal(sandbox.__c16.b.kind, 'placeholder');
    assert.equal(sandbox.__c16.a.background, sandbox.__c16.b.background);
  });

  it('spinning never exposes committed artwork, reveal carries it', () => {
    const { core, app } = fresh();
    const draw = require(path.join(root, 'js', 'draw.js'));
    core.state.songs = [
      { id: 's1', title: 'Matador', artist: 'LFC', status: 'available', addedAt: 'x', coverUrl: 'https://x.com/committed.jpg' },
      { id: 's2', title: 'Gasolina', artist: 'DY', status: 'available', addedAt: 'x', coverUrl: null },
    ];
    draw.pickAndCommit(0);
    const spin = app.buildStateMessage('spinning');
    assert.equal(spin.current, null);
    assert.equal(spin.songs.find((s) => s.id === 's1').coverUrl, null);
    assert.ok(!JSON.stringify(spin).includes('committed.jpg'));
    const rev = app.buildStateMessage('reveal');
    assert.equal(rev.current.coverUrl, 'https://x.com/committed.jpg');
  });
});

describe('c-16 5.1: CSV stays six-column, delay and show path untouched', () => {
  it('export with covers set is still BOM + six header columns', () => {
    const { app } = fresh();
    const csv = app.buildCsv([
      { n: 1, title: 'Matador', artist: 'LFC', status: 'played', time: '21:15:03', motivo: '' },
    ]);
    assert.equal(csv.charAt(0), '﻿');
    const header = csv.slice(1).split('\r\n')[0];
    assert.equal(header, '"Nº","Título","Artista","Estado","Hora","Motivo"');
  });

  it('REVEAL_DELAY_MS is still 5000 and show paths issue zero cover fetch', () => {
    const { app } = fresh();
    assert.equal(app.REVEAL_DELAY_MS, 5000);
    for (const fn of ['buildStateMessage', 'broadcast', 'handleDrawClick', 'schedulePublicReveal', 'render', 'setCurrentStatus']) {
      assert.ok(!/fetch\s*\(/.test(String(app[fn].toString())), fn + ' issues no cover fetch');
    }
    const drawSrc = fs.readFileSync(path.join(root, 'js', 'draw.js'), 'utf8');
    assert.ok(!/fetch\s*\(/.test(drawSrc), 'draw.js has no fetch');
    const pubSrc = fs.readFileSync(path.join(root, 'js', 'public.js'), 'utf8');
    assert.ok(!/fetch\s*\(/.test(pubSrc), 'public.js has no fetch');
    const impSrc = fs.readFileSync(path.join(root, 'js', 'import.js'), 'utf8');
    const urls = impSrc.match(/https?:\/\/[^\s'"]+/g) || [];
    for (const u of urls) {
      assert.ok(
        u.indexOf('https://itunes.apple.com') === 0 ||
        u.indexOf('https://api.deezer.com') === 0 ||
        u.indexOf('https://api.allorigins.win') === 0,
        'import remote allowlist: ' + u
      );
    }
  });
});

describe('c-16 bugfix demo-covers: relaxed match (quotes + parentheticals)', () => {
  function payload(results) {
    return () => Promise.resolve({ ok: true, json: () => Promise.resolve({ results }) });
  }

  it('same-artist parenthetical beats a wrong-artist first result', async () => {
    const { imp } = fresh();
    const url = await imp.resolveCoverURL(
      { title: 'La Pachanga', artist: 'Vilma Palma e Vampiros' },
      payload([
        { trackName: 'La Pachanga', artistName: 'Otra Banda', artworkUrl100: 'https://wrong/100x100w.jpg' },
        { trackName: 'La Pachanga (Remasterizaci\u00f3n 2022)', artistName: 'Vilma Palma e Vampiros', artworkUrl100: 'https://right/100x100r.jpg' },
      ])
    );
    assert.equal(url, 'https://right/600x600r.jpg');
  });

  it('curly-quote title plus feat parenthetical still matches its artist', async () => {
    const { imp } = fresh();
    const url = await imp.resolveCoverURL(
      { title: 'Hips Don\u2019t Lie', artist: 'Shakira' },
      payload([
        { trackName: 'Hips Dont Lie', artistName: 'Shakira Tribute', artworkUrl100: 'https://wrong/100x100w.jpg' },
        { trackName: "Hips Don't Lie (feat. Wyclef Jean)", artistName: 'Shakira', artworkUrl100: 'https://right/100x100r.jpg' },
      ])
    );
    assert.equal(url, 'https://right/600x600r.jpg');
  });

  it('fallback to first result is preserved when nothing matches', async () => {
    const { imp } = fresh();
    const url = await imp.resolveCoverURL(
      { title: 'X', artist: 'A' },
      payload([{ trackName: 'X', artistName: 'ZZZ', artworkUrl100: 'https://f/100x100f.jpg' }])
    );
    assert.equal(url, 'https://f/600x600f.jpg');
  });
});

describe('c-16 bugfix demo-covers: progress + per-resolve persist', () => {
  function deferred() {
    let open;
    const promise = new Promise((res) => { open = res; });
    return { promise, open };
  }
  function flush(times) {
    let p = Promise.resolve();
    for (let i = 0; i < (times || 4); i++) p = p.then(() => new Promise((r) => setImmediate(r)));
    return p;
  }
  function keyedStorage() {
    const map = {};
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
      setItem: (k, v) => { map[k] = String(v); },
      removeItem: (k) => { delete map[k]; },
      _map: map,
    };
  }

  it('enrichCovers reports per-song progress to onProgress', async () => {
    const { imp } = fresh();
    let calls = 0;
    const f = () => {
      calls++;
      if (calls === 1 || calls === 3) {
        // Deezer: no match (canción 1 y canción 2)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (calls === 2) {
        // iTunes simple: match canción 1
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100bb.jpg' }] }) });
      }
      // iTunes simple: no match canción 2
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
    };
    const seen = [];
    const rep = await imp.enrichCovers([
      { title: 'Gasolina', artist: 'Daddy Yankee', coverUrl: null },
      { title: 'Zzz-none', artist: 'Yyy-none', coverUrl: null },
    ], f, (p) => seen.push(p));
    assert.deepEqual(rep, { resolved: 1, total: 2 });
    assert.deepEqual(seen, [
      { done: 1, total: 2, resolved: 1 },
      { done: 2, total: 2, resolved: 1 },
    ]);
  });

  it('import shows live i/N progress before the final count', async () => {
    const { app } = fresh();
    const savedDocument = global.document;
    const msgs = [];
    const stub = { textContent: '', innerHTML: '', value: '', disabled: false, style: {}, classList: { add() {}, remove() {} }, addEventListener() {} };
    global.document = {
      getElementById: (id) => {
        if (id === 'importMessage') return { set textContent(v) { msgs.push(v); }, get textContent() { return msgs[msgs.length - 1]; } };
        return stub;
      },
    };
    try {
      const g1 = deferred(), g2 = deferred();
      let calls = 0;
      const f = (url) => {
        const g = calls++ === 0 ? g1 : g2;
        return g.promise.then((results) => {
          if (String(url).indexOf('api.deezer.com') !== -1) {
            return { ok: true, json: () => Promise.resolve({ data: results }) };
          }
          return { ok: true, json: () => Promise.resolve({ results }) };
        });
      };
      const r = app.handlePasteImport('A - T1\nA - T2', f);
      g1.open([{ title: 'T1', artist: { name: 'A' }, album: { cover_big: 'https://deezer/500x500a.jpg' } }]); // Deezer: match canción 1
      await flush(6);
      assert.ok(msgs.some((m) => /Resolviendo tapas 1\/2/.test(m)), 'live 1/2 seen, got: ' + JSON.stringify(msgs));
      g2.open([]); // Deezer: no match canción 2 → iTunes simple: no match
      const rep = await r.covers;
      assert.deepEqual(rep, { resolved: 1, total: 2 });
      assert.match(r.message, /Tapas resueltas: 1\/2/);
    } finally {
      if (savedDocument === undefined) delete global.document;
      else global.document = savedDocument;
    }
  });

  it('a resolved cover is persisted before the remaining songs finish', async () => {    const { core, app } = fresh();
    const st = keyedStorage();
    const savedLocal = global.localStorage;
    global.localStorage = st;
    try {
      const g1 = deferred(), g2 = deferred();
      let calls = 0;
      const f = (url) => {
        const g = calls++ === 0 ? g1 : g2;
        return g.promise.then((results) => {
          if (String(url).indexOf('api.deezer.com') !== -1) {
            return { ok: true, json: () => Promise.resolve({ data: results }) };
          }
          return { ok: true, json: () => Promise.resolve({ results }) };
        });
      };
      const r = app.handlePasteImport('A - T1\nA - T2', f);
      g1.open([{ title: 'T1', artist: { name: 'A' }, album: { cover_big: 'https://deezer/500x500a.jpg' } }]); // Deezer: match canción 1
      await flush(6);
      const mid = JSON.parse(st._map['mbdj.v1']);
      assert.equal(mid.songs[0].coverUrl, 'https://deezer/500x500a.jpg');
      assert.equal(mid.songs[1].coverUrl, null);
      let settled = false;
      r.covers.then(() => { settled = true; });
      await flush(3);
      assert.equal(settled, false);
      g2.open([]); // Deezer: no match canción 2 → iTunes simple: no match
      const rep = await r.covers;
      assert.deepEqual(rep, { resolved: 1, total: 2 });
      assert.equal(core.state.songs[0].coverUrl, 'https://deezer/500x500a.jpg');
    } finally {
      if (savedLocal === undefined) delete global.localStorage;
      else global.localStorage = savedLocal;
    }
  });

  it('pre-covered songs still report progress with zero fetch', async () => {
    const { imp } = fresh();
    let calls = 0;
    const seen = [];
    const rep = await imp.enrichCovers(
      [{ title: 'Keep', artist: 'K', coverUrl: 'https://keep.jpg' }],
      () => { calls++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }); },
      (p) => seen.push(p)
    );
    assert.deepEqual(rep, { resolved: 0, total: 1 });
    assert.deepEqual(seen, [{ done: 1, total: 1, resolved: 0 }]);
    assert.equal(calls, 0);
  });

  it('opts.onProgress hook receives the same live sequence', async () => {
    const { app } = fresh();
    const seen = [];
    const r = app.handlePasteImport(
      'A - T1',
      () => Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }),
      { onProgress: (p) => seen.push(p) }
    );
    const rep = await r.covers;
    assert.deepEqual(rep, { resolved: 0, total: 1 });
    assert.deepEqual(seen, [{ done: 1, total: 1, resolved: 0 }]);
  });
});

describe('c-16 preshow-tuning: timeout 12s + limit 8 + 1 retry', () => {
  function payload(results) {
    return () => Promise.resolve({ ok: true, json: () => Promise.resolve({ results }) });
  }

  it('pre-show defaults maximize auto-complete: timeout 12000, limit 8, 1 retry', () => {
    const { imp } = fresh();
    assert.equal(imp.COVER_TIMEOUT_MS, 12000);
    assert.equal(imp.ITUNES_LIMIT, 8);
    assert.equal(imp.COVER_RETRIES, 1);
  });

  it('request asks iTunes for limit=8 candidates', async () => {
    const { imp } = fresh();
    let seenUrl = '';
    const spy = (url) => { seenUrl = String(url); return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }); };
    assert.equal(await imp.resolveCoverURL({ title: 'T', artist: 'A' }, spy), null);
    assert.ok(seenUrl.includes('limit=8'), 'url carries limit=8, got: ' + seenUrl);
  });

  it('transient reject then match resolves via exactly one retry', async () => {
    const { imp } = fresh();
    let calls = 0;
    const flaky = () => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('transient'));
      return payload([{ trackName: 'T', artistName: 'A', artworkUrl100: 'https://r/100x100r.jpg' }])();
    };
    const url = await imp.resolveCoverURL({ title: 'T', artist: 'A' }, flaky);
    assert.equal(url, 'https://r/600x600r.jpg');
    assert.equal(calls, 2);
  });

  it('timeout then match resolves via retry with abort on the first attempt', async () => {
    const { imp } = fresh();
    const savedAC = global.AbortController;
    let aborts = 0;
    class CountingAC {
      constructor() { this.signal = {}; }
      abort() { aborts++; }
    }
    global.AbortController = CountingAC;
    try {
      let calls = 0;
      const flaky = () => {
        calls++;
        if (calls === 1) return new Promise(() => {});
        return payload([{ trackName: 'T', artistName: 'A', artworkUrl100: 'https://r/100x100r.jpg' }])();
      };
      const url = await imp.resolveCoverURL({ title: 'T', artist: 'A' }, flaky, { timeoutMs: 30, retries: 1 });
      assert.equal(url, 'https://r/600x600r.jpg');
      // Deezer (cuelga+abort → transient) → iTunes simple (payload, match)
      assert.equal(calls, 2);
      assert.equal(aborts, 1);
    } finally {
      global.AbortController = savedAC;
    }
  });

  it('persistent failure resolves null after exactly initial + 1 retry', async () => {
    const { imp } = fresh();
    let calls = 0;
    const dead = () => { calls++; return Promise.reject(new Error('down')); };
    assert.equal(await imp.resolveCoverURL({ title: 'T', artist: 'A' }, dead, { timeoutMs: 30, retries: 1 }), null);
    // Deezer (transient) → iTunes simple (transient ×2 con 1 reintento)
    assert.equal(calls, 3);
  });

  it('deterministic no-match never retries: deezer + simple + album lookup, no transient retry', async () => {
    const { imp } = fresh();
    let calls = 0;
    const empty = () => { calls++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [], results: [] }) }); };
    assert.equal(await imp.resolveCoverURL({ title: 'Zzz', artist: 'Yyy' }, empty), null);
    // 1 deezer + 1 simple + 1 album fallback = 3 calls; no transient retry because responses are valid
    assert.equal(calls, 3);
  });

  it('enrichCovers forwards the retry path and keeps progress + persist contract', async () => {
    const { imp } = fresh();
    let calls = 0;
    const flaky = () => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('transient'));
      return payload([{ trackName: 'T', artistName: 'A', artworkUrl100: 'https://r/100x100r.jpg' }])();
    };
    const songs = [{ title: 'T', artist: 'A', coverUrl: null }];
    const seen = [];
    const rep = await imp.enrichCovers(songs, flaky, (p) => seen.push(p));
    assert.deepEqual(rep, { resolved: 1, total: 1 });
    assert.equal(songs[0].coverUrl, 'https://r/600x600r.jpg');
    assert.deepEqual(seen, [{ done: 1, total: 1, resolved: 1 }]);
    // Deezer (reject → transient) → iTunes simple (payload, match)
    assert.equal(calls, 2);
  });
});

describe('c-16 B1: emitted bundle trims spaces, not the letter s', () => {
  it('coverUrlOfInline in buildPublicHTML keeps leading/trailing s and trims spaces', () => {
    // Arrange: the REAL emitted bundle that ships to the projector
    // (not the module-level coverUrlOf, which was always correct)
    const { pub } = fresh();
    const inline = pub.buildPublicHTML().split('<script>')[1].split('</script>')[0];
    const sandbox = { document: { getElementById: () => null }, window: { addEventListener() {}, localStorage: null } };
    vm.createContext(sandbox);
    // Act: exercise the bundle's own trim
    vm.runInContext(inline + '\nthis.__b1 = { tail: coverUrlOfInline({coverUrl:"https://x.com/photos"}), head: coverUrlOfInline({coverUrl:"salsa.jpg"}), trim: coverUrlOfInline({coverUrl:"  https://x.com/a.jpg  "}) };', sandbox);
    // Assert: independent literals — s letters survive, whitespace goes
    assert.equal(sandbox.__b1.tail, 'https://x.com/photos');
    assert.equal(sandbox.__b1.head, 'salsa.jpg');
    assert.equal(sandbox.__b1.trim, 'https://x.com/a.jpg');
  });
});

describe('c-19 7.1: Deezer como fuente primaria de carátulas', () => {
  it('S12: Deezer match exacto retorna cover_big', async () => {
    const { imp } = fresh();
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      deezerFetch([{ title: 'Gasolina', artist: { name: 'Daddy Yankee' }, album: { cover_big: 'https://deezer/500x500g.jpg' } }])
    );
    assert.equal(url, 'https://deezer/500x500g.jpg');
  });

  it('S12: Deezer usa cover_medium cuando no hay cover_big', async () => {
    const { imp } = fresh();
    const url = await imp.resolveCoverURL(
      { title: 'Matador', artist: 'Los Fabulosos Cadillacs' },
      deezerFetch([{ title: 'Matador', artist: { name: 'Los Fabulosos Cadillacs' }, album: { cover_medium: 'https://deezer/250x250m.jpg' } }])
    );
    assert.equal(url, 'https://deezer/250x250m.jpg');
  });

  it('S13: Deezer nomatch → iTunes simple match', async () => {
    const { imp } = fresh();
    let callIndex = 0;
    const flaky = () => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100g.jpg' }] }) });
    };
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      flaky
    );
    assert.equal(url, 'https://x/600x600g.jpg');
    assert.equal(callIndex, 2, 'Deezer + iTunes simple');
  });

  it('S14: Deezer → iTunes simple → iTunes álbum', async () => {
    const { imp } = fresh();
    let callIndex = 0;
    const flaky = () => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (callIndex === 2) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ collectionName: 'Greatest Hits', artworkUrl100: 'https://x/100x100a.jpg', artistName: 'Daddy Yankee' }] }) });
    };
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      flaky
    );
    assert.equal(url, 'https://x/600x600a.jpg');
    assert.equal(callIndex, 3, 'Deezer + iTunes simple + iTunes álbum');
  });

  it('S15: Deezer + iTunes simple + iTunes álbum fallan → null', async () => {
    const { imp } = fresh();
    const empty = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [], results: [] }) });
    const url = await imp.resolveCoverURL({ title: 'Zzz', artist: 'Yyy' }, empty);
    assert.equal(url, null);
  });

  it('S16: caché IndexedDB hit → cero llamadas a red', async () => {
    const { imp } = fresh();
    const cache = { _map: { 'daddy yankee - gasolina': 'https://cached/500x500g.jpg' }, get(k) { return this._map[k] || null; }, set() { } };
    let fetchCalls = 0;
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      () => { fetchCalls++; return Promise.reject(new Error('no se debe llamar')); },
      { coverCache: cache }
    );
    assert.equal(url, 'https://cached/500x500g.jpg');
    assert.equal(fetchCalls, 0, 'fetch no debe llamarse con caché hit');
  });
});

describe('c-18 6.1: coverCache get/set (mock IndexedDB)', () => {
  it('S10: coverCache stores resolved URL on first resolve', async () => {
    const { imp } = fresh();
    const cache = { _map: {}, get(k) { return this._map[k] || null; }, set(k, v, s) { this._map[k] = v; } };
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      itunesFetch([{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100g.jpg' }]),
      { coverCache: cache }
    );
    assert.equal(url, 'https://x/600x600g.jpg');
    assert.ok(cache._map['daddy yankee - gasolina'], 'cache key stored');
    assert.equal(cache._map['daddy yankee - gasolina'], 'https://x/600x600g.jpg');
  });

  it('S10: coverCache returns cached URL without calling fetch on second resolve', async () => {
    const { imp } = fresh();
    const cache = { _map: { 'daddy yankee - gasolina': 'https://cached/600x600g.jpg' }, get(k) { return this._map[k] || null; }, set() { } };
    let fetchCalls = 0;
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      () => { fetchCalls++; return Promise.reject(new Error('must not be called')); },
      { coverCache: cache }
    );
    assert.equal(url, 'https://cached/600x600g.jpg');
    assert.equal(fetchCalls, 0, 'fetch must not be called when cache hits');
  });
});

describe('c-18 6.2: resolveCoverURL falls back to album when simple match fails', () => {
  it('S2: iTunes simple nomatch → album fallback returns album artwork', async () => {
    const { imp } = fresh();
    // First call: simple search returns no usable match
    // Second call (album): returns album artwork
    let callIndex = 0;
    const flaky = () => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ collectionName: 'Greatest Hits', artworkUrl100: 'https://x/100x100a.jpg', artistName: 'Daddy Yankee' }] }) });
    };
    const url = await imp.resolveCoverURL(
      { title: 'Gasolina', artist: 'Daddy Yankee' },
      flaky
    );
    assert.equal(url, 'https://x/600x600a.jpg');
    assert.equal(callIndex, 2, 'exactly two iTunes calls (simple + album)');
  });

  it('S2: album fallback returns null when album search also empty', async () => {
    const { imp } = fresh();
    const empty = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
    const url = await imp.resolveCoverURL({ title: 'Zzz', artist: 'Yyy' }, empty);
    assert.equal(url, null);
  });
});

describe('c-18 6.3: resolveCoverLocal builds local candidate paths', () => {
  it('S3/S4: resolveCoverLocal returns simple-local path first', () => {
    const { app } = fresh();
    const local = app.resolveCoverLocal({ title: 'Gasolina', artist: 'Daddy Yankee' });
    assert.equal(local, 'assets/covers/daddy yankee - gasolina.jpg');
  });

  it('S3/S4: resolveCoverLocal handles artist with spaces and special chars', () => {
    const { app } = fresh();
    const local = app.resolveCoverLocal({ title: 'La Pachanga', artist: 'Vilma Palma e Vampiros' });
    assert.equal(local, 'assets/covers/vilma palma e vampiros - la pachanga.jpg');
  });
});

describe('c-18 6.4: import without network uses cache then local', () => {
  it('S9: offline import imports songs coverless, placeholder available', async () => {
    const { core, app } = fresh();
    const r = app.handlePasteImport('Soda Stereo - De Musica Ligera', null);
    assert.equal(r.added, 1);
    await r.covers;
    assert.equal(core.state.songs[0].coverUrl, null);
  });

  it('S10: same song imported twice with network, second uses cache zero iTunes', async () => {
    const { core, app, imp } = fresh();
    let fetchCalls = 0;
    const fetchSpy = (url) => {
      fetchCalls++;
      if (String(url).indexOf('api.deezer.com') !== -1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100g.jpg' }] }) });
    };
    const cache = { _map: {}, get(k) { return this._map[k] || null; }, set(k, v, s) { this._map[k] = v; } };

    const r1 = app.handlePasteImport('Daddy Yankee - Gasolina', fetchSpy, { coverCache: cache });
    assert.equal(r1.added, 1);
    await r1.covers;
    assert.equal(core.state.songs[0].coverUrl, 'https://x/600x600g.jpg');
    assert.equal(fetchCalls, 2, 'first import calls Deezer + iTunes once');
    assert.ok(cache._map['daddy yankee - gasolina'], 'cover cached');

    // Reset songs but keep cache; second import same song with fetch that must not be called
    core.state.songs = [];
    core.state.history = [];
    fetchCalls = 0;
    const r2 = app.handlePasteImport('Daddy Yankee - Gasolina', () => { fetchCalls++; return Promise.reject(new Error('must not be called')); }, { coverCache: cache });
    assert.equal(r2.added, 1);
    await r2.covers;
    assert.equal(core.state.songs[0].coverUrl, 'https://x/600x600g.jpg', 'second import uses cached cover');
    assert.equal(fetchCalls, 0, 'zero iTunes calls on cache hit');
  });

  it('S11: song resolved online, later imported offline uses IndexedDB cache', async () => {
    const { core, app } = fresh();
    const cache = { _map: {}, get(k) { return this._map[k] || null; }, set(k, v, s) { this._map[k] = v; } };

    // Online import resolves and caches
    const r1 = app.handlePasteImport(
      'Daddy Yankee - Gasolina',
      itunesFetch([{ trackName: 'Gasolina', artistName: 'Daddy Yankee', artworkUrl100: 'https://x/100x100g.jpg' }]),
      { coverCache: cache }
    );
    assert.equal(r1.added, 1);
    await r1.covers;
    assert.equal(core.state.songs[0].coverUrl, 'https://x/600x600g.jpg');
    assert.ok(cache._map['daddy yankee - gasolina']);

    // Offline import of same song must use cache
    core.state.songs = [];
    core.state.history = [];
    const r2 = app.handlePasteImport('Daddy Yankee - Gasolina', null, { coverCache: cache });
    assert.equal(r2.added, 1);
    await r2.covers;
    assert.equal(core.state.songs[0].coverUrl, 'https://x/600x600g.jpg', 'offline import uses cached cover');
  });
});

describe('c-18 6.5: show paths issue zero cover fetch (tripwire extended)', () => {
  it('S6: import.js, draw.js, public.js, app.js show paths have no fetch', () => {
    const { app } = fresh();
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.join(__dirname, '..');
    for (const fn of ['buildStateMessage', 'broadcast', 'render', 'schedulePublicReveal', 'setCurrentStatus', 'handleVoidRequest', 'handleCoverRequest']) {
      assert.ok(!/fetch\s*\(/.test(String(app[fn].toString())), fn + ' issues no cover fetch');
    }
    const drawSrc = fs.readFileSync(path.join(root, 'js', 'draw.js'), 'utf8');
    assert.ok(!/fetch\s*\(/.test(drawSrc), 'draw.js has no fetch');
    const pubSrc = fs.readFileSync(path.join(root, 'js', 'public.js'), 'utf8');
    assert.ok(!/fetch\s*\(/.test(pubSrc), 'public.js has no fetch');
  });

  it('S6: enrichCovers with coverCache and no fetch does not call fetch', async () => {
    const { imp } = fresh();
    const cache = { _map: { 'daddy yankee - gasolina': 'https://cached/600x600g.jpg' }, get(k) { return this._map[k] || null; }, set() { } };
    let fetchCalls = 0;
    const songs = [{ title: 'Gasolina', artist: 'Daddy Yankee', coverUrl: null }];
    const rep = await imp.enrichCovers(
      songs,
      () => { fetchCalls++; return Promise.reject(new Error('must not be called')); },
      null,
      { coverCache: cache }
    );
    assert.deepEqual(rep, { resolved: 1, total: 1 });
    assert.equal(songs[0].coverUrl, 'https://cached/600x600g.jpg');
    assert.equal(fetchCalls, 0);
  });
});

describe('c-18 6.6: locked gate and XSS rejection unchanged', () => {
  it('S7: locked import blocks with BLOCKED_MESSAGE and zero fetch', async () => {
    const { core, app } = fresh();
    core.state.locked = true;
    let calls = 0;
    const counting = () => { calls++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }); };
    try {
      const rp = app.handlePasteImport('A - B', counting, { coverCache: { get() { return null; }, set() { } } });
      assert.equal(rp.blocked, true);
      assert.equal(rp.message, app.BLOCKED_MESSAGE);
      assert.equal(calls, 0);
      assert.equal(core.state.songs.length, 0);
    } finally {
      core.state.locked = false;
    }
  });

  it('S8: manual javascript: URL rejected, coverUrl not mutated', () => {
    const { core, app } = fresh();
    core.state.songs = [{ id: 's1', title: 'T', artist: 'A', status: 'available', coverUrl: null }];
    assert.equal(app.handleCoverRequest('s1', 'javascript:alert(1)').ok, false);
    assert.equal(app.handleCoverRequest('s1', '<img src=x onerror=alert(1)>').ok, false);
    assert.equal(core.state.songs[0].coverUrl, null);
  });
});
