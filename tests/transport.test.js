const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// BUG: en file:// (doble-click Chrome/Edge) la pantalla publica (public.html
// standalone, abierta con window.open('public.html')) nunca muestra el
// resultado: BroadcastChannel solo entrega entre contextos del mismo origen y
// dos paginas file:// tienen origenes opacos distintos, mientras que el
// monolito hacia document.write() en una ventana about:blank del mismo
// contexto (ahi el canal si entregaba). El transporte DJ->publica necesita un
// fallback que si entregue en file:// (localStorage + evento storage, misma
// interfaz de mensaje {type:'state',...}) + hidratacion al abrir.
describe('public-screen transport (DJ->publica, fallback file://)', () => {
  it('public.js expone TRANSPORT_KEY + validador + parser puros (seam Node-safe)', () => {
    // Arrange
    const pub = require(path.join(root, 'js', 'public.js'));
    // Act + Assert
    assert.equal(pub.PUBLIC_CHANNEL, 'music-bingo-dj-on');
    assert.equal(pub.TRANSPORT_KEY, 'music-bingo-dj-on');
    assert.equal(typeof pub.isStateMessage, 'function');
    assert.equal(typeof pub.parseTransportValue, 'function');
    assert.equal(pub.isStateMessage({ type: 'state' }), true);
    assert.equal(pub.isStateMessage({ type: 'other' }), false);
    assert.equal(pub.isStateMessage(null), false);
    assert.equal(pub.parseTransportValue(null), null);
    assert.equal(pub.parseTransportValue('no-json{{{'), null);
  });

  it('buildPublicHTML mantiene el canal pero agrega fallback storage + hidratacion', () => {
    // Arrange
    const pub = require(path.join(root, 'js', 'public.js'));
    // Act
    const html = pub.buildPublicHTML();
    // Assert: via primaria intacta
    assert.ok(html.includes("BroadcastChannel('music-bingo-dj-on')"), 'canal primario presente');
    assert.ok(html.includes('ESPERANDO EL SORTEO'), 'waiting estatal presente');
    // Assert: fallback file:// (falla antes del fix)
    assert.ok(html.includes("addEventListener('storage'"), 'escucha evento storage');
    assert.ok(html.includes('getItem'), 'hidrata estado al abrir');
  });

  it('public.html es identico al builder (sin drift tras el fix)', () => {
    // Arrange
    const pub = require(path.join(root, 'js', 'public.js'));
    // Act
    const built = pub.buildPublicHTML();
    const file = fs.readFileSync(path.join(root, 'public.html'), 'utf8');
    // Assert
    assert.equal(file, built);
  });

  describe('app.js espeja cada broadcast a localStorage (misma interfaz)', () => {
    let core;
    let app;
    let saved;

    beforeEach(() => {
      core = require(path.join(root, 'js', 'core.js'));
      app = require(path.join(root, 'js', 'app.js'));
      saved = {
        songs: core.state.songs,
        history: core.state.history,
        current: core.state.current,
        spinning: core.state.spinning
      };
    });

    afterEach(() => {
      core.state.songs = saved.songs;
      core.state.history = saved.history;
      core.state.current = saved.current;
      core.state.spinning = saved.spinning;
    });

    it('expone buildStateMessage/writeTransport y espeja {type:state} con nonce', () => {
      // Arrange
      core.state.songs = [
        { id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' },
        { id: 's2', title: 'Gasolina', artist: 'Daddy Yankee', status: 'available' }
      ];
      core.state.history = [{ n: 1, id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn', time: '00:00:01' }];
      core.state.current = { id: 's1', title: 'Matador', artist: 'Los Fabulosos Cadillacs', status: 'drawn' };
      const writes = [];
      const fakeStorage = {
        setItem(k, v) { writes.push([k, v]); },
        getItem() { return null; }
      };
      // Act
      const msg = app.buildStateMessage();
      // Assert: misma interfaz que consume la publica
      assert.equal(msg.type, 'state');
      assert.equal(msg.current.title, 'Matador');
      assert.equal(msg.remaining, 1);
      assert.equal(msg.drawn, 1);
      // Act: espejo a storage (falla antes del fix: writeTransport no existe)
      const ok = app.writeTransport(msg, fakeStorage);
      // Assert
      assert.equal(ok, true);
      assert.equal(writes.length, 1);
      assert.equal(writes[0][0], 'music-bingo-dj-on');
      const parsed = JSON.parse(writes[0][1]);
      assert.equal(parsed.type, 'state');
      assert.equal(parsed.current.title, 'Matador');
      // El nonce garantiza que el evento storage dispare aun con estado identico
      const ok2 = app.writeTransport(msg, fakeStorage);
      assert.equal(ok2, true);
      assert.notEqual(writes[0][1], writes[1][1]);
      assert.equal(JSON.parse(writes[1][1]).current.title, 'Matador');
    });

    it('round-trip DJ->publica: lo escrito por writeTransport lo entiende parseTransportValue', () => {
      // Arrange
      const pub = require(path.join(root, 'js', 'public.js'));
      core.state.songs = [{ id: 's9', title: 'Levitating', artist: 'Dua Lipa', status: 'drawn' }];
      core.state.history = [];
      core.state.current = { id: 's9', title: 'Levitating', artist: 'Dua Lipa', status: 'drawn' };
      let slot = null;
      const fakeStorage = { setItem(k, v) { slot = v; }, getItem() { return slot; } };
      // Act
      app.writeTransport(app.buildStateMessage(), fakeStorage);
      const back = pub.parseTransportValue(fakeStorage.getItem());
      // Assert: misma interfaz, la publica lo acepta y lo resume
      assert.equal(pub.isStateMessage(back), true);
      assert.equal(back.current.title, 'Levitating');
      assert.equal(pub.summarizeState(back).status, 'CANCIÓN SORTEADA');
      assert.equal(pub.summarizeState(null).status, 'ESPERANDO EL SORTEO');
    });
  });
});
