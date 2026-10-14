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
  function storem() {
    if (root.MBDJ && root.MBDJ.store) return root.MBDJ.store;
    if (typeof require !== 'undefined') { try { return require('./store.js'); } catch (e) {} }
    throw new Error('MBDJ.store missing');
  }

  // C-06 session-persistence: verbatim banner copies from the spec.
  var CORRUPT_MESSAGE = 'Respaldo dañado — se inició vacío, revisá el CSV exportado';
  var NO_STORAGE_MESSAGE = 'Almacenamiento no disponible — la partida no sobrevivirá a una recarga, pero podés seguir jugando.';
  var RECOVERY_SUFFIX = 'verificá historial antes de seguir';

  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatRecoveryBanner(savedAt) {
    var d = new Date(savedAt);
    var hhmm;
    var ddmmyyyy;
    if (isNaN(d.getTime())) {
      hhmm = '--:--';
      ddmmyyyy = '--/--';
    } else {
      hhmm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      ddmmyyyy = pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
    }
    return 'Partida recuperada del ' + hhmm + ' ' + ddmmyyyy + ' — ' + RECOVERY_SUFFIX;
  }

  // exportedAt marker (ISO) + count at last CSV export; guard fires only when
  // history grew since then. Cleared on export / discard / fresh boot.
  var exportedAt = null;
  var exportedCount = 0;

  function markExported() {
    var c = core();
    exportedAt = new Date().toISOString();
    exportedCount = c.state.history.length;
    return exportedAt;
  }

  function needsUnloadWarning() {
    var c = core();
    if (!c.state.history.length) return false;
    if (exportedAt == null) return true;
    return c.state.history.length > exportedCount;
  }

  function beforeUnloadHandler(e) {
    if (!needsUnloadWarning()) return undefined;
    if (e) {
      try { e.preventDefault(); } catch (err) {}
      e.returnValue = '';
    }
    return '';
  }

  function persistCurrentState(storage) {
    var c = core();
    var st = c.state;
    try {
      return storem().save({
        songs: st.songs,
        history: st.history,
        current: st.current,
        locked: st.locked,
        startedAt: st.startedAt
      }, storage);
    } catch (e) {
      return { ok: false, reason: 'unavailable' };
    }
  }

  function resetToEmpty() {
    var c = core();
    c.state.songs = [];
    c.state.history = [];
    c.state.current = null;
    c.state.spinning = false;
    c.state.locked = false;
  }

  // Validate-then-hydrate: full apply or empty, never partial. Forces
  // spinning=false (transient UI flag). Returns {status, banner}.
  function bootRestore(storage) {
    var c = core();
    var res;
    try {
      res = storem().load(storage);
    } catch (e) {
      return { status: 'no-storage', banner: NO_STORAGE_MESSAGE };
    }
    if (!res || typeof res !== 'object') return { status: 'empty', banner: null };
    if (res.ok && res.snapshot) {
      var s = res.snapshot;
      c.state.songs = Array.isArray(s.songs) ? s.songs : [];
      c.state.history = Array.isArray(s.history) ? s.history : [];
      c.state.current = s.current != null ? s.current : null;
      c.state.locked = s.locked === true;
      if (typeof s.startedAt === 'string' && s.startedAt) c.state.startedAt = s.startedAt;
      c.state.spinning = false;
      if (!c.state.songs.length && !c.state.history.length) return { status: 'empty', banner: null };
      return { status: 'restored', banner: formatRecoveryBanner(s.savedAt), savedAt: s.savedAt };
    }
    if (res.reason === 'unavailable') return { status: 'no-storage', banner: NO_STORAGE_MESSAGE };
    if (res.reason === 'empty') return { status: 'empty', banner: null };
    resetToEmpty();
    return { status: 'corrupt', banner: CORRUPT_MESSAGE };
  }

  function discardSession(storage, confirmFn) {
    var cf = confirmFn;
    if (typeof cf !== 'function') {
      if (typeof confirm !== 'undefined') cf = function (m) { return confirm(m); };
      else return false;
    }
    if (!cf('¿Descartar la partida recuperada y empezar de cero?')) return false;
    try { storem().clear(storage); } catch (e) {}
    resetToEmpty();
    exportedAt = null;
    exportedCount = 0;
    return true;
  }

  var channel = null;
  if (typeof window !== 'undefined' && ('BroadcastChannel' in window)) {
    try { channel = new BroadcastChannel(PUBLIC_CHANNEL); } catch (e) { channel = null; }
  }

  function buildStateMessage(phase) {
    var c = core();
    var st = c.state;
    var av = c.available();
    // C-08 public-screen: phased envelope. `spinning` withholds the committed
    // title BY CONSTRUCTION (current:null on the wire) so the projector never
    // spoils during the operator spin + 3 s VirtualDJ cue buffer. Any other
    // phase (incl. legacy no-arg callers) carries current as before.
    var ph = (typeof phase === 'string' && phase) ? phase : 'idle';
    // C-08 spoiler closure: the committed title lives in three places
    // (current, unconfirmed `drawn` history entries, song rows). The spinning
    // envelope scrubs all three — counters stay numeric so the projector can
    // still pin counter/last-5 without ever seeing the in-flight title.
    var outSongs = st.songs;
    var outHistory = st.history;
    var outCurrent = null;
    if (ph === 'spinning') {
      outSongs = st.songs.map(function (s) {
        if (s.status !== 'drawn') return s;
        return { id: s.id, title: '', artist: '', status: s.status, addedAt: s.addedAt };
      });
      outHistory = st.history.filter(function (h) { return h.status !== 'drawn'; });
    } else if (st.current) {
      // C-08: id included so the projector can dedupe off (phase, current.id).
      outCurrent = { id: st.current.id, title: st.current.title, artist: st.current.artist, status: st.current.status };
    }
    return {
      type: 'state',
      phase: ph,
      songs: outSongs,
      history: outHistory,
      current: outCurrent,
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

  // C-08 public-screen: named public reveal delay (ms), independent of the
  // C-03 spin base (SPIN_MS=2750 in draw.js). NEVER merge one into the other:
  // retuning here moves only the projector reveal, never commit nor spin.
  var REVEAL_DELAY_MS = 3000;

  // C-08 buffer timer owned by app.js (spin timer stays in draw.js), reusing
  // the draw.js injectable-timer pattern so tests drive both deterministically.
  var publicRevealTimer = null;
  var publicTimerFns = null;

  function setPublicTimerFns(fns) { publicTimerFns = fns || null; }
  function resetPublicTimerFns() { publicTimerFns = null; }

  function getPublicSetTimeout() {
    if (publicTimerFns && typeof publicTimerFns.setTimeoutFn === 'function') return publicTimerFns.setTimeoutFn;
    return function (cb, ms) { return setTimeout(cb, ms); };
  }

  function getPublicClearTimeout() {
    if (publicTimerFns && typeof publicTimerFns.clearTimeoutFn === 'function') return publicTimerFns.clearTimeoutFn;
    return function (id) { clearTimeout(id); };
  }

  function schedulePublicReveal(fn, delayMs) {
    cancelPublicReveal();
    var delay = (typeof delayMs === 'number') ? delayMs : REVEAL_DELAY_MS;
    publicRevealTimer = getPublicSetTimeout()(function () {
      publicRevealTimer = null; // null-before-invoke: a racing cancel stays a safe no-op
      fn();
    }, delay);
    return publicRevealTimer;
  }

  // Idempotent; clears the buffer handle only — `spinning` resets via finishCommit.
  function cancelPublicReveal() {
    if (publicRevealTimer === null || publicRevealTimer === undefined) return false;
    var id = publicRevealTimer;
    publicRevealTimer = null;
    try { getPublicClearTimeout()(id); } catch (e) { /* already fired: no-op */ }
    return true;
  }

  function isPublicBuffer() { return publicRevealTimer !== null && publicRevealTimer !== undefined; }

  function broadcast(a, b) {
    // Overload: broadcast('spinning'|'reveal'|'idle', storage?) or legacy
    // broadcast(storage?). No-arg callers (render, openPublic re-sync) get the
    // phase computed from live state: title-free while spinning/buffering.
    var phase = null;
    var storage;
    if (typeof a === 'string') { phase = a; storage = b; }
    else { storage = a; }
    if (!phase) {
      var c = core();
      var st = c.state;
      phase = (st.spinning || isPublicBuffer()) ? 'spinning' : (st.current ? 'reveal' : 'idle');
    }
    var msg = buildStateMessage(phase);
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
    var counters = reviewCounters(st.songs);
    $('totalStat').textContent = counters.total;
    $('remainingStat').textContent = counters.available;
    $('drawnStat').textContent = counters.drawn;
    // C-08: draw/confirm stay disabled through the spin AND the 3 s public
    // buffer — isPublicBuffer() OR-ed with spinning (single predicate).
    $('drawBtn').disabled = !av.length || st.spinning || isPublicBuffer();
    $('confirmBtn').disabled = !st.current || st.current.status !== 'drawn' || st.spinning || isPublicBuffer();
    $('statusText').textContent = !st.songs.length ? 'Esperando listado de canciones'
      : !av.length ? 'No quedan canciones disponibles'
      : st.current && st.current.status === 'drawn' ? 'Canción sorteada: buscala en VirtualDJ'
      : 'Listo para el próximo sorteo';
    var filtered = filterSongs(st.songs, $('filterInput').value);
    $('songList').innerHTML = filtered.length ? filtered.map(function (s, i) {
      return '<div class="song"><span class="num">' + String(i + 1).padStart(2, '0') + '</span><div class="songtext"><strong>' + c.esc(s.title) + '</strong><small>' + c.esc(artistLabel(s.artist)) + '</small></div><span class="pill ' + (s.status === 'played' ? 'done' : s.status === 'void' ? '' : 'pending') + '">' + (s.status === 'played' ? 'Reproducida' : s.status === 'void' ? 'Anulada' : s.status === 'drawn' ? 'Sorteada' : 'Disponible') + '</span></div>';
    }).join('') : '<div class="empty">No hay coincidencias.</div>';
    $('historyCount').textContent = st.history.length + ' registro' + (st.history.length === 1 ? '' : 's');
    $('historyList').innerHTML = st.history.length ? [].concat(st.history).reverse().map(function (h) {
      return '<div class="historyitem"><div class="historynum">' + String(h.n).padStart(2, '0') + '</div><div style="flex:1"><b>' + c.esc(h.title) + '</b><span>' + c.esc(h.artist || 'Artista no especificado') + ' · ' + c.esc(h.time) + '</span><span>' + (h.status === 'played' ? '✓ Reproducida' : h.status === 'void' ? '! Anulada por incidencia' : '● Sorteada') + '</span></div></div>';
    }).join('') : '<div class="empty">Todavía no hubo sorteos.</div>';
    broadcast();
    try { persistCurrentState(); } catch (e) {}
  }

  function setCurrentStatus(status) {
    var c = core();
    var st = c.state;
    // C-03 draw-engine spinning guard + C-08 public-buffer guard: confirm
    // blocked mid-spin AND mid-buffer, no effect until the public reveal
    // completes (C-09 confirm gates on this: sin giro ni buffer pendiente).
    if (st.spinning || isPublicBuffer()) return;
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
    // C-08 buffer guard first (Node-testable): mid-buffer draws are no-ops
    // even before reaching the DOM path below.
    if (isPublicBuffer()) return null;
    if (typeof document === 'undefined') return null;
    var c = core();
    var st = c.state;
    if (st.spinning || isPublicBuffer() || !c.available().length) return null;
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
    // C-08: commit-time envelope is title-free on both screens (wheels spin).
    broadcast('spinning');
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
      // C-08 asymmetric reveal (intentional): the operator reads the title NOW
      // to cue VirtualDJ manual; the projector keeps the cabin message until
      // the buffer elapses — hence `spinning`, never `reveal`, on this broadcast.
      broadcast('spinning');
      schedulePublicReveal(function () {
        broadcast('reveal');
        render();
      });
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

  // C-04 import-catalog freeze: offline formats accepted on this path are
  // pasted text lines `Artista - Titulo` (separators `-`/–/—), CSV/TSV rows
  // `artista,titulo` (`,`/`;`/tab, first cell = artist, rest = title, except
  // URL-led rows which fall back to line parsing), and the 12-song demo seed.
  // Header first-line (`titulo/cancion/song/track` + separator) is skipped.
  // Dedupe key `title|artist` (lowercase, no diacritics, collapsed spaces);
  // reports are never silent. `toLocaleLowerCase` may vary by OS locale
  // (Turkish-i edge) — acceptable for v1 volumes; Spanish corpus in tests.
  //
  // Locked guard (design decision 5): message + no-op, no `locked` mutation.
  // Unlock flow (motivo + doble confirm + audit entry) lives in C-11, which
  // must reuse BLOCKED_MESSAGE verbatim (tests assert copy-paste equality).
  var BLOCKED_MESSAGE = 'Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.';

  function isImportBlocked() {
    return core().state.locked === true;
  }

  function setImportMessage(msg) {
    if (typeof document === 'undefined') return;
    var el = document.getElementById('importMessage');
    if (el) el.textContent = msg;
  }

  // Single guard shared by paste/demo/file handlers (design risk mitigation).
  function guardedImport(items, label) {
    if (isImportBlocked()) {
      setImportMessage(BLOCKED_MESSAGE);
      return { added: 0, duplicates: 0, message: BLOCKED_MESSAGE, blocked: true };
    }
    return imp().importSongs(items, label);
  }

  function handlePasteImport(text) {
    return guardedImport(imp().parseText(text), 'texto');
  }

  function handleDemoImport() {
    return guardedImport(buildDemoSongs(), 'demo');
  }

  // Review surface helpers (pure, Node-testable; render() consumes them).
  function reviewCounters(songs) {
    var list = Array.isArray(songs) ? songs : [];
    var av = list.filter(function (s) { return s.status === 'available'; }).length;
    return { total: list.length, available: av, drawn: list.length - av };
  }

  function filterSongs(songs, q) {
    var list = Array.isArray(songs) ? songs : [];
    var needle = String(q == null ? '' : q).trim().toLocaleLowerCase();
    if (!needle) return list.slice();
    return list.filter(function (s) {
      return (s.title + ' ' + s.artist).toLocaleLowerCase().indexOf(needle) !== -1;
    });
  }

  function artistLabel(artist) {
    return artist || 'Artista no especificado';
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
  function _resetPublicWinForTest() { publicWin = null; }
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
      cancelPublicReveal();
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
    // C-08: cancel BOTH the spin timer and the pending public reveal so no
    // ghost result resurrects cleared state (mid-spin or mid-buffer alike).
    d.cancelReveal();
    cancelPublicReveal();
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
      cancelPublicReveal();
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
    cancelPublicReveal();
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

  function showBootBanner(boot) {
    if (typeof document === 'undefined') return;
    if (!boot || !boot.banner) return;
    var bar = document.getElementById('restoreBanner');
    var txt = document.getElementById('restoreBannerText');
    if (!bar || !txt) return;
    txt.textContent = boot.banner;
    var disc = document.getElementById('discardSession');
    if (disc) disc.style.display = boot.status === 'corrupt' ? 'none' : '';
    bar.classList.remove('hidden');
  }

  function hideBootBanner() {
    if (typeof document === 'undefined') return;
    var bar = document.getElementById('restoreBanner');
    if (bar) bar.classList.add('hidden');
  }

  function initApp() {
    if (typeof document === 'undefined') return;
    var $ = function (id) { return document.getElementById(id); };
    // C-06 boot: validate-then-hydrate + mandatory banner + beforeunload.
    var boot = null;
    try { boot = bootRestore(); } catch (e) { boot = null; }
    showBootBanner(boot);
    try {
      if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
        window.addEventListener('beforeunload', beforeUnloadHandler);
      }
    } catch (e) {}
    var disc = $('discardSession');
    if (disc) disc.addEventListener('click', function () {
      if (discardSession(undefined, undefined)) { hideBootBanner(); render(); }
    });
    var dism = $('dismissBanner');
    if (dism) dism.addEventListener('click', hideBootBanner);
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
      handlePasteImport($('pasteInput').value);
      $('pasteInput').value = '';
      $('pasteArea').classList.add('hidden');
    });
    $('filterInput').addEventListener('input', render);
    $('clearSongs').addEventListener('click', handleClearSongs);
    $('resetAll').addEventListener('click', handleResetAll);
    $('sampleBtn').addEventListener('click', function () { handleDemoImport(); });
    $('exportLog').addEventListener('click', function () {
      var c = core();
      download(new Blob([buildCsv(c.state.history)], { type: 'text/csv;charset=utf-8' }), 'music-bingo-historial.csv');
      try { markExported(); } catch (e) {}
    });
    $('openPublic').addEventListener('click', openPublic);
    $('fileInput').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      if (isImportBlocked()) {
        setImportMessage(BLOCKED_MESSAGE);
        e.target.value = '';
        return;
      };
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
    REVEAL_DELAY_MS: REVEAL_DELAY_MS,
    isPublicBuffer: isPublicBuffer,
    schedulePublicReveal: schedulePublicReveal,
    cancelPublicReveal: cancelPublicReveal,
    setPublicTimerFns: setPublicTimerFns,
    resetPublicTimerFns: resetPublicTimerFns,
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
    BLOCKED_MESSAGE: BLOCKED_MESSAGE,
    isImportBlocked: isImportBlocked,
    guardedImport: guardedImport,
    handlePasteImport: handlePasteImport,
    handleDemoImport: handleDemoImport,
    reviewCounters: reviewCounters,
    filterSongs: filterSongs,
    artistLabel: artistLabel,
    openPublic: openPublic,
    _resetPublicWinForTest: _resetPublicWinForTest,
    initApp: initApp,
    CORRUPT_MESSAGE: CORRUPT_MESSAGE,
    NO_STORAGE_MESSAGE: NO_STORAGE_MESSAGE,
    formatRecoveryBanner: formatRecoveryBanner,
    bootRestore: bootRestore,
    discardSession: discardSession,
    persistCurrentState: persistCurrentState,
    markExported: markExported,
    needsUnloadWarning: needsUnloadWarning,
    beforeUnloadHandler: beforeUnloadHandler,
    showBootBanner: showBootBanner,
    hideBootBanner: hideBootBanner
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.app;
  }
})(typeof window !== 'undefined' ? window : globalThis);
