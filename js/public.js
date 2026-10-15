/* js/public.js — public screen seam (markup verbatim from monolith publicHTML(),
 * script extended with file:// fallback: BroadcastChannel alone does not
 * deliver between two file:// pages (opaque origins), so DJ mirrors every
 * state message to localStorage and the public screen listens to the
 * 'storage' event + hydrates on load. Same {type:'state',...} interface.
 * Standalone public.html is canonical; buildPublicHTML() returns identical markup.
 * C-14 La Pepa: coverFor(song) placeholder OPCION A + seam B (convencion
 * assets/covers/<song-id>.jpg con fallback al placeholder; B no carga archivos).
 * Classic script. Node-safe. */
(function (root) {
  'use strict';
  var PUBLIC_CHANNEL = 'music-bingo-dj-on';
  var TRANSPORT_KEY = 'music-bingo-dj-on';
  function pepaHue(id) { var h = 0; var s = String(id || ''); for (var i = 0; i < s.length; i++) { h = ((h * 31) + s.charCodeAt(i)) >>> 0; } return h % 360; }
  function pepaInitial(title) { var t = String(title || '').trim(); for (var i = 0; i < t.length; i++) { var c = t.charAt(i); if (/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(c)) { return c.toUpperCase(); } } return '?'; }
  // coverFor(song): OPCION A hoy = placeholder generativo deterministico
  // (color derivado de song.id + inicial del titulo, vinilo CSS puro,
  // cero assets/red). Seam B futura: si existe un archivo local en
  // assets/covers/<song-id>.jpg la publica podra usarlo con fallback
  // a este placeholder (B NO implementa carga de archivos, solo el seam).
  function coverFor(song) { var id = song && song.id ? String(song.id) : ''; var ti = song && song.title ? String(song.title) : ''; var hue = pepaHue(id || ti || 'pepa'); return { kind: 'placeholder', hue: hue, background: 'hsl(' + hue + ',55%,42%)', initial: pepaInitial(ti) }; }
  function buildPublicHTML() {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Music Bingo — Pantalla pública</title><style>:root{--pepa-red:#B91C1C;--pepa-cream:#F3EAD8;--pepa-gold:#E8B04B;--pepa-ink:#2B1210}*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--pepa-red);color:var(--pepa-cream);font:16px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;overflow:hidden}.publicmode{height:100vh;height:100dvh;max-height:100vh;max-height:100dvh;overflow:hidden;display:flex;flex-direction:column;align-items:stretch;padding:1vh 1.5vw;text-align:center}.pepa-frame{position:relative;flex:1;min-height:0;width:100%;height:100%;max-height:97vh;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;border:8px solid var(--pepa-cream);border-radius:26px;padding:clamp(8px,1.2vh,18px) clamp(12px,2.2vw,24px) clamp(8px,1.2vh,18px);background:var(--pepa-red);box-shadow:0 18px 60px #0006}.pepa-logo{position:absolute;top:clamp(8px,1.5vh,16px);left:clamp(10px,1.8vw,20px);z-index:3;isolation:isolate;text-align:left}.pepa-logo img{height:clamp(150px,21vh,240px);max-width:min(420px,30vw);display:block;margin:0}.pepa-logo img[hidden]{display:none!important}.pepa-logo-fallback{display:none;font-family:Impact,'Arial Narrow Bold','Franklin Gothic Heavy',sans-serif;font-weight:900;letter-spacing:.12em;font-size:clamp(22px,3.4vw,40px);color:var(--pepa-cream)}.pepa-stage{position:relative;display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;width:min(500px,90%);margin:clamp(2px,.6vh,8px) auto}.pepa-cover{position:relative;z-index:2;width:min(200px,32vw,24vh);aspect-ratio:1;border-radius:18px;display:grid;place-items:center;font-family:Impact,'Arial Narrow Bold','Franklin Gothic Heavy',sans-serif;font-size:clamp(56px,10vh,96px);font-weight:900;color:var(--pepa-cream);background:hsl(0,55%,42%);border:6px solid var(--pepa-cream);box-shadow:0 14px 44px #0007;flex:none}.pepa-vinyl{position:relative;z-index:1;width:min(200px,32vw,24vh);aspect-ratio:1;flex:none;margin-left:min(-48px,-8vw);border-radius:50%;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:6px solid var(--pepa-cream);box-shadow:0 14px 44px #0007}.pepa-grooves{position:absolute;inset:0;border-radius:50%;background:repeating-radial-gradient(circle at center,#0e0e13 0 2px,#1e1e27 2px 4px)}.pepa-vinyl .pepa-label{position:relative;z-index:2;width:34%;aspect-ratio:1;border-radius:50%;background:var(--pepa-gold);display:grid;place-items:center;color:var(--pepa-ink);font-weight:900;font-size:clamp(20px,3.5vh,32px)}.status{font-family:Impact,Arial Narrow Bold,Franklin Gothic Heavy,sans-serif;font-weight:900;letter-spacing:.22em;color:var(--pepa-cream);font-size:clamp(16px,2.5vh,30px);margin:clamp(1px,.4vh,5px) 0;min-height:1.2em}.pepa-vinyl.spin .pepa-grooves{animation:pepa-spin 1.1s linear infinite}@keyframes pepa-spin{to{transform:rotate(360deg)}}.title{font-family:Impact,'Arial Narrow Bold','Franklin Gothic Heavy',sans-serif;font-weight:900;font-size:clamp(64px,10.5vh,144px);line-height:1.02;margin:clamp(2px,.5vh,8px) 0 0;color:var(--pepa-cream);max-width:100%;overflow:hidden}.artist{font-family:Impact,'Arial Narrow Bold','Franklin Gothic Heavy',sans-serif;font-weight:900;font-size:clamp(32px,5.2vh,72px);color:var(--pepa-cream);margin:0}.hint{margin-top:clamp(2px,.6vh,8px);color:var(--pepa-cream);font-size:clamp(13px,1.9vh,17px);font-family:'Segoe Print','Comic Sans MS',cursive}.history{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:clamp(2px,.6vh,8px) auto 0;max-width:900px;max-height:10vh;overflow:hidden}.history span{border:1px solid var(--pepa-cream);border-radius:99px;padding:clamp(4px,.8vh,10px) clamp(10px,1.6vw,18px);color:var(--pepa-ink);font-size:clamp(14px,2.1vh,19px);background:var(--pepa-cream)}.count{color:var(--pepa-cream);font-size:clamp(13px,1.9vh,17px);margin-top:clamp(1px,.4vh,6px)}.waiting{color:var(--pepa-cream);font-size:clamp(20px,3vh,36px);margin:clamp(1px,.4vh,6px)}.pop{animation:pop .5s ease-out}@keyframes pop{from{transform:scale(.7);opacity:.3}to{transform:scale(1);opacity:1}}@media (max-width:640px){.pepa-cover,.pepa-vinyl{width:min(150px,38vw,22vh)}.pepa-vinyl{margin-left:min(-32px,-8vw)}}@media (prefers-reduced-motion:reduce){.pepa-vinyl.spin .pepa-grooves{animation:none}.pop{animation:none}}</style></head><body><div class="publicmode"><div class="pepa-frame"><div class="pepa-logo"><img src="assets/logo-la-pepa.png" alt="Bodegón La Pepa" onerror="this.setAttribute('hidden','');this.style.display='none';var f=document.getElementById('pepaLogoFallback');if(f){f.style.display='block';f.removeAttribute('hidden')}"><div id="pepaLogoFallback" class="pepa-logo-fallback" hidden>BODEGÓN LA PEPA</div></div><div class="pepa-stage"><div id="cover" class="pepa-cover" data-cover-for="">?</div><div id="vinyl" class="pepa-vinyl"><div class="pepa-grooves" aria-hidden="true"></div><div class="pepa-label" aria-hidden="true"></div></div></div><div id="status" class="status">ESPERANDO EL SORTEO</div><div id="waiting" class="waiting">¡Preparados para jugar!</div><div id="result" style="display:none"><div id="title" class="title"></div><div id="artist" class="artist"></div></div><div id="count" class="count">Canciones disponibles: 0</div><div id="history" class="history"></div><div id="hint" class="hint">Escuchá la canción y marcala en tu cartón · ¡Mucha suerte!</div></div></div><script>function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}var TRANSPORT_KEY='music-bingo-dj-on';
var CABIN_MESSAGE='Buscando el tema en cabina…';
var IDLE_MESSAGE='¡Preparados para jugar!';
var UPGRADE_MESSAGE='Para ver el sorteo en vivo, abrí esta pantalla en Chrome o Edge actualizado.';
var lastKey=null;
function pepaHue(id){var h=0;
var s=String(id||'');
for(var i=0;i<s.length;i++){h=((h*31)+s.charCodeAt(i))>>>0;
}return h%360;
}function pepaInitial(title){var t=String(title||'').trim();
for(var i=0;i<t.length;i++){var c=t.charAt(i);
if(/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(c)){return c.toUpperCase();
}}return '?';
}function coverForInline(song){var id=song&&song.id?String(song.id):'';
var ti=song&&song.title?String(song.title):'';
var hue=pepaHue(id||ti||'pepa');
return {hue:hue,background:'hsl('+hue+',55%,42%)',initial:pepaInitial(ti)};}function setSpin(on){try{var v=document.getElementById('vinyl');
if(!v||!v.classList){return;
}if(on){if(v.classList.add){v.classList.add('spin');
}}else{if(v.classList.remove){v.classList.remove('spin');
}}}catch(_){}}function paintCover(song){try{var c=document.getElementById('cover');
if(!c){return;
}var d=coverForInline(song||{});
c.textContent=d.initial;
try{c.style.background=d.background;
}catch(_){}try{if(c.setAttribute){c.setAttribute('data-cover-for',(song&&song.id)?String(song.id):'');
}}catch(_){}}catch(_){}}function phaseOf(d){return d.phase||(d.current&&d.current.title?'reveal':'idle');
}function renderKey(d,phase){var c=d.current||{};return phase+'|'+(c.id||c.title||'')+'|'+(d.remaining||0)+'/'+(d.drawn||0)+'|'+JSON.stringify((d.history||[]).map(function(h){return [h.title,h.status];
}));
}function handleState(d){if(!d||d.type!=='state')return;
var phase=phaseOf(d);
var key=renderKey(d,phase);
if(key===lastKey)return;lastKey=key;document.getElementById('count').textContent='Canciones disponibles: '+d.remaining+' · Sorteadas: '+d.drawn;document.getElementById('history').innerHTML=(d.history||[]).slice(-5).reverse().map(function(h){return '<span>'+esc(h.title)+'</span>';
}).join('');
if(phase==='spinning'){document.getElementById('status').textContent='SORTEANDO…';
var w=document.getElementById('waiting');
w.style.display='block';w.textContent=CABIN_MESSAGE;document.getElementById('result').style.display='none';setSpin(true);
paintCover(null);
}else if(phase==='reveal'&&d.current&&d.current.title){document.getElementById('status').textContent='';document.getElementById('waiting').style.display='none';document.getElementById('result').style.display='block';document.getElementById('title').textContent=d.current.title;document.getElementById('artist').textContent=d.current.artist||'Artista no especificado';document.getElementById('result').classList.add('pop');
setSpin(false);
paintCover(d.current);
}else{document.getElementById('status').textContent='ESPERANDO EL SORTEO';
var w2=document.getElementById('waiting');
w2.style.display='block';w2.textContent=IDLE_MESSAGE;document.getElementById('result').style.display='none';setSpin(false);
paintCover(null);
}}var ch=null;
var hasBC=false;
try{ch=new BroadcastChannel('music-bingo-dj-on');
ch.onmessage=function(e){handleState(e.data);
};hasBC=true;
}catch(e){ch=null;
}var hasStore=false;
try{hasStore=!!(window.localStorage);
}catch(e){}if(!hasBC&&!hasStore){try{document.getElementById('hint').textContent=UPGRADE_MESSAGE;
}catch(e){}}try{window.addEventListener('storage',function(e){if(!e||e.key!==TRANSPORT_KEY)return;
try{handleState(JSON.parse(e.newValue));
}catch(_){}});
}catch(e){}try{if(window.localStorage){var raw=window.localStorage.getItem(TRANSPORT_KEY);
if(raw){handleState(JSON.parse(raw));
}}}catch(e){}window.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.exitFullscreen){document.exitFullscreen();
}});
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
  root.MBDJ.public = { PUBLIC_CHANNEL: PUBLIC_CHANNEL, TRANSPORT_KEY: TRANSPORT_KEY, buildPublicHTML: buildPublicHTML, coverFor: coverFor, summarizeState: summarizeState, isStateMessage: isStateMessage, parseTransportValue: parseTransportValue, requiresModernBrowser: requiresModernBrowser };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.MBDJ.public;
  }
})(typeof window !== 'undefined' ? window : globalThis);
