const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('draw.js secureIndex + commit-before-render', () => {
  it('loads without window/document crash and exposes seam', () => {
    const draw = require('../js/draw.js');
    assert.equal(typeof draw.secureIndex, 'function');
    assert.equal(typeof draw.pickAndCommit, 'function');
  });

  it('secureIndex stays in bounds [0,n) over many draws (happy)', () => {
    const draw = require('../js/draw.js');
    for (let i = 0; i < 200; i++) {
      const v = draw.secureIndex(12);
      assert.ok(Number.isInteger(v) && v >= 0 && v < 12, 'in bounds: ' + v);
    }
  });

  it('secureIndex edge: n=1 always 0, distribution covers more than one value', () => {
    const draw = require('../js/draw.js');
    assert.equal(draw.secureIndex(1), 0);
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(draw.secureIndex(5));
    assert.ok(seen.size > 1, 'rejection sampling varies, got ' + [...seen].join(','));
  });

  it('pickAndCommit decides before animation + spinning guard (commit-before-render)', () => {
    const draw = require('../js/draw.js');
    const core = require('../js/core.js');
    core.state.songs = [
      { id: 's1', title: 'A', artist: 'X', status: 'available' },
      { id: 's2', title: 'B', artist: 'Y', status: 'available' },
    ];
    core.state.history = [];
    core.state.current = null;
    core.state.spinning = false;
    const picked = draw.pickAndCommit(0);
    assert.ok(picked, 'picks a song');
    assert.equal(picked.status, 'drawn');
    assert.equal(core.state.history.length, 1);
    assert.equal(core.state.history[0].status, 'drawn');
    // spinning guard: second commit while spinning returns null
    core.state.spinning = true;
    assert.equal(draw.pickAndCommit(0), null);
    core.state.spinning = false;
    core.state.songs = [];
    core.state.history = [];
    core.state.current = null;
  });
});
