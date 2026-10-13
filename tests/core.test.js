const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('core.js loads Node-safe', () => {
  it('exposes makeId, esc, available and state without window/document crash', () => {
    const core = require('../js/core.js');
    assert.ok(core, 'core module loads');
    assert.equal(typeof core.makeId, 'function');
    assert.equal(typeof core.esc, 'function');
    assert.equal(typeof core.available, 'function');
    assert.ok(core.state, 'state seam exists');
  });

  it('esc escapes HTML specials (independent literal)', () => {
    const core = require('../js/core.js');
    assert.equal(core.esc('<b>"&\'</b>'), '&lt;b&gt;&quot;&amp;&#39;&lt;/b&gt;');
    assert.equal(core.esc(null), '');
    assert.equal(core.esc('Hola'), 'Hola');
  });

  it('makeId returns unique song ids', () => {
    const core = require('../js/core.js');
    const a = core.makeId();
    const b = core.makeId();
    assert.match(a, /^s[0-9a-z]+$/);
    assert.notEqual(a, b);
  });

  it('available filters only status=available (happy + edge)', () => {
    const core = require('../js/core.js');
    const songs = [
      { id: 's1', title: 'A', status: 'available' },
      { id: 's2', title: 'B', status: 'drawn' },
      { id: 's3', title: 'C', status: 'played' },
    ];
    assert.equal(core.available(songs).length, 1);
    assert.equal(core.available([]).length, 0);
    assert.deepEqual(core.available(songs).map(s => s.id), ['s1']);
  });
});
