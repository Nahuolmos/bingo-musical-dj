const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');

// NIVEL 2 — c-01-foundation-multifile: la publica quedaba en "esperando
// sorteo" con "disponibles: 0" y nunca pintaba la cancion. Causa raiz: el
// <script> inline de public.html (generado por buildPublicHTML) tenia un
// SyntaxError (falta ']' en esc: '[c)' en vez de '[c])'), asi que el bloque
// entero moria al parsear: sin listeners, sin hidratacion, sin handleState.
// Los tests 25/25 solo hacian substring-matching y nunca parseaban el inline.
// Este archivo es la red de regresion: parse real + harness emisor/receptor.
function inlineOf() {
  const pub = require(path.join(root, 'js', 'public.js'));
  const html = pub.buildPublicHTML();
  return html.split('<script>')[1].split('</script>')[0];
}

// Harness: corre el inline REAL en un DOM minimo (solo node: builtins).
// Prueba que, si el mensaje LLEGA (storage event o hidratacion), la publica
// pinta — aislando sintaxis/entrega del shape (que ya estaba bien).
function bootPublic(preloaded) {
  const inline = inlineOf();
  new vm.Script(inline); // lanza SyntaxError si el bloque esta roto
  const els = {};
  function el(id) {
    if (!els[id]) {
      els[id] = {
        textContent: '',
        innerHTML: '',
        style: {},
        _cls: [],
        classList: { add(c) { els[id]._cls.push(c); } }
      };
    }
    return els[id];
  }
  const handlers = {};
  const store = {
    _s: typeof preloaded === 'string' ? preloaded : null,
    getItem() { return this._s; },
    setItem(k, v) { this._s = v; }
  };
  const sandbox = {
    document: { getElementById: el },
    window: {
      addEventListener(t, fn) { (handlers[t] = handlers[t] || []).push(fn); },
      localStorage: store
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(inline, sandbox);
  return { els, handlers, store };
}

function drawnMsg() {
  // Mismo shape que app.js buildStateMessage()
  return {
    type: 'state',
    songs: [],
    history: [{ n: 1, title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '00:00:01' }],
    current: { title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
    total: 2, remaining: 1, drawn: 1
  };
}

describe('nivel2: el inline de la publica parsea y pinta si el mensaje llega', () => {
  it('el <script> inline de buildPublicHTML no tiene SyntaxError', () => {
    // Arrange + Act
    const inline = inlineOf();
    // Assert: antes del fix lanzaba "Unexpected token ')'" (faltaba ']' en esc)
    assert.doesNotThrow(() => { new vm.Script(inline); });
  });

  it('harness: evento storage con la key de transporte pinta titulo/contadores/historial', () => {
    // Arrange
    const { els, handlers } = bootPublic(null);
    assert.ok((handlers.storage || []).length > 0, 'hay listener storage');
    // Act: el DJ emite (writeTransport) y el navegador dispara storage en la publica
    handlers.storage.forEach((fn) => fn({ key: 'music-bingo-dj-on', newValue: JSON.stringify(drawnMsg()) }));
    // Assert: sale del "disponibles: 0" estatico y muestra la sorteada
    assert.equal(els.title.textContent, 'Matador');
    assert.equal(els.artist.textContent, 'Los Fabulosos Cadillacs');
    assert.equal(els.result.style.display, 'block');
    assert.equal(els.waiting.style.display, 'none');
    assert.ok(els.count.textContent.indexOf('1') !== -1, 'contador refleja remaining=1, no el 0 estatico');
    assert.ok(els.history.innerHTML.indexOf('Matador') !== -1, 'historial con escape HTML (ejerce esc)');
  });

  it('harness: storage con otra key se ignora (no pinta basura)', () => {
    // Arrange
    const { els, handlers } = bootPublic(null);
    // Act
    handlers.storage.forEach((fn) => fn({ key: 'otra-key', newValue: JSON.stringify(drawnMsg()) }));
    // Assert: el DOM queda intacto (handleState jamas corrio: ningun id tocado)
    assert.equal((els.title && els.title.textContent) || '', '');
    assert.deepEqual(Object.keys(els), []);
  });

  it('harness: hidratacion al abrir pinta si el DJ ya habia emitido', () => {
    // Arrange: el DJ escribio el espejo ANTES de que se abriera la publica
    // Act: boot con slot precargado (equivale a getItem al cargar)
    const { els } = bootPublic(JSON.stringify(drawnMsg()));
    // Assert
    assert.equal(els.title.textContent, 'Matador');
    assert.equal(els.result.style.display, 'block');
  });

  it('harness: type ajeno o current:null deja waiting sin titulo', () => {
    // Arrange
    const a = bootPublic(null);
    // Act: mensaje de otro tipo -> ignorado por el guard type==='state'
    a.handlers.storage.forEach((fn) => fn({ key: 'music-bingo-dj-on', newValue: JSON.stringify({ type: 'other', current: { title: 'X' } }) }));
    assert.equal((a.els.title && a.els.title.textContent) || '', '', 'type ajeno no crea ni toca #title');
    // Act: state sin current -> rama espera
    a.handlers.storage.forEach((fn) => fn({ key: 'music-bingo-dj-on', newValue: JSON.stringify({ type: 'state', current: null, remaining: 12, drawn: 0, history: [] }) }));
    // Assert
    assert.equal((a.els.title && a.els.title.textContent) || '', '', 'current:null no pinta titulo');
    assert.equal(a.els.result.style.display, 'none');
    assert.ok(a.els.count.textContent.indexOf('12') !== -1, 'contadores igual se actualizan en espera');
  });

  it('public.html regenerado es identico al builder (sin drift)', () => {
    // Arrange
    const pub = require(path.join(root, 'js', 'public.js'));
    // Act
    const built = pub.buildPublicHTML();
    const file = fs.readFileSync(path.join(root, 'public.html'), 'utf8');
    // Assert
    assert.equal(file, built);
  });

  it('monolito referencia: sin patron [c) roto y todo inline parsea', () => {
    // Arrange: el monolito retenido como referencia tenia el MISMO typo en
    // su publicHTML() de popup (document.write) — el panel DJ andaba pero el
    // popup jamas pintaba. Mismo fix de un char.
    const mono = fs.readFileSync(path.join(root, 'index.monolith.html'), 'utf8');
    // Act + Assert: ningun acceso computado sin cerrar
    const rotos = (mono.match(/\[c\)\)?\}/g) || []).filter((h) => h !== '[c]))}');
    assert.deepEqual(rotos, []);
    // Act + Assert: cada bloque inline del monolito parsea (puerta real, no substrings)
    let rest = mono;
    let n = 0;
    while (rest.indexOf('<script>') !== -1) {
      const a = rest.indexOf('<script>') + 8;
      const b = rest.indexOf('</script>', a);
      assert.ok(b !== -1, 'bloque con cierre');
      assert.doesNotThrow(() => { new vm.Script(rest.slice(a, b)); }, 'bloque ' + n + ' parsea');
      n++;
      rest = rest.slice(b + 9);
    }
    assert.ok(n >= 1, 'se reviso al menos un bloque');
  });
});
