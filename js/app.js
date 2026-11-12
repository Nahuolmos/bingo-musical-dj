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
        startedAt: st.startedAt,
        // C-17: additive gate flag (no schema bump; missing hydrates false).
        awaitingGate: awaitingGate === true
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
    // C-17: vaciar el tablero también suelta el gate (sin current no hay
    // espera que restaurar; boot corrupto nunca resucita un gate).
    cancelAwaitingGate();
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
      // C-17: el gate pendiente sobrevive al refresh solo junto a su commit
      // dibujado (flag + current drawn). Snapshots pre-change (sin flag) o
      // inconsistentes (flag sin current) hidratan sin gate, sin timeout ni
      // auto-reveal — el DJ decide al reabrir.
      awaitingGate = (s.awaitingGate === true && c.state.current != null && c.state.current.status === 'drawn');
      // Locked-but-empty is still a session: the operator must see the banner
      // (+ "Descartar y empezar de cero" escape) instead of a silent fresh
      // boot, otherwise a cleared-while-locked snapshot bricks imports with
      // no visible recovery until the C-11 admin unlock exists.
      if (!c.state.songs.length && !c.state.history.length && s.locked !== true) return { status: 'empty', banner: null };
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
    // spoils during the 5 s VirtualDJ cue buffer. Any other
    // phase (incl. legacy no-arg callers) carries current as before.
    var ph = (typeof phase === 'string' && phase) ? phase : 'idle';
    // C-08 spoiler closure: the committed title lives in three places
    // (current, unconfirmed `drawn` history entries, song rows). The spinning
    // envelope scrubs all three — counters stay numeric so the projector can
    // still pin counter/last-5 without ever seeing the in-flight title.
    var outSongs = st.songs;
    var outHistory = st.history;
    var outCurrent = null;
    // C-15 word-scroll: transient wire-only snapshot of the REMAINING pool
    // for the public ticker. Built from available() AFTER the commit, so the
    // drawn song already left the pool — exclusion is structural (by id),
    // never sent to mbdj.v1. Empty when the draw exhausts the catalog.
    var scrollPool = null;
    // C-17 gated wait: same title-free scrub as `spinning` (current null,
    // drawn songs/artists/covers blanked, drawn history withheld) but WITHOUT
    // `scrollPool` — nothing scrolls until the DJ triggers the gate. The pool
    // is built fresh at gate time, never persisted.
    if (ph === 'spinning' || ph === 'awaiting-gate') {
      outSongs = st.songs.map(function (s) {
        if (s.status !== 'drawn') return s;
        // C-16 anti-spoiler: the scrubbed clone also drops coverUrl so the
        // committed artwork never leaks during the spinning buffer.
        return { id: s.id, title: '', artist: '', status: s.status, addedAt: s.addedAt, coverUrl: null };
      });
      outHistory = st.history.filter(function (h) { return h.status !== 'drawn'; });
      if (ph === 'spinning') {
        scrollPool = av.map(function (s) {
          return { id: s.id, title: s.title, artist: s.artist };
        });
      }
    } else if (st.current) {
      // C-08: id included so the projector can dedupe off (phase, current.id).
      // C-16: coverUrl travels for the reveal image (null when coverless).
      outCurrent = { id: st.current.id, title: st.current.title, artist: st.current.artist, status: st.current.status, coverUrl: (st.current.coverUrl == null ? null : st.current.coverUrl) };
    }
    return {
      type: 'state',
      phase: ph,
      songs: outSongs,
      history: outHistory,
      current: outCurrent,
      scrollPool: scrollPool,
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

  // C-15 public-screen: named public reveal delay (ms). The retired C-03
  // operator spin base is gone — this constant owns the only timed window.
  // Retuning here moves only the projector reveal, never the commit.
  var REVEAL_DELAY_MS = 5000;

  // C-08 buffer timer owned by app.js, reusing the injectable-timer pattern
  // so tests drive it deterministically.
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

  // Idempotent; clears the buffer handle only.
  function cancelPublicReveal() {
    if (publicRevealTimer === null || publicRevealTimer === undefined) return false;
    var id = publicRevealTimer;
    publicRevealTimer = null;
    try { getPublicClearTimeout()(id); } catch (e) { /* already fired: no-op */ }
    return true;
  }

  function isPublicBuffer() { return publicRevealTimer !== null && publicRevealTimer !== undefined; }

  // C-17 gated reveal: el commit arma un gate pendiente — el DJ ve el
  // resultado en privado y la pública espera en neutro hasta que el DJ
  // pulsa Revelar. El flag vive en memoria + mbdj.v1 (aditivo, sin bump).
  // El predicado excluye el buffer: gate y buffer nunca coexisten (el gate
  // se consume síncrono antes de programar el buffer).
  var awaitingGate = false;

  function isAwaitingGate() { return awaitingGate === true && !isPublicBuffer(); }

  function _resetGateForTest() { awaitingGate = false; }

  function cancelAwaitingGate() {
    if (awaitingGate !== true) return false;
    awaitingGate = false;
    return true;
  }

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
      // C-17: el gate pendiente rutea a la espera neutra (nunca al título).
      phase = isAwaitingGate() ? 'awaiting-gate' : (isPublicBuffer() ? 'spinning' : (st.current ? 'reveal' : 'idle'));
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
    // C-15: draw/confirm stay disabled through the 5 s public buffer —
    // isPublicBuffer() is the single predicate (no operator spin remains).
    // C-17 re-key: draw + confirm stand down through gate AND buffer
    // (`isAwaitingGate() || isPublicBuffer()`, no other term). The reveal
    // control is the only action enabled mid-gate (own predicate above).
    $('drawBtn').disabled = !av.length || isAwaitingGate() || isPublicBuffer();
    $('confirmBtn').disabled = !st.current || st.current.status !== 'drawn' || isAwaitingGate() || isPublicBuffer();
    // C-17: el control de reveal vive solo con gate pendiente (solo dashboard).
    // Null-safe: harnesses que stubbean un subset de ids igual reciben el
    // flag (el stub crea el id bajo demanda); en browser el id siempre existe.
    var gateBtn = $('revealGateBtn');
    if (gateBtn) {
      gateBtn.hidden = !isAwaitingGate();
      gateBtn.disabled = !isAwaitingGate();
    }
    // C-17: refresh mid-gate — el dashboard privado restaura el resultado
    // commiteado (mismo paint que handleDrawClick, idempotente en cada
    // render). Sin current dibujado el panel no se toca (played/void ya lo
    // ocultaron; el boot limpio arranca oculto en el HTML).
    if (st.current && st.current.status === 'drawn') {
      var dh = $('drawHeading'); if (dh) dh.textContent = '¡Esta es la canción!';
      var dd = $('drawDesc'); if (dd) dd.textContent = 'Buscala en VirtualDJ y reproducila. Cuando termine de sonar, marcala como reproducida.';
      var rt = $('resultTitle'); if (rt) rt.textContent = st.current.title;
      var ra = $('resultArtist'); if (ra) ra.textContent = st.current.artist || 'Artista no especificado';
      var rp = $('result');
      if (rp && rp.classList && typeof rp.classList.add === 'function') {
        try { rp.classList.add('show'); } catch (e) {}
      }
    }
    // C-11 session-lock: every mutation control stands down while locked
    // (import/file/edit/clear/reset) and the admin unlock arms itself ONLY
    // while locked. Single isImportBlocked() predicate — one funnel, no drift.
    // Null-safe: some harnesses stub a subset of ids. Filter stays enabled
    // (search never mutates).
    (function lockDisables() {
      var off = st.locked === true;
      var ids = ['fileInput', 'pasteToggle', 'parsePaste', 'sampleBtn', 'clearSongs', 'resetAll'];
      for (var di = 0; di < ids.length; di++) {
        var node = $(ids[di]);
        if (node) node.disabled = off;
      }
      var unlock = $('unlockBtn');
      if (unlock) unlock.disabled = !off;
    })();
    $('statusText').textContent = !st.songs.length ? 'Esperando listado de canciones'
      : !av.length ? 'No quedan canciones disponibles'
      : st.current && st.current.status === 'drawn' ? 'Canción sorteada: buscala en VirtualDJ'
      : 'Listo para el próximo sorteo';
    var filtered = filterSongs(st.songs, $('filterInput').value);
    // C-09: motivo lives on the history entry (audit record); the song row
    // keeps status only. The list resolves the display motivo from the last
    // matching entry (escaped via esc — free text, no markup surface).
    function motivoForSong(songId) {
      var found = '';
      for (var mi = 0; mi < st.history.length; mi++) {
        if (st.history[mi].id === songId && typeof st.history[mi].motivo === 'string' && st.history[mi].motivo) {
          found = st.history[mi].motivo;
        }
      }
      return found;
    }
    $('songList').innerHTML = filtered.length ? filtered.map(function (s, i) {
      var pill = (s.status === 'played' ? 'Reproducida' : s.status === 'void' ? 'Anulada' : s.status === 'drawn' ? 'Sorteada' : 'Disponible');
      if (s.status === 'void') {
        var mv = motivoForSong(s.id);
        if (mv) pill = 'Anulada — ' + c.esc(mv);
      }
      // C-11 edit affordance: per-row correction via handleEditRequest
      // (prompt seam). Disabled while locked — the seam refuses anyway
      // (defense in depth: UI disable + guard-first refusal).
      // C-16 cover affordance: per-row input+Fijar+preview via
      // handleCoverRequest (no prompt, no fetch). Same lock gating.
      var editOff = (st.locked === true) ? ' disabled' : '';
      var coverVal = (s.coverUrl == null) ? '' : String(s.coverUrl);
      return '<div class="song"><span class="num">' + String(i + 1).padStart(2, '0') + '</span><div class="songtext"><strong>' + c.esc(s.title) + '</strong><small>' + c.esc(artistLabel(s.artist)) + '</small></div><span class="pill ' + (s.status === 'played' ? 'done' : s.status === 'void' ? '' : 'pending') + '">' + pill + '</span><button class="subtle" data-edit-id="' + c.esc(s.id) + '"' + editOff + '>Editar</button><div class="coverrow"><span class="coverprev">' + coverPreviewHTML(s) + '</span><input class="coverinput" data-cover-for="' + c.esc(s.id) + '" value="' + c.esc(coverVal) + '" placeholder="URL https://… o archivo" maxlength="500"' + editOff + '><button class="subtle" data-cover-set="' + c.esc(s.id) + '"' + editOff + '>Fijar</button></div></div>';
    }).join('') : '<div class="empty">No hay coincidencias.</div>';
    $('historyCount').textContent = st.history.length + ' registro' + (st.history.length === 1 ? '' : 's');
    $('historyList').innerHTML = st.history.length ? [].concat(st.history).reverse().map(function (h) {
      // C-10 unlock reservation: song-less admin entries (future C-11) render
      // their own status visibly — never mislabeled Sorteada, never crashing
      // on ids with no song row. Drawn/played/void copies stay frozen (C-09).
      var stateCopy = (h.status === 'played' ? '✓ Reproducida' : h.status === 'void' ? '! Anulada por incidencia' : h.status === 'drawn' ? '● Sorteada' : '○ ' + c.esc(h.status == null ? '' : h.status));
      if (h.status === 'void' && typeof h.motivo === 'string' && h.motivo) stateCopy += ' — ' + c.esc(h.motivo);
      else if (h.status !== 'played' && h.status !== 'drawn' && typeof h.motivo === 'string' && h.motivo) stateCopy += ' — ' + c.esc(h.motivo);
      return '<div class="historyitem"><div class="historynum">' + String(h.n).padStart(2, '0') + '</div><div style="flex:1"><b>' + c.esc(h.title) + '</b><span>' + c.esc(h.artist || 'Artista no especificado') + ' · ' + c.esc(h.time) + '</span><span>' + stateCopy + '</span></div></div>';
    }).join('') : '<div class="empty">Todavía no hubo sorteos.</div>';
    broadcast();
    try { persistCurrentState(); } catch (e) {}
  }

  // C-09 confirm-void: single confirm path. Played passes no motivo; void
  // passes the trimmed reason stored on the history entry (audit record).
  function setCurrentStatus(status, motivo) {
    var c = core();
    var st = c.state;
    // C-17 gate+buffer guard: confirm blocked mid-gate and mid-buffer, no
    // effect until the public reveal completes (C-09 confirm gates on this).
    if (isAwaitingGate() || isPublicBuffer()) return;
    if (!st.current || st.current.status !== 'drawn') return;
    st.current.status = status;
    var h = null;
    if (st.history.findLast) h = st.history.findLast(function (x) { return x.id === st.current.id; });
    else h = [].concat(st.history).reverse().find(function (x) { return x.id === st.current.id; });
    if (h) {
      h.status = status;
      if (status === 'void' && typeof motivo === 'string' && motivo) h.motivo = motivo;
    }
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

  // C-09 confirm-void: injectable void seam (prompt/confirm are boundaries —
  // tests pass mocks, the click handler passes the real modals). Gate order:
  // current/drawn → buffer → prompt → empty-check → confirm.
  // Returns true only when the void commits; false leaves state untouched.
  function handleVoidRequest(promptFn, confirmFn) {
    var c = core();
    var st = c.state;
    if (!st.current || st.current.status !== 'drawn') return false;
    // C-17 gate+buffer guard: the prompt never fires mid-gate/mid-buffer.
    if (isAwaitingGate() || isPublicBuffer()) return false;
    var pf = (typeof promptFn === 'function') ? promptFn
      : (typeof prompt !== 'undefined' ? function (m) { return prompt(m); } : null);
    if (!pf) return false;
    var raw = pf('Motivo de la anulación (obligatorio):');
    if (raw == null) return false;
    var motivo = String(raw).trim();
    if (!motivo) return false;
    var cf = (typeof confirmFn === 'function') ? confirmFn
      : (typeof confirm !== 'undefined' ? function (m) { return confirm(m); } : null);
    if (!cf) return false;
    if (!cf('¿Registrar esta canción como anulada por una incidencia real? Quedará excluida del sorteo.')) return false;
    setCurrentStatus('void', motivo);
    return true;
  }

  // C-11 session-lock: administrative unlock seam (the single WRITER of
  // song-less unlock audit entries). Mirrors handleVoidRequest gate order:
  // locked? → prompt motivo → trim/empty-check → confirm #1 → confirm #2 →
  // commit (entry + locked=false + render which persists via C-06 autosave).
  // Returns true only when the unlock commits; false leaves state untouched.
  // Guard-first: on an unlocked session or an aborted prompt/confirm, no
  // modal beyond the aborted one fires, no timer is touched, nothing mutates.
  function handleUnlockRequest(promptFn, confirmFn) {
    var c = core();
    var st = c.state;
    if (st.locked !== true) return false;
    var pf = (typeof promptFn === 'function') ? promptFn
      : (typeof prompt !== 'undefined' ? function (m) { return prompt(m); } : null);
    if (!pf) return false;
    var raw = pf('Motivo del desbloqueo administrativo (obligatorio):');
    if (raw == null) return false;
    var motivo = String(raw).trim();
    if (!motivo) return false;
    var cf = (typeof confirmFn === 'function') ? confirmFn
      : (typeof confirm !== 'undefined' ? function (m) { return confirm(m); } : null);
    if (!cf) return false;
    if (!cf('¿Desbloquear la lista para edición administrativa? Quedará registro en el historial.')) return false;
    if (!cf('Confirmá el desbloqueo: la lista quedará editable.')) return false;
    st.history.push(c.createUnlockEntry(st.history.length + 1, motivo));
    st.locked = false;
    if (typeof document !== 'undefined') render();
    return true;
  }

  // C-11 session-lock: list-edit seam (title/artist correction). While locked
  // there is no admin path through here — refusal is total via the shared
  // BLOCKED_MESSAGE funnel (guard-first: prompt never fires). Unlocked, two
  // prompts collect the new title (mandatory) + artist; cancel/empty title
  // aborts with no mutation. Edits write no history entry (the unlock itself
  // is the audit record) and never change song status.
  function handleEditRequest(songId, promptFn) {
    var c = core();
    var st = c.state;
    if (st.locked === true) {
      setImportMessage(BLOCKED_MESSAGE);
      return { blocked: true, message: BLOCKED_MESSAGE };
    }
    var song = null;
    for (var i = 0; i < st.songs.length; i++) {
      if (st.songs[i].id === songId) { song = st.songs[i]; break; }
    }
    if (!song) return { ok: false, reason: 'not-found' };
    var pf = (typeof promptFn === 'function') ? promptFn
      : (typeof prompt !== 'undefined' ? function (m, preset) { return prompt(m, preset); } : null);
    if (!pf) return { ok: false, reason: 'no-prompt' };
    var rawTitle = pf('Nuevo título:', song.title);
    if (rawTitle == null) return { ok: false, reason: 'aborted' };
    var title = String(rawTitle).trim();
    if (!title) return { ok: false, reason: 'aborted' };
    var rawArtist = pf('Nuevo artista (vacío = sin artista):', song.artist);
    if (rawArtist == null) return { ok: false, reason: 'aborted' };
    song.title = title;
    song.artist = String(rawArtist).trim();
    if (typeof document !== 'undefined') render();
    return { ok: true, song: song };
  }
  // C-16 song-covers: manual per-row cover seam. Guard-first locked refusal
  // (same BLOCKED_MESSAGE funnel as edits; no prompt, no fetch, no mutation).
  // normalize: trim; '' -> null (clear); http(s) -> remote as-is; bare
  // filename without / \ .. or markup -> assets/covers/<name>; rest rejected.
  var COVER_INVALID_MESSAGE = 'Tapa no válida. Usá una URL https://… o un nombre de archivo en assets/covers/.';
  var COVERS_DIR = 'assets/covers/';

  // C-18: coverCache persistente (IndexedDB con respaldo en memoria).
  // IndexedDB está disponible en file:// y persiste entre recargas del mismo origen.
  // get() es síncrono (usa memoria); set() escribe memoria + IndexedDB fire-and-forget.
  var appCoverCache = {
    _db: null,
    _mem: {},
    _opened: false,
    open: function () {
      if (this._opened) return Promise.resolve();
      this._opened = true;
      if (typeof indexedDB === 'undefined') return Promise.resolve();
      var self = this;
      return new Promise(function (resolve) {
        var req = indexedDB.open('music-bingo-dj-covers', 1);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('covers')) {
            db.createObjectStore('covers', { keyPath: 'key' });
          }
        };
        req.onsuccess = function (e) { self._db = e.target.result; resolve(); };
        req.onerror = function () { resolve(); };
      });
    },
    get: function (key) {
      if (this._mem && this._mem[key]) return this._mem[key];
      return null;
    },
    set: function (key, url, source) {
      if (this._mem) this._mem[key] = url;
      if (!this._db) return;
      try {
        var tx = this._db.transaction('covers', 'readwrite');
        var store = tx.objectStore('covers');
        store.put({ key: key, url: url, source: source });
      } catch (e) { /* IndexedDB write failed: memory cache still works */ }
    }
  };

  // C-18: resolveCoverLocal construye rutas candidatas en assets/covers/ sin validar
  // existencia de archivo (no hay forma síncrona en file://). La pública las intenta
  // con img.onerror → placeholder si fallan. Orden: sencillo → artista → título.
  // Usa normalización local (minúsculas, espacios colapsados) sin depender de import.js.
  function normStrSimple(s) {
    return String(s == null ? '' : s).toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  }
  function resolveCoverLocal(song) {
    if (!song) return null;
    var artist = normStrSimple(song.artist || '');
    var title = normStrSimple(song.title || '');
    if (!artist && !title) return null;
    if (artist && title) return COVERS_DIR + artist + ' - ' + title + '.jpg';
    if (artist) return COVERS_DIR + artist + '.jpg';
    if (title) return COVERS_DIR + title + '.jpg';
    return null;
  }

  function normalizeCoverValue(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) return { ok: true, value: null, cleared: true };
    if (/^https?:\/\//i.test(v)) return { ok: true, value: v };
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return { ok: false, reason: 'invalid' };
    if (v.indexOf('/') !== -1 || v.indexOf('\\') !== -1 || v.indexOf('..') !== -1) return { ok: false, reason: 'invalid' };
    if (/[<>"']/.test(v)) return { ok: false, reason: 'invalid' };
    return { ok: true, value: COVERS_DIR + v };
  }

  function handleCoverRequest(songId, raw, opts) {
    var c = core();
    var st = c.state;
    if (st.locked === true) {
      setImportMessage(BLOCKED_MESSAGE);
      return { blocked: true, message: BLOCKED_MESSAGE };
    }
    var song = null;
    for (var i = 0; i < st.songs.length; i++) {
      if (st.songs[i].id === songId) { song = st.songs[i]; break; }
    }
    if (!song) return { ok: false, reason: 'not-found' };
    var norm = normalizeCoverValue(raw);
    if (!norm.ok) {
      setImportMessage(COVER_INVALID_MESSAGE);
      return { ok: false, reason: 'invalid', message: COVER_INVALID_MESSAGE };
    }
    song.coverUrl = norm.value;
    var storage = opts && opts.storage;
    try { persistCurrentState(storage); } catch (e) {}
    if (typeof document !== 'undefined') { try { render(); } catch (e2) {} }
    return { ok: true, song: song };
  }

  // C-16 operator preview: remote/local image with onerror swap to the
  // placeholder glyph (never breaks the row when a remote is offline).
  function coverPreviewHTML(song) {
    var c = core();
    if (!song || song.coverUrl == null || String(song.coverUrl).trim() === '') {
      return '<span class="coverph" title="Sin tapa">♪</span>';
    }
    return '<img class="coverthumb" src="' + c.esc(String(song.coverUrl)) + '" alt="" loading="lazy" onerror="if(window.MBDJ&&MBDJ.app&&MBDJ.app.coverImgFallback)MBDJ.app.coverImgFallback(this)">';
  }

  function coverImgFallback(el) {
    try {
      if (typeof document === 'undefined' || !el || !el.parentNode) return;
      var s = document.createElement('span');
      s.className = 'coverph';
      s.setAttribute('title', 'Sin tapa');
      s.textContent = '♪';
      el.parentNode.replaceChild(s, el);
    } catch (e) {}
  }

  function readCoverInput(container, songId) {
    try {
      if (!container || !container.getElementsByTagName) return '';
      var inputs = container.getElementsByTagName('input');
      for (var i = 0; i < inputs.length; i++) {
        var n = inputs[i];
        if (n && n.getAttribute && n.getAttribute('data-cover-for') === songId) {
          return ('value' in n) ? n.value : '';
        }
      }
    } catch (e) {}
    return '';
  }

  // C-09 confirm-void: copy seam for manual VirtualDJ cue (clipboard +
  // legacy prompt fallback). Pure boundary: tests inject mocks, the click
  // handler injects the real clipboard/prompt. Never mutates draw state.
  function formatCopyText(song) {
    if (!song) return null;
    return song.title + (song.artist ? ' — ' + song.artist : '');
  }

  function handleCopyRequest(clipboardWriteFn, promptFn) {
    var c = core();
    if (!c.state.current) return null;
    var text = formatCopyText(c.state.current);
    if (typeof clipboardWriteFn === 'function') {
      try {
        clipboardWriteFn(text);
      } catch (e) {
        var pf1 = (typeof promptFn === 'function') ? promptFn
          : (typeof prompt !== 'undefined' ? function (m, preset) { return prompt(m, preset); } : null);
        if (pf1) { try { pf1('Copiá el resultado:', text); } catch (e2) {} }
      }
      return text;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text);
        return text;
      }
    } catch (e) {}
    var pf = (typeof promptFn === 'function') ? promptFn
      : (typeof prompt !== 'undefined' ? function (m, preset) { return prompt(m, preset); } : null);
    if (pf) { try { pf('Copiá el resultado:', text); } catch (e2) {} }
    return text;
  }

  // Secure draw UI flow: commit via draw.pickAndCommit() BEFORE paint.
  // C-15 instant result: the dashboard shows title+artist+copy the instant
  // the commit lands — no operator wheel animation, no operator-side timer.
  // C-17 gated reveal: the commit NO LONGER starts the 5 s public buffer.
  // It paints the private dashboard result, emits the neutral `awaiting-gate`
  // wait to the public screen, and arms the gate. The buffer starts only
  // when the DJ triggers handleRevealGate() (fresh scrollPool at gate time).
  function handleDrawClick() {
    // C-17 gate+buffer guard first (Node-testable): mid-gate and mid-buffer
    // draws are no-ops even before reaching the DOM path below.
    if (isAwaitingGate() || isPublicBuffer()) return null;
    if (typeof document === 'undefined') return null;
    var c = core();
    var st = c.state;
    if (isAwaitingGate() || isPublicBuffer() || !c.available().length) return null;
    // Commit-before-render (RN-SOR-02): the song is decided + persisted here;
    // the paint below only renders the committed song (never decides).
    var s = drawm().pickAndCommit();
    if (!s) return null;
    var $ = function (id) { return document.getElementById(id); };
    // Instant dashboard result: title + artist + copy available at once.
    $('wheel').classList.remove('spin');
    $('wheelText').textContent = s.title.length > 19 ? s.title.slice(0, 17) + '…' : s.title;
    $('wheelSub').textContent = s.artist || 'Tema sorteado';
    $('drawHeading').textContent = '¡Esta es la canción!';
    $('drawDesc').textContent = 'Buscala en VirtualDJ y reproducila. Cuando termine de sonar, marcala como reproducida.';
    $('resultTitle').textContent = s.title;
    $('resultArtist').textContent = s.artist || 'Artista no especificado';
    $('result').classList.add('show');
    $('drawBtn').disabled = true;
    $('confirmBtn').disabled = true;
    // C-17: commit-time envelope is the neutral gated wait — title-free on
    // the public screen while the operator already reads the title to cue
    // VirtualDJ manual. The 5 s buffer starts only at the gate, never here.
    awaitingGate = true;
    try { persistCurrentState(); } catch (e) {}
    broadcast('awaiting-gate');
    // C-17 fix gate-button: el path real pintaba el resultado a mano y
    // nunca re-renderizaba, asi que #revealGateBtn quedaba hidden=true
    // aunque el flag ya estaba activo (los tests lo enmascaraban con un
    // render() manual extra). render() es idempotente: repinta el mismo
    // resultado commiteado + expone el boton + re-emite awaiting-gate.
    try { render(); } catch (e2) {}
    return s;
  }

  // C-17 dashboard-only reveal control seam. Consumes the gate SYNCHRONOUSLY
  // (flag off before scheduling, so a double-click runs a single buffer),
  // then runs the unchanged C-15 path: fresh `scrollPool` from available()
  // at gate time → `broadcast('spinning')` → 5 s scheduler → `broadcast('reveal')`.
  // The gate mutates nothing: no status/current/history/lock change, no entry.
  // Returns the pending song, or null when no gate is pending (no-op).
  function handleRevealGate(storage) {
    if (!isAwaitingGate()) return null;
    var c = core();
    var st = c.state;
    if (!st.current || st.current.status !== 'drawn') {
      awaitingGate = false;
      try { persistCurrentState(storage); } catch (e) {}
      return null;
    }
    var pending = st.current;
    awaitingGate = false; // consume-first: the second press is a no-op
    broadcast('spinning', storage);
    schedulePublicReveal(function () {
      broadcast('reveal');
      render();
    });
    try { persistCurrentState(storage); } catch (e) {}
    if (typeof document !== 'undefined') render();
    return pending;
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
      return { id: c.makeId(), artist: p[0], title: p[1], status: 'available', addedAt: new Date().toISOString(), coverUrl: null };
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

  // C-05 import-file: extension matrix + frozen file copies (additive).
  // TXT/CSV/TSV + vendored XLSX stay offline; PDF/DOCX stay progressive
  // via cdnjs with the visible paste-text fallback. First sheet only.
  var INCOMPATIBLE_MESSAGE = 'Formato no compatible. Usá PDF, DOCX, TXT, CSV o XLSX.';
  var XLSX_EMPTY_MESSAGE = 'No se detectaron canciones en el Excel. Exportá la hoja a CSV o copiá el texto y usá "Pegar texto".';
  var FILE_READ_ERROR_MESSAGE = 'No se pudo leer el archivo. Si es PDF/DOCX, verificá internet o copiá el texto y usá "Pegar texto".';
  var XLSX_VENDOR_SRC = 'vendor/sheetjs/xlsx.full.min.js';

  function getFileExtension(fileName) {
    var n = String(fileName == null ? '' : fileName);
    var i = n.lastIndexOf('.');
    if (i === -1) return '';
    return n.slice(i + 1).toLowerCase();
  }

  function getFileKind(fileName) {
    var ext = getFileExtension(fileName);
    if (ext === 'txt' || ext === 'csv' || ext === 'tsv') return 'text';
    if (ext === 'xlsx') return 'xlsx';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    return 'incompatible';
  }

  function isImportBlocked() {
    return core().state.locked === true;
  }

  function setImportMessage(msg) {
    if (typeof document === 'undefined') return;
    var el = document.getElementById('importMessage');
    if (el) el.textContent = msg;
  }

  // Single guard shared by paste/demo/file/clear/reset handlers (design risk mitigation).
  function guardedImport(items, label) {
    if (isImportBlocked()) {
      setImportMessage(BLOCKED_MESSAGE);
      return { added: 0, duplicates: 0, message: BLOCKED_MESSAGE, blocked: true };
    }
    return imp().importSongs(items, label);
  }

  function handlePasteImport(text, fetchFn, opts) {
    var r = guardedImport(imp().parseText(text), 'texto');
    if (r.blocked) return r;
    return enrichAfterImport(r, fetchFn, opts);
  }

  function handleDemoImport(fetchFn, opts) {
    var r = guardedImport(buildDemoSongs(), 'demo');
    if (r.blocked) return r;
    return enrichAfterImport(r, fetchFn, opts);
  }

  // C-16 song-covers: best-effort cover enrichment post-import (never in show).
  // Default fetch is browser-only (window.fetch via global fetch); Node/tests
  // pass an explicit fetchFn mock or get the offline path (no implicit net).
  // Locked or blocked imports resolve nothing (guard-first, zero fetch).
  // Counts contract intact: the frozen `N nueva(s), M duplicado(s)` message
  // is extended with the cover count, never rewritten.
  // C-19: proxy CORS para file://. Desde origen file:// el navegador asigna
  // origen 'null' y APIs como Deezer/iTunes bloquean la petición. Como fallback
  // progresivo (solo pre-show, nunca en show), se reintenta vía proxy público
  // gratuito sin registro (api.allorigins.win) que añade CORS headers.
  var CORS_PROXY_URL = 'https://api.allorigins.win/raw?url=';

  function defaultCoverFetch(explicit) {
    if (typeof explicit === 'function') return explicit;
    if (typeof document === 'undefined') return null;
    var nativeFetch = null;
    try {
      if (typeof fetch === 'function') nativeFetch = fetch;
    } catch (e) {}
    if (!nativeFetch) {
      try {
        if (root && typeof root.fetch === 'function') nativeFetch = root.fetch;
      } catch (e2) {}
    }
    if (!nativeFetch) return null;
    return function (url, options) {
      return nativeFetch(url, options).catch(function (e) {
        var proxyUrl = CORS_PROXY_URL + encodeURIComponent(url);
        return nativeFetch(proxyUrl, options);
      });
    };
  }

  function enrichAfterImport(result, fetchFn, opts) {
    if (!result || result.blocked) {
      if (result) result.covers = Promise.resolve({ resolved: 0, total: 0, skipped: true });
      return result;
    }
    if (isImportBlocked()) return result;
    // Empty input keeps its frozen copy verbatim (no cover suffix).
    if ((result.added + result.duplicates) === 0) {
      result.covers = Promise.resolve({ resolved: 0, total: 0, skipped: true });
      return result;
    }
    var fn = defaultCoverFetch(fetchFn);
    var totalSongs = core().state.songs.length;
    var hook = opts && typeof opts.onProgress === 'function' ? opts.onProgress : null;
    // C-18: pasar coverCache (opts o por defecto appCoverCache) para que
    // enriquecer use caché sin red cuando esté disponible.
    var coverCacheToUse = (opts && opts.coverCache) || appCoverCache;
    var pass = opts || {};
    pass.coverCache = coverCacheToUse;

    // C-16 bugfix demo-covers: live i/N progress plus autosave on every
    // newly resolved cover, so a reload mid-enrich keeps partial covers
    // instead of losing them silently. Final message contract unchanged.
    setImportMessage('Resolviendo tapas 0/' + totalSongs + '… 0 con tapa.');
    var prevResolved = 0;
    var p = imp().enrichCovers(core().state.songs, fn, function (prog) {
      setImportMessage('Resolviendo tapas ' + prog.done + '/' + prog.total + '… ' + prog.resolved + ' con tapa.');
      if (prog.resolved > prevResolved) {
        prevResolved = prog.resolved;
        try { persistCurrentState(); } catch (e) {}
      }
      if (hook) { try { hook(prog); } catch (e2) {} }
    }, pass).then(function (rep) {
      var msg;
      if (!fn && rep.resolved === 0) {
        msg = result.message + ' Tapas omitidas (sin conexión).';
      } else {
        msg = result.message + ' Tapas resueltas: ' + rep.resolved + '/' + rep.total + '.';
      }
      result.message = msg;
      result.coversResolved = rep.resolved;
      setImportMessage(msg);
      try {
        if (typeof document !== 'undefined') render();
        else persistCurrentState();
      } catch (e) {}
      return rep;
    });
    result.covers = p;
    return result;
  }

  // C-16 file seam: parse+guard+enrich for every file reader branch
  // (TXT/CSV/TSV/XLSX/PDF/DOCX share the same best-effort cover path).
  function handleFileSongs(songs, fileName, fetchFn, opts) {
    var r = guardedImport(songs, fileName);
    if (r.blocked) return r;
    return enrichAfterImport(r, fetchFn, opts);
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

  // C-10 history-export: pure anti-injection helper. Prefixes a single
  // quote when the RAW cell starts with = + - @ so spreadsheet apps treat
  // it as text (visible content preserved). Applied BEFORE RFC quoting —
  // order matters (design decision 2). null/undefined -> ''.
  function sanitizeCsvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) return "'" + s;
    return s;
  }

  // C-10 history-export: 6-column Excel-compatible CSV (trailing Motivo,
  // additive — old 5-col files still parse). BOM + CRLF + RFC-4180 quoting
  // preserved; old mbdj.v1 entries without motivo default to '' (no migration).
  function buildCsv(history) {
    var rows = [['Nº', 'Título', 'Artista', 'Estado', 'Hora', 'Motivo']];
    (Array.isArray(history) ? history : []).forEach(function (h) {
      rows.push([h.n, h.title, h.artist, h.status, h.time, (h.motivo == null ? '' : h.motivo)]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) { return '"' + String(sanitizeCsvCell(v)).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    return '﻿' + csv;
  }

  // C-10 history-export: empty export is header-only AND announced — never
  // silent. Pure seam (tests assert the copy); the click handler below
  // surfaces it on the existing importMessage surface.
  function historyExportNotice(history) {
    if (!history || !history.length) return 'Historial vacío — se exportó solo el encabezado.';
    return '';
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // C-11 offline contingency: pdf.js/mammoth load ONLY here via guarded
  // loadScript, and ONLY for PDF/DOCX. C-05 adds the vendored XLSX path
  // (relative vendor/sheetjs, never CDN). Offline (or CDN-blocked) failure
  // lands on the visible paste-text fallback message below — the TXT/CSV/
  // TSV/XLSX/paste/demo route never touches the network. Only PDF/DOCX
  // reference cdnjs (verify: grep -r "cdnjs" js/ index.html).
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = Array.prototype.slice.call(document.scripts).find(function (s) { return s.src === src; });
      if (existing) {
        if (String(src).indexOf('xlsx') !== -1) {
          if (window.XLSX) return resolve();
        } else if (window.pdfjsLib || window.mammoth) {
          return resolve();
        }
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
  // RN-SES-01 / rule 7: while locked, clear/reset are BLOCKED like imports
  // (mid-partida list is immutable; unlock is the C-11 admin path). Refusal is
  // total: no confirm modal, no timer cancel, no state mutation.
  function handleClearSongs() {
    if (isImportBlocked()) {
      setImportMessage(BLOCKED_MESSAGE);
      return false;
    }
    if (typeof document === 'undefined') {
      cancelPublicReveal();
      cancelAwaitingGate();
      var c0 = core();
      c0.state.songs = [];
      c0.state.history = [];
      c0.state.current = null;
      return true;
    }
    var c = core();
    if (!confirm('¿Vaciar el listado de canciones? Esta acción no se puede deshacer.')) return false;
    if (c.state.history.length && !confirm('Ya hay historial. ¿Querés borrar también el historial y reiniciar la partida?')) return false;
    // C-15: cancel the pending public buffer so no ghost result resurrects
    // cleared state (mid-buffer alike). No operator timer remains.
    // C-17: cancelling the gate too — at most one reveal per commit, and a
    // mid-gate clear never fires afterward. render() below re-broadcasts the
    // neutral idle and persists the cancelled gate via the C-06 autosave.
    cancelPublicReveal();
    cancelAwaitingGate();
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
    if (isImportBlocked()) {
      setImportMessage(BLOCKED_MESSAGE);
      return false;
    }
    if (typeof document === 'undefined') {
      cancelPublicReveal();
      cancelAwaitingGate();
      var c0 = core();
      c0.state.songs = [];
      c0.state.history = [];
      c0.state.current = null;
      return true;
    }
    var c = core();
    if (!confirm('¿Reiniciar toda la partida? Se borrarán canciones cargadas, sorteos e historial. Exportá el historial primero si lo necesitás.')) return false;
    cancelPublicReveal();
    cancelAwaitingGate();
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
    // C-17: control de reveal solo-dashboard (habilitado solo con gate).
    var revealGateBtn = $('revealGateBtn');
    if (revealGateBtn) revealGateBtn.addEventListener('click', function () { handleRevealGate(); });
    $('confirmBtn').addEventListener('click', function () { setCurrentStatus('played'); });
    $('skipResult').addEventListener('click', function () {
      handleVoidRequest();
    });
    $('copyResult').addEventListener('click', function () {
      var c = core();
      if (!c.state.current) return;
      var text = formatCopyText(c.state.current);
      handleCopyRequest(function (t) {
        try {
          var r = navigator.clipboard.writeText(t);
          if (r && typeof r.then === 'function') {
            r.then(function () {
              $('copyResult').textContent = 'Copiado ✓';
              setTimeout(function () { $('copyResult').textContent = 'Copiar título y artista'; }, 1500);
            });
          }
        } catch (e) {
          prompt('Copiá el resultado:', t);
        }
      }, function (m, preset) { return prompt(m, preset); });
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
    // C-11 admin unlock: explicit button, real prompt/confirm injected into
    // the tested seam. Armed only while locked (render disables otherwise).
    var unlockBtn = $('unlockBtn');
    if (unlockBtn) unlockBtn.addEventListener('click', function () {
      handleUnlockRequest();
    });
    // C-11 list edit: delegation survives render() re-paints (container
    // persists, rows are re-created). Locked clicks still reach the seam,
    // which refuses with BLOCKED_MESSAGE (UI disable is not the guard).
    var songList = $('songList');
    if (songList && typeof songList.addEventListener === 'function') songList.addEventListener('click', function (e) {
      var t = e && e.target;
      var editId = t && t.getAttribute ? t.getAttribute('data-edit-id') : null;
      if (editId) handleEditRequest(editId);
      // C-16 cover set: reads the sibling input, no prompt, no fetch.
      var coverId = t && t.getAttribute ? t.getAttribute('data-cover-set') : null;
      if (coverId) handleCoverRequest(coverId, readCoverInput(songList, coverId));
    });
    $('sampleBtn').addEventListener('click', function () { handleDemoImport(); });
    $('exportLog').addEventListener('click', function () {
      var c = core();
      download(new Blob([buildCsv(c.state.history)], { type: 'text/csv;charset=utf-8' }), 'music-bingo-historial.csv');
      try { markExported(); } catch (e) {}
      // C-10: empty export announces itself instead of downloading silently.
      var notice = historyExportNotice(c.state.history);
      if (notice) setImportMessage(notice);
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
          var ext = getFileExtension(f.name);
          var kind = getFileKind(f.name);
          if (kind === 'text') {
            text = await f.text();
            handleFileSongs(imp().parseText(text), f.name);
          } else if (kind === 'xlsx') {
            var mx = document.getElementById('importMessage');
            if (mx) mx.textContent = 'Leyendo Excel…';
            await loadScript(XLSX_VENDOR_SRC);
            var songs = imp().parseXlsxBuffer(await f.arrayBuffer());
            if (!songs.length) {
              if (mx) mx.textContent = XLSX_EMPTY_MESSAGE;
            } else {
              handleFileSongs(songs, f.name);
            }
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
            handleFileSongs(imp().parseText(text), f.name);
          } else if (ext === 'docx') {
            var m2 = document.getElementById('importMessage');
            if (m2) m2.textContent = 'Leyendo DOCX…';
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js');
            var out = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
            handleFileSongs(imp().parseText(out.value), f.name);
          } else {
            var m3 = document.getElementById('importMessage');
            if (m3) m3.textContent = INCOMPATIBLE_MESSAGE;
          }
        } catch (err) {
          if (typeof console !== 'undefined') console.error(err);
          var m4 = document.getElementById('importMessage');
          var failedExt = getFileExtension(f && f.name);
          if (m4) m4.textContent = (failedExt === 'xlsx') ? XLSX_EMPTY_MESSAGE : FILE_READ_ERROR_MESSAGE;
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
    isAwaitingGate: isAwaitingGate,
    handleRevealGate: handleRevealGate,
    cancelAwaitingGate: cancelAwaitingGate,
    _resetGateForTest: _resetGateForTest,
    schedulePublicReveal: schedulePublicReveal,
    cancelPublicReveal: cancelPublicReveal,
    setPublicTimerFns: setPublicTimerFns,
    resetPublicTimerFns: resetPublicTimerFns,
    render: render,
    broadcast: broadcast,
    buildStateMessage: buildStateMessage,
    writeTransport: writeTransport,
    setCurrentStatus: setCurrentStatus,
    handleVoidRequest: handleVoidRequest,
    handleUnlockRequest: handleUnlockRequest,
    handleEditRequest: handleEditRequest,
    normalizeCoverValue: normalizeCoverValue,
    handleCoverRequest: handleCoverRequest,
    coverPreviewHTML: coverPreviewHTML,
    coverImgFallback: coverImgFallback,
    readCoverInput: readCoverInput,
    COVER_INVALID_MESSAGE: COVER_INVALID_MESSAGE,
    COVERS_DIR: COVERS_DIR,
    formatCopyText: formatCopyText,
    handleCopyRequest: handleCopyRequest,
    handleDrawClick: handleDrawClick,
    handleClearSongs: handleClearSongs,
    handleResetAll: handleResetAll,
    buildDemoSongs: buildDemoSongs,
    buildCsv: buildCsv,
    sanitizeCsvCell: sanitizeCsvCell,
    historyExportNotice: historyExportNotice,
    BLOCKED_MESSAGE: BLOCKED_MESSAGE,
    INCOMPATIBLE_MESSAGE: INCOMPATIBLE_MESSAGE,
    CORS_PROXY_URL: CORS_PROXY_URL,
    XLSX_EMPTY_MESSAGE: XLSX_EMPTY_MESSAGE,
    FILE_READ_ERROR_MESSAGE: FILE_READ_ERROR_MESSAGE,
    XLSX_VENDOR_SRC: XLSX_VENDOR_SRC,
    getFileExtension: getFileExtension,
    getFileKind: getFileKind,
    isImportBlocked: isImportBlocked,
    guardedImport: guardedImport,
    handlePasteImport: handlePasteImport,
    handleDemoImport: handleDemoImport,
    handleFileSongs: handleFileSongs,
    enrichAfterImport: enrichAfterImport,
    defaultCoverFetch: defaultCoverFetch,
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
    hideBootBanner: hideBootBanner,
    // C-18: expuestos para tests y uso futuro
    resolveCoverLocal: resolveCoverLocal,
    coverCache: appCoverCache
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.app;
  }
})(typeof window !== 'undefined' ? window : globalThis);
