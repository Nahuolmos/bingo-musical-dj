/* js/app.js — operator bootstrap (verbatim behavior from monolith).
 * Owns: render, broadcast, setCurrentStatus, secure draw UI flow, all
 * getElementById wiring, sampleBtn demo 12, exportLog BOM CSV, fileInput
 * TXT/CSV/TSV + PDF/DOCX CDN fallback, copyResult/skipResult, openPublic
 * rewired to window.open('public.html',...). Classic script, Node-safe:
 * DOM wiring runs only when document exists; pure helpers exported for tests. */
(function (root) {
  'use strict';

  var PUBLIC_URL = 'public.html';
  var PUBLIC_CHANNEL = 'music-bingo-dj-on';
  // Fallback file://: BroadcastChannel no entrega entre dos paginas file://
  // (origenes opacos distintos); se espeja el mismo mensaje en localStorage.
  var TRANSPORT_KEY = PUBLIC_CHANNEL;

  function core() {
    if (root.MBDJ && root.MBDJ.core) return root.MBDJ.core;
    if (typeof require !== 'undefined') { try { return require('./core.js'); } catch (e) {} }
    throw new Error('MBDJ.core missing');
  }
  function imp() {
    if (root.MBDJ && root.MBDJ.import) return root.MBDJ.import;
    if (typeof require !== 'undefined') { try { return require('./import.js'); } catch (e) {} }
    throw new Error('MBDJ.import missing');
  }
  function drawm() {
    if (root.MBDJ && root.MBDJ.draw) return root.MBDJ.draw;
    if (typeof require !== 'undefined') { try { return require('./draw.js'); } catch (e) {} }
    throw new Error('MBDJ.draw missing');
  }

  var channel = null;
  if (typeof window !== 'undefined' && ('BroadcastChannel' in window)) {
    try { channel = new BroadcastChannel(PUBLIC_CHANNEL); } catch (e) { channel = null; }
  }

  function buildStateMessage() {
    var c = core();
    var st = c.state;
    var av = c.available();
    return {
      type: 'state',
      songs: st.songs,
      history: st.history,
      current: st.current ? { title: st.current.title, artist: st.current.artist, status: st.current.status } : null,
      total: st.songs.length,
      remaining: av.length,
      drawn: st.songs.filter(function (s) { return s.status !== 'available'; }).length
    };
  }

  function defaultStorage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) {}
    try {
      if (root && root.localStorage) return root.localStorage;
    } catch (e2) {}
    return null;
  }

  // Espejo file:// del mismo mensaje (con nonce para que el evento 'storage'
  // dispare aun cuando el estado no cambio). storage inyectable para tests.
  function writeTransport(msg, storage) {
    var st = storage || defaultStorage();
    if (!st || typeof st.setItem !== 'function') return false;
    try {
      var envelope = {};
      for (var k in msg) { if (Object.prototype.hasOwnProperty.call(msg, k)) envelope[k] = msg[k]; }
      envelope._ts = Date.now();
      envelope._nonce = Math.random().toString(36).slice(2);
      st.setItem(TRANSPORT_KEY, JSON.stringify(envelope));
      return true;
    } catch (e) {
      return false;
    }
  }

  function broadcast(storage) {
    var msg = buildStateMessage();
    if (channel) {
      try { channel.postMessage(msg); } catch (e) {}
    }
    writeTransport(msg, storage);
  }

  function render() {
    if (typeof document === 'undefined') return;
    var c = core();
    var st = c.state;
    var av = c.available();
    var $ = function (id) { return document.getElementById(id); };
    $('totalStat').textContent = st.songs.length;
    $('remainingStat').textContent = av.length;
    $('drawnStat').textContent = st.songs.filter(function (s) { return s.status !== 'available'; }).length;
    $('drawBtn').disabled = !av.length || st.spinning;
    $('confirmBtn').disabled = !st.current || st.current.status !== 'drawn' || st.spinning;
    $('statusText').textContent = !st.songs.length ? 'Esperando listado de canciones'
      : !av.length ? 'No quedan canciones disponibles'
      : st.current && st.current.status === 'drawn' ? 'Canción sorteada: buscala en VirtualDJ'
      : 'Listo para el próximo sorteo';
    var q = $('filterInput').value.toLocaleLowerCase();
    var filtered = st.songs.filter(function (s) { return (s.title + ' ' + s.artist).toLocaleLowerCase().indexOf(q) !== -1; });
    $('songList').innerHTML = filtered.length ? filtered.map(function (s, i) {
      return '<div class="song"><span class="num">' + String(i + 1).padStart(2, '0') + '</span><div class="songtext"><strong>' + c.esc(s.title) + '</strong><small>' + c.esc(s.artist || 'Artista no especificado') + '</small></div><span class="pill ' + (s.status === 'played' ? 'done' : s.status === 'void' ? '' : 'pending') + '">' + (s.status === 'played' ? 'Reproducida' : s.status === 'void' ? 'Anulada' : s.status === 'drawn' ? 'Sorteada' : 'Disponible') + '</span></div>';
    }).join('') : '<div class="empty">No hay coincidencias.</div>';
    $('historyCount').textContent = st.history.length + ' registro' + (st.history.length === 1 ? '' : 's');
    $('historyList').innerHTML = st.history.length ? [].concat(st.history).reverse().map(function (h) {
      return '<div class="historyitem"><div class="historynum">' + String(h.n).padStart(2, '0') + '</div><div style="flex:1"><b>' + c.esc(h.title) + '</b><span>' + c.esc(h.artist || 'Artista no especificado') + ' · ' + c.esc(h.time) + '</span><span>' + (h.status === 'played' ? '✓ Reproducida' : h.status === 'void' ? '! Anulada por incidencia' : '● Sorteada') + '</span></div></div>';
    }).join('') : '<div class="empty">Todavía no hubo sorteos.</div>';
    broadcast();
  }

  function setCurrentStatus(status) {
    var c = core();
    var st = c.state;
    // C-03 draw-engine spinning guard: confirm blocked mid-spin, no effect
    // until the reveal completes (finishCommit clears spinning).
    if (st.spinning) return;
    if (!st.current || st.current.status !== 'drawn') return;
    st.current.status = status;
    var h = null;
    if (st.history.findLast) h = st.history.findLast(function (x) { return x.id === st.current.id; });
    else h = [].concat(st.history).reverse().find(function (x) { return x.id === st.current.id; });
    if (h) h.status = status;
    if (typeof document !== 'undefined') {
      var $ = function (id) { return document.getElementById(id); };
      if (status === 'played') {
        $('drawHeading').textContent = 'Canción registrada';
        $('drawDesc').textContent = 'Cuando estés listo, podés sortear la siguiente.';
        $('wheelText').textContent = '¡LISTO!';
        $('wheelSub').textContent = 'Siguiente canción';
        $('result').classList.remove('show');
      } else {
        $('drawHeading').textContent = 'Incidencia registrada';
        $('drawDesc').textContent = 'La canción queda excluida para evitar que vuelva a salir. Informá al organizador.';
        $('wheelText').textContent = 'INCIDENCIA';
        $('wheelSub').textContent = 'Tema anulado';
        $('result').classList.remove('show');
      }
    }
    st.current = null;
    if (typeof document !== 'undefined') render();
  }

  // Secure draw UI flow: commit via draw.pickAndCommit() BEFORE animation.
  function handleDrawClick() {
    if (typeof document === 'undefined') return null;
    var c = core();
    var st = c.state;
    if (st.spinning || !c.available().length) return null;
    // Commit-before-render (RN-SOR-02): the song is decided + persisted here;
    // the reveal callback below only renders via finishCommit() + render().
    var s = drawm().pickAndCommit();
    if (!s) return null;
    var $ = function (id) { return document.getElementById(id); };
    $('result').classList.remove('show');
    $('wheel').classList.remove('spin');
    void $('wheel').offsetWidth;
    $('wheel').classList.add('spin');
    $('wheelText').textContent = 'SORTEANDO';
    $('wheelSub').textContent = 'Buena suerte';
    $('drawHeading').textContent = 'La ruleta está girando…';
    $('drawDesc').textContent = 'El resultado ya fue elegido al azar. Prepará VirtualDJ.';
    $('drawBtn').disabled = true;
    $('confirmBtn').disabled = true;
    broadcast();
    // C-03 draw-engine: cancellable reveal owned by draw.js (SPIN_MS base only).
    drawm().scheduleReveal(function () {
      drawm().finishCommit();
      $('wheel').classList.remove('spin');
      $('wheelText').textContent = s.title.length > 19 ? s.title.slice(0, 17) + '…' : s.title;
      $('wheelSub').textContent = s.artist || 'Tema sorteado';
      $('drawHeading').textContent = '¡Esta es la canción!';
      $('drawDesc').textContent = 'Buscala en VirtualDJ y reproducila. Cuando termine de sonar, marcala como reproducida.';
      $('resultTitle').textContent = s.title;
      $('resultArtist').textContent = s.artist || 'Artista no especificado';
      $('result').classList.add('show');
      render();
    });
    return s;
  }

  function buildDemoSongs() {
    var c = core();
    var pairs = [
      ['Shakira', 'Hips Don’t Lie'], ['Los Fabulosos Cadillacs', 'Matador'],
      ['Queen', 'Don’t Stop Me Now'], ['Dua Lipa', 'Levitating'],
      ['Ráfaga', 'Mentirosa'], ['Soda Stereo', 'De Música Ligera'],
      ['Los Palmeras', 'El Bombón Asesino'], ['Michael Jackson', 'Billie Jean'],
      ['Karol G', 'Si Antes Te Hubiera Conocido'], ['Vilma Palma e Vampiros', 'La Pachanga'],
      ['ABBA', 'Gimme! Gimme! Gimme!'], ['Daddy Yankee', 'Gasolina']
    ];
    return pairs.map(function (p) {
      return { id: c.makeId(), artist: p[0], title: p[1], status: 'available', addedAt: new Date().toISOString() };
    });
  }

  function buildCsv(history) {
    var rows = [['N°', 'Título', 'Artista', 'Estado', 'Hora']];
    history.forEach(function (h) { rows.push([h.n, h.title, h.artist, h.status, h.time]); });
    var csv = rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    return '﻿' + csv;
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = Array.prototype.slice.call(document.scripts).find(function (s) { return s.src === src; });
      if (existing) {
        if (window.pdfjsLib || window.mammoth) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('No se pudo cargar librería externa')); };
      document.head.appendChild(s);
    });
  }

  var publicWin = null;
  function openPublic() {
    if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
    if (publicWin && !publicWin.closed) { publicWin.focus(); return { ok: true, refocused: true }; }
    publicWin = window.open(PUBLIC_URL, 'musicBingoPublic', 'popup,width=1200,height=800');
    if (!publicWin) {
      if (typeof alert !== 'undefined') alert('El navegador bloqueó la ventana. Permití las ventanas emergentes para este archivo y volvé a intentarlo.');
      return { ok: false, blocked: true };
    }
    setTimeout(broadcast, 250);
    return { ok: true };
  }

  // C-03 draw-engine: named clear/reset handlers (test seams in Node).
  // Confirms run first (synchronous modal: no timer can interleave), then the
  // in-flight reveal is cancelled so no ghost result resurrects cleared state.
  function handleClearSongs() {
    var d = drawm();
    if (typeof document === 'undefined') {
      d.cancelReveal();
      d.finishCommit();
      var c0 = core();
      c0.state.songs = [];
      c0.state.history = [];
      c0.state.current = null;
      return true;
    }
    var c = core();
    if (!confirm('¿Vaciar el listado de canciones? Esta acción no se puede deshacer.')) return false;
    if (c.state.history.length && !confirm('Ya hay historial. ¿Querés borrar también el historial y reiniciar la partida?')) return false;
    d.cancelReveal();
    d.finishCommit();
    c.state.songs = [];
    c.state.history = [];
    c.state.current = null;
    var $ = function (id) { return document.getElementById(id); };
    $('result').classList.remove('show');
    $('drawHeading').textContent = 'Que empiece el juego.';
    $('drawDesc').textContent = 'Cargá el listado oficial y sorteá.';
    var m = document.getElementById('importMessage');
    if (m) m.textContent = 'Listado vacío.';
    render();
    return true;
  }

  function handleResetAll() {
    var d = drawm();
    if (typeof document === 'undefined') {
      d.cancelReveal();
      d.finishCommit();
      var c0 = core();
      c0.state.songs = [];
      c0.state.history = [];
      c0.state.current = null;
      return true;
    }
    var c = core();
    if (!confirm('¿Reiniciar toda la partida? Se borrarán canciones cargadas, sorteos e historial. Exportá el historial primero si lo necesitás.')) return false;
    d.cancelReveal();
    d.finishCommit();
    c.state.songs = [];
    c.state.history = [];
    c.state.current = null;
    var $ = function (id) { return document.getElementById(id); };
    $('result').classList.remove('show');
    $('wheelText').textContent = '¿QUÉ SUENA?';
    $('wheelSub').textContent = 'Listo para sortear';
    $('drawHeading').textContent = 'Que empiece el juego.';
    $('drawDesc').textContent = 'Cargá el listado oficial y sorteá.';
    var m = document.getElementById('importMessage');
    if (m) m.textContent = 'Partida reiniciada.';
    render();
    return true;
  }

  function initApp() {
    if (typeof document === 'undefined') return;
    var $ = function (id) { return document.getElementById(id); };
    $('drawBtn').addEventListener('click', handleDrawClick);
    $('confirmBtn').addEventListener('click', function () { setCurrentStatus('played'); });
    $('skipResult').addEventListener('click', function () {
      if (confirm('¿Registrar esta canción como anulada por una incidencia real? Quedará excluida del sorteo.')) setCurrentStatus('void');
    });
    $('copyResult').addEventListener('click', function () {
      var c = core();
      if (!c.state.current) return;
      var cur = c.state.current;
      try {
        navigator.clipboard.writeText(cur.title + (cur.artist ? ' — ' + cur.artist : '')).then(function () {
          $('copyResult').textContent = 'Copiado ✓';
          setTimeout(function () { $('copyResult').textContent = 'Copiar título y artista'; }, 1500);
        });
      } catch (e) {
        prompt('Copiá el resultado:', cur.title + (cur.artist ? ' — ' + cur.artist : ''));
      }
    });
    $('pasteToggle').addEventListener('click', function () { $('pasteArea').classList.toggle('hidden'); });
    $('cancelPaste').addEventListener('click', function () { $('pasteArea').classList.add('hidden'); });
    $('parsePaste').addEventListener('click', function () {
      imp().importSongs(imp().parseText($('pasteInput').value), 'texto');
      $('pasteInput').value = '';
      $('pasteArea').classList.add('hidden');
    });
    $('filterInput').addEventListener('input', render);
    $('clearSongs').addEventListener('click', handleClearSongs);
    $('resetAll').addEventListener('click', handleResetAll);
    $('sampleBtn').addEventListener('click', function () { imp().importSongs(buildDemoSongs(), 'demo'); });
    $('exportLog').addEventListener('click', function () {
      var c = core();
      download(new Blob([buildCsv(c.state.history)], { type: 'text/csv;charset=utf-8' }), 'music-bingo-historial.csv');
    });
    $('openPublic').addEventListener('click', openPublic);
    $('fileInput').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      (async function () {
        try {
          var text = '';
          var ext = f.name.split('.').pop().toLowerCase();
          if (ext === 'txt' || ext === 'csv' || ext === 'tsv') {
            text = await f.text();
            imp().importSongs(imp().parseText(text), f.name);
          } else if (ext === 'pdf') {
            var m1 = document.getElementById('importMessage');
            if (m1) m1.textContent = 'Leyendo PDF…';
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            var pdf = await window.pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
            for (var p = 1; p <= pdf.numPages; p++) {
              var page = await pdf.getPage(p);
              var content = await page.getTextContent();
              text += content.items.map(function (x) { return x.str; }).join(' ') + '\n';
            }
            imp().importSongs(imp().parseText(text), f.name);
          } else if (ext === 'docx') {
            var m2 = document.getElementById('importMessage');
            if (m2) m2.textContent = 'Leyendo DOCX…';
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js');
            var out = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
            imp().importSongs(imp().parseText(out.value), f.name);
          } else {
            var m3 = document.getElementById('importMessage');
            if (m3) m3.textContent = 'Formato no compatible. Usá PDF, DOCX, TXT o CSV.';
          }
        } catch (err) {
          if (typeof console !== 'undefined') console.error(err);
          var m4 = document.getElementById('importMessage');
          if (m4) m4.textContent = 'No se pudo leer el archivo. Si es PDF/DOCX, verificá internet o copiá el texto y usá “Pegar texto”.';
        } finally {
          e.target.value = '';
        }
      })();
    });
    render();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }

  root.MBDJ = root.MBDJ || {};
  root.MBDJ.app = {
    PUBLIC_URL: PUBLIC_URL,
    PUBLIC_CHANNEL: PUBLIC_CHANNEL,
    TRANSPORT_KEY: TRANSPORT_KEY,
    render: render,
    broadcast: broadcast,
    buildStateMessage: buildStateMessage,
    writeTransport: writeTransport,
    setCurrentStatus: setCurrentStatus,
    handleDrawClick: handleDrawClick,
    handleClearSongs: handleClearSongs,
    handleResetAll: handleResetAll,
    buildDemoSongs: buildDemoSongs,
    buildCsv: buildCsv,
    openPublic: openPublic,
    initApp: initApp
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.app;
  }
})(typeof window !== 'undefined' ? window : globalThis);
