const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

describe('app-structure parity gate', () => {
  it('every js/*.js loads standalone (no missing module)', () => {
    for (const f of ['core.js', 'import.js', 'draw.js', 'store.js', 'public.js', 'app.js']) {
      let mod;
      try {
        mod = require(path.join(root, 'js', f));
      } catch (e) {
        assert.fail('module failed to load: ' + f + ' :: ' + e.message);
      }
      assert.ok(mod, f + ' loads');
    }
  });

  it('index.html uses classic scripts in order, no type=module, no inline style', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.ok(!/type\s*=\s*["']module["']/.test(html), 'no bare type=module on main path');
    assert.ok(!/<style[\s>]/.test(html), 'no inline <style> in thin shell');
    const order = ['js/core.js', 'js/import.js', 'js/draw.js', 'js/store.js', 'js/public.js', 'js/app.js'];
    let last = -1;
    for (const src of order) {
      const idx = html.indexOf(src);
      assert.ok(idx > last, src + ' present in documented order');
      last = idx;
    }
  });

  it('no document.write on main path; public.html standalone', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.ok(!/document\.write/.test(html), 'index.html has no document.write');
    for (const f of ['js/core.js', 'js/import.js', 'js/draw.js', 'js/store.js', 'js/public.js', 'js/app.js']) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      assert.ok(!/document\.write/.test(src), f + ' has no document.write');
    }
    const pub = fs.readFileSync(path.join(root, 'public.html'), 'utf8');
    assert.ok(!/document\.write/.test(pub), 'public.html has no document.write');
    assert.ok(/ESPERANDO EL SORTEO/.test(pub), 'public waiting state present');
  });

  it('public.js exposes channel + builder; app.js exposes demo/csv/openPublic seams', () => {
    const pub = require(path.join(root, 'js', 'public.js'));
    assert.equal(pub.PUBLIC_CHANNEL, 'music-bingo-dj-on');
    assert.equal(typeof pub.buildPublicHTML, 'function');
    const app = require(path.join(root, 'js', 'app.js'));
    assert.equal(typeof app.buildDemoSongs, 'function');
    assert.equal(typeof app.buildCsv, 'function');
    assert.equal(app.PUBLIC_URL, 'public.html');
    assert.equal(app.buildDemoSongs().length, 12);
    const csv = app.buildCsv([{ n: 1, title: 'A', artist: 'B', status: 'played', time: '00:00:00' }]);
    assert.ok(csv.startsWith('\ufeff'), 'BOM preserved');
    assert.ok(csv.includes('A'), 'csv contains title');
  });
});
