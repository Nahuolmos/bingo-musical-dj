const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('c-02 task 2.2: setHistoryStatus in place via findLast + fallback', () => {
  let core;
  beforeEach(() => {
    delete require.cache[require.resolve('../js/core.js')];
    core = require('../js/core.js');
  });

  function entry(n, id, status) {
    return { n: n, id: id, title: 'T' + n, artist: 'A' + n, status: status, time: '12:00:0' + n, motivo: '' };
  }

  it('updates last matching entry in place, preserves title/artist/n/time', () => {
    const history = [entry(1, 's1', 'drawn'), entry(2, 's2', 'drawn'), entry(3, 's1', 'drawn')];
    assert.equal(core.setHistoryStatus(history, 's1', 'played'), true);
    assert.equal(history[2].status, 'played');
    assert.equal(history[0].status, 'drawn');
    assert.equal(history[2].title, 'T3');
    assert.equal(history[2].artist, 'A3');
    assert.equal(history[2].n, 3);
    assert.equal(history[2].time, '12:00:03');
  });

  it('void path updates last match too', () => {
    const history = [entry(1, 's9', 'drawn')];
    assert.equal(core.setHistoryStatus(history, 's9', 'void'), true);
    assert.equal(history[0].status, 'void');
  });

  it('no match is a no-op returning false', () => {
    const history = [entry(1, 's1', 'drawn')];
    assert.equal(core.setHistoryStatus(history, 'sx', 'played'), false);
    assert.equal(history[0].status, 'drawn');
  });

  it('fallback works with Array.prototype.findLast hidden', () => {
    const real = Array.prototype.findLast;
    try {
      Array.prototype.findLast = undefined;
      const history = [entry(1, 's1', 'drawn'), entry(2, 's1', 'drawn')];
      assert.equal(core.setHistoryStatus(history, 's1', 'void'), true);
      assert.equal(history[1].status, 'void');
      assert.equal(history[1].title, 'T2');
      assert.equal(history[1].n, 2);
      assert.equal(history[1].time, '12:00:02');
      assert.equal(history[0].status, 'drawn');
    } finally {
      if (real) Array.prototype.findLast = real;
      else delete Array.prototype.findLast;
    }
  });
});
