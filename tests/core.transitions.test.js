const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('c-02 task 2.1: song transitions terminal', () => {
  let core;
  beforeEach(() => {
    delete require.cache[require.resolve('../js/core.js')];
    core = require('../js/core.js');
  });

  it('valid forward chain available->drawn->played succeeds', () => {
    const song = { id: 's1', title: 'A', artist: 'B', status: 'available', addedAt: new Date().toISOString() };
    assert.equal(core.setSongStatus(song, 'drawn'), true);
    assert.equal(song.status, 'drawn');
    assert.equal(core.setSongStatus(song, 'played'), true);
    assert.equal(song.status, 'played');
  });

  it('valid forward chain available->drawn->void succeeds', () => {
    const song = { id: 's2', title: 'C', artist: 'D', status: 'available', addedAt: new Date().toISOString() };
    assert.equal(core.setSongStatus(song, 'drawn'), true);
    assert.equal(core.setSongStatus(song, 'void'), true);
    assert.equal(song.status, 'void');
  });

  it('invalid available->played rejected without mutation', () => {
    const song = { id: 's3', title: 'E', artist: 'F', status: 'available', addedAt: new Date().toISOString() };
    assert.equal(core.setSongStatus(song, 'played'), false);
    assert.equal(song.status, 'available');
  });

  it('invalid played->available and void->available rejected without mutation', () => {
    const p = { id: 's4', title: 'G', artist: 'H', status: 'played', addedAt: new Date().toISOString() };
    assert.equal(core.setSongStatus(p, 'available'), false);
    assert.equal(p.status, 'played');
    const v = { id: 's5', title: 'I', artist: 'J', status: 'void', addedAt: new Date().toISOString() };
    assert.equal(core.setSongStatus(v, 'available'), false);
    assert.equal(v.status, 'void');
  });

  it('invalid drawn->available and played->void rejected without mutation', () => {
    const d = { id: 's6', title: 'K', artist: 'L', status: 'drawn', addedAt: new Date().toISOString() };
    assert.equal(core.setSongStatus(d, 'available'), false);
    assert.equal(d.status, 'drawn');
    const p = { id: 's7', title: 'M', artist: 'N', status: 'played', addedAt: new Date().toISOString() };
    assert.equal(core.setSongStatus(p, 'void'), false);
    assert.equal(p.status, 'played');
  });

  it('isValidTransition allowlist matches spec', () => {
    assert.equal(core.isValidTransition('available', 'drawn'), true);
    assert.equal(core.isValidTransition('drawn', 'played'), true);
    assert.equal(core.isValidTransition('drawn', 'void'), true);
    assert.equal(core.isValidTransition('available', 'played'), false);
    assert.equal(core.isValidTransition('played', 'available'), false);
    assert.equal(core.isValidTransition('void', 'available'), false);
    assert.equal(core.isValidTransition('drawn', 'available'), false);
  });
});
