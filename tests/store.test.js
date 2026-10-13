const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('store.js persistence stub seam (C-06)', () => {
  it('exposes save/load/clear without crashing load order', () => {
    const store = require('../js/store.js');
    assert.equal(typeof store.save, 'function');
    assert.equal(typeof store.load, 'function');
    assert.equal(typeof store.clear, 'function');
  });

  it('stub round-trips without throwing (happy + edge)', () => {
    const store = require('../js/store.js');
    assert.doesNotThrow(() => store.save({ songs: [] }));
    assert.doesNotThrow(() => store.load());
    assert.doesNotThrow(() => store.clear());
    store.clear();
    assert.equal(store.load(), null);
  });
});
