/* js/public.js — public screen seam (markup verbatim from monolith publicHTML(),
 * script extended with file:// fallback: BroadcastChannel alone does not
 * deliver between two file:// pages (opaque origins), so DJ mirrors every
 * state message to localStorage and the public screen listens to the
 * 'storage' event + hydrates on load. Same {type:'state',...} interface.
 * Standalone public.html is canonical; buildPublicHTML() returns identical markup.
 * Classic script. Node-safe. */
(function (root) {
  'use strict';
  var PUBLIC_CHANNEL = 'music-bingo-dj-on';
  var TRANSPORT_KEY = 'music-bingo-dj-on';
  function buildPublicHTML() {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Music Bingo — Pantalla pública</title><style> *{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at center,#24121c 0,#08080c 65%);color:#f7f7fb;font:16px system-ui,Arial,sans-serif}.publicmode{min-height:100vh;display:grid;place-items:center;padding:25px;text-align:center}.publicbox{width:min(1100px,100%)}.brand{letter-spacing:.22em;color:#ff6470;font-weight:900;font-size:13px}.stage{margin:24px auto;width:min(330px,65vw);aspect-ratio:1;border-radius:50%;background:conic-gradient(#ef3948,#ffb84d,#7049e8,#27c9b4,#ef3948);padding:9px;box-shadow:0 0 80px #ef394833}.wheel{height:100%;border-radius:50%;background:#111119;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:25px}.disc{font-size:52px}.wheel p{font-size:12px;color:#aaa;margin:5px}.title{font-size:clamp(30px,5vw,68px);line-height:1.08;margin:20px 0 8px}.artist{font-size:clamp(17px,2.4vw,30px);color:#c8c5d3}.hint{margin-top:30px;color:#79798b;font-size:12px}.history{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:20px auto;max-width:900px}.history span{border:1px solid #353543;border-radius:99px;padding:7px 11px;color:#c7c7d5;font-size:12px;background:#ffffff05}.count{color:#a6a6b7;font-size:13px;margin-top:12px}.waiting{color:#aaa;font-size:clamp(22px,3vw,38px);margin:10px}.pop{animation:pop .5s ease-out}@keyframes pop{from{transform:scale(.7);opacity:.3}to{transform:scale(1);opacity:1}}</style></head><body><div class="publicmode"><div class="publicbox"><div class="brand">OLMOS NAHUEL PRESENTA · MUSIC BINGO</div><div class="stage"><div class="wheel"><div class="disc">♫</div><p id="status">ESPERANDO EL SORTEO</p></div></div><div id="waiting" class="waiting">¡Preparados para jugar!</div><div id="result" style="display:none"><div id="title" class="title"></div><div id="artist" class="artist"></div></div><div id="count" class="count">Canciones disponibles: 0</div><div id="history" class="history"></div><div id="hint" class="hint">Escuchá la canción y marcala en tu cartón · ¡Mucha suerte!</div></div></div><script>function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}var TRANSPORT_KEY='music-bingo-dj-on';var CABIN_MESSAGE='Buscando el tema en cabina…';var IDLE_MESSAGE='¡Preparados para jugar!';var UPGRADE_MESSAGE='Para ver el sorteo en vivo, abrí esta pantalla en Chrome o Edge actualizado.';var lastKey=null;function phaseOf(d){return d.phase||(d.current&&d.current.title?'reveal':'idle');}function renderKey(d,phase){var c=d.current||{};return phase+'|'+(c.id||c.title||'')+'|'+(d.remaining||0)+'/'+(d.drawn||0)+'|'+JSON.stringify((d.history||[]).map(function(h){return [h.title,h.status];}));}function handleState(d){if(!d||d.type!=='state')return;var phase=phaseOf(d);var key=renderKey(d,phase);if(key===lastKey)return;lastKey=key;document.getElementById('count').textContent='Canciones disponibles: '+d.remaining+' · Sorteadas: '+d.drawn;document.getElementById('history').innerHTML=(d.history||[]).slice(-5).reverse().map(function(h){return '<span>'+esc(h.title)+'</span>';}).join('');if(phase==='spinning'){document.getElementById('status').textContent='SORTEANDO…';var w=document.getElementById('waiting');w.style.display='block';w.textContent=CABIN_MESSAGE;document.getElementById('result').style.display='none';}else if(phase==='reveal'&&d.current&&d.current.title){document.getElementById('status').textContent=d.current.status==='played'?'CANCIÓN REGISTRADA':d.current.status==='void'?'INCIDENCIA REGISTRADA':'CANCIÓN SORTEADA';document.getElementById('waiting').style.display='none';document.getElementById('result').style.display='block';document.getElementById('title').textContent=d.current.title;document.getElementById('artist').textContent=d.current.artist||'Artista no especificado';document.getElementById('result').classList.add('pop');}else{document.getElementById('status').textContent='ESPERANDO EL SORTEO';var w2=document.getElementById('waiting');w2.style.display='block';w2.textContent=IDLE_MESSAGE;document.getElementById('result').style.display='none';}}var ch=null;var hasBC=false;try{ch=new BroadcastChannel('music-bingo-dj-on');ch.onmessage=function(e){handleState(e.data);};hasBC=true;}catch(e){ch=null;}var hasStore=false;try{hasStore=!!(window.localStorage);}catch(e){}if(!hasBC&&!hasStore){try{document.getElementById('hint').textContent=UPGRADE_MESSAGE;}catch(e){}}try{window.addEventListener('storage',function(e){if(!e||e.key!==TRANSPORT_KEY)return;try{handleState(JSON.parse(e.newValue));}catch(_){}});}catch(e){}try{if(window.localStorage){var raw=window.localStorage.getItem(TRANSPORT_KEY);if(raw){handleState(JSON.parse(raw));}}}catch(e){}window.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.exitFullscreen){document.exitFullscreen();}});
</script></body></html>`;
  }
  function summarizeState(d) {
    if (!d) return { status: 'ESPERANDO EL SORTEO', remaining: 0, drawn: 0 };
    return {
      status: d.current && d.current.title ? 'CANCIÓN SORTEADA' : 'ESPERANDO EL SORTEO',
      remaining: d.remaining || 0,
      drawn: d.drawn || 0
    };
  }
  function isStateMessage(d) {
    return !!d && d.type === 'state';
  }
  // C-08 public-screen: the live projector needs BroadcastChannel (primary)
  // or localStorage (file:// mirror). With neither, syncing would be silently
  // wrong — require an updated Chrome/Edge instead (upgrade copy in the page).
  function requiresModernBrowser(env) {
    var e = env || {};
    var bc = e.BroadcastChannel || (e.window && e.window.BroadcastChannel);
    var ls = e.localStorage || (e.window && e.window.localStorage);
    return !bc && !ls;
  }
  function parseTransportValue(raw) {
    if (!raw) return null;
    try {
      var d = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return isStateMessage(d) ? d : null;
    } catch (e) {
      return null;
    }
  }
  root.MBDJ = root.MBDJ || {};
  root.MBDJ.public = { PUBLIC_CHANNEL: PUBLIC_CHANNEL, TRANSPORT_KEY: TRANSPORT_KEY, buildPublicHTML: buildPublicHTML, summarizeState: summarizeState, isStateMessage: isStateMessage, parseTransportValue: parseTransportValue, requiresModernBrowser: requiresModernBrowser };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.public;
  }
})(typeof window !== 'undefined' ? window : globalThis);
