const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');

// C-14 caratula OPCION A + seam B (decision POST-propose, obligatoria).
// coverFor(song) hoy retorna placeholder generativo deterministico
// (color derivado de song.id + inicial del titulo, vinilo CSS puro,
// cero assets/red) con firma preparada para B futura
// (convencion documentada assets/covers/<song-id>.jpg con fallback;
// NO implementa carga de archivos B).
describe('c-14 coverFor: placeholder deterministico + seam B (RED)', () => {
  it('mismo id retorna mismo placeholder (determinismo)', () => {
    // Arrange
    const pub = require(path.join(root, 'js', 'public.js'));
    const song = { id: 'c14-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs' };
    // Act
    const a = pub.coverFor(song);
    const b = pub.coverFor({ id: 'c14-s1', title: 'Matador', artist: 'Los Fabulosos Cadillacs' });
    // Assert: literales independientes — mismo id, mismo color e inicial
    assert.equal(a.kind, 'placeholder');
    assert.equal(a.initial, 'M');
    assert.equal(a.background, b.background);
    assert.equal(a.initial, b.initial);
  });

  it('ids distintos derivan colores distintos (triangulacion)', () => {
    // Arrange
    const pub = require(path.join(root, 'js', 'public.js'));
    // Act
    const a = pub.coverFor({ id: 'c14-s1', title: 'Matador' });
    const c = pub.coverFor({ id: 'c14-s2', title: 'Gasolina' });
    // Assert
    assert.equal(c.initial, 'G');
    assert.notEqual(a.background, c.background);
  });

  it('fallback sin covers: song sin id/titulo no rompe, cero red/assets', () => {
    // Arrange
    const pub = require(path.join(root, 'js', 'public.js'));
    // Act
    const a = pub.coverFor(null);
    const b = pub.coverFor({});
    const c = pub.coverFor({ id: '', title: '' });
    // Assert: placeholder seguro + sin URLs remotas ni carga de archivos B
    for (const r of [a, b, c]) {
      assert.equal(r.kind, 'placeholder');
      assert.ok(r.initial.length === 1, 'una inicial, got: ' + r.initial);
      assert.ok(r.background.indexOf('hsl(') === 0, 'color inline hsl, got: ' + r.background);
      assert.ok(!JSON.stringify(r).includes('http'), 'cero red en el descriptor');
    }
    assert.equal(a.initial, '?');
  });
});
