const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');

// c-14 operator fixes (screenshot review, 2026-10-14): 4 visual fixes.
// Seams testeables: estructura DOM/clases/tokens en buildPublicHTML().
// Literales independientes del brief del operador, nunca recomputados del codigo.
function htmlOf() {
  const pub = require(path.join(root, 'js', 'public.js'));
  return pub.buildPublicHTML();
}
function styleOf(html) {
  return html.split('<style>')[1].split('</style>')[0];
}
function inlineOf(html) {
  return html.split('<script>')[1].split('</script>')[0];
}

describe('c-14 fixes: 1. fit viewport sin scroll (100vh flex columna)', () => {
  it('publicmode fija 100vh con overflow oculto (cabe en proyector 16:9)', () => {
    const css = styleOf(htmlOf());
    assert.ok(css.includes('height:100vh'), 'publicmode height:100vh presente');
    assert.ok(css.includes('overflow:hidden'), 'sin scroll vertical');
  });
  it('pepa-frame es flex columna con max-height 100vh y clamp/vh en tamanos', () => {
    const css = styleOf(htmlOf());
    assert.ok(css.includes('.pepa-frame'), '.pepa-frame presente');
    assert.ok(/\.pepa-frame\{[^}]*flex-direction:column/.test(css), 'frame flex columna');
    assert.ok(/max-height:\s*9\dvh/.test(css), 'frame max-height ~97vh');
    assert.ok(/clamp\([^)]*vh[^)]*\)/.test(css), 'clamp() con vh presente');
  });
  it('titulo largo + pills no empujan fuera (title clamp + history overflow hidden)', () => {
    const css = styleOf(htmlOf());
    assert.ok(/\.title\{[^}]*clamp\(/.test(css), '.title con clamp');
    assert.ok(/\.history\{[^}]*overflow:hidden/.test(css), '.history recorta sin empujar');
  });
});

describe('c-14 fixes: 2. overlap sleeve-over-vinyl (referencia)', () => {
  it('sleeve ENCIMA del disco (z-index cover > vinyl) y stage relativo', () => {
    const css = styleOf(htmlOf());
    const coverZ = Number((css.match(/\.pepa-cover\{[^}]*z-index:(\d)/) || [])[1]);
    const vinylZ = Number((css.match(/\.pepa-vinyl\{[^}]*z-index:(\d)/) || [])[1]);
    assert.ok(Number.isFinite(coverZ) && Number.isFinite(vinylZ), 'ambos z-index declarados');
    assert.ok(coverZ > vinylZ, 'cover z=' + coverZ + ' > vinyl z=' + vinylZ);
    assert.ok(/\.pepa-stage\{[^}]*position:relative/.test(css), 'stage relativo para overlap');
  });
  it('disco desplazado tras el sleeve (margen negativo / offset) y lado a lado eliminado', () => {
    const css = styleOf(htmlOf());
    assert.ok(/\.pepa-vinyl\{[^}]*margin-left:[^}]*-[\d]/.test(css), 'vinyl con margin-left negativo (asoma mitad)');
    assert.ok(!/\.pepa-stage\{[^}]*gap:26px/.test(css), 'gap lateral 26px eliminado (ya no lado a lado)');
  });
});

describe('c-14 fixes: 3. gira SOLO el disco (capas separadas)', () => {
  it('existe capa .pepa-grooves dentro de #vinyl y el spin anima SOLO esa capa', () => {
    const html = htmlOf();
    const css = styleOf(html);
    assert.ok(html.includes('pepa-grooves'), '.pepa-grooves presente en DOM');
    assert.ok(css.includes('.pepa-vinyl.spin .pepa-grooves'), 'spin apunta a la capa de surcos');
    assert.ok(!/\.pepa-vinyl\.spin\{[^}]*animation/.test(css), 'el contenedor #vinyl NO rota (texto estatico)');
  });
  it('v4 supersede (2026-10-15): #status y buffer FUERA del disco — disco limpio (solo surcos + circulo amarillo)', () => {
    // v4 operador: el screenshot mostraba "EL SORTEO" dentro del disco (resto
    // del label anterior recortado por el circulo). El disco queda limpio y el
    // mensaje de buffer C-08 vive debajo del stage (contrato intacto).
    const html = htmlOf();
    const vinylInner = html.split('id="vinyl"')[1].split('</div></div>')[0];
    assert.ok(vinylInner.includes('pepa-grooves'), 'grooves dentro de vinyl');
    assert.ok(vinylInner.includes('pepa-label'), 'circulo amarillo dentro de vinyl');
    assert.ok(!vinylInner.includes('id="status"'), '#status FUERA del disco (v4 supersede)');
    assert.ok(!/<p[\s>]/.test(vinylInner), 'sin parrafos dentro del disco');
    assert.ok(html.includes('id="status"'), '#status sigue existiendo (debajo del stage)');
  });
  it('setSpin conserva el seam (toggle .spin en #vinyl) + reduced-motion apaga surcos', () => {
    const html = htmlOf();
    const css = styleOf(html);
    const inline = inlineOf(html);
    assert.ok(inline.includes("getElementById('vinyl')"), 'setSpin opera sobre #vinyl');
    assert.ok(/classList[^;]*add[^;]*spin/.test(inline), 'setSpin agrega .spin (contrato harness)');
    assert.ok(/prefers-reduced-motion[^}]*\.pepa-vinyl\.spin \.pepa-grooves\{[^}]*animation:none/.test(css),
      'reduced-motion desactiva surcos');
  });
});

describe('c-14 fixes: 4. logo mas grande + glitch superpuesto corregido', () => {
  it('logo agrandado (clamp con vh, piso >=120px, ancho >=400px)', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.pepa-logo img\{[^}]*height:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, 'logo con height:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 120, 'piso >=120px, got ' + m[1]);
    assert.ok(Number(m[3]) >= 150, 'techo >=150px, got ' + m[3]);
    // v3 (2026-10-15, supersede): logo absolute top-left con max-width
    // min(420px,30vw) — esquina sin solape en 16:9; el alto (piso/techo)
    // sigue siendo el indicador de "mayor". Piso de ancho relajado a 400px.
    const w = css.match(/\.pepa-logo img\{[^}]*max-width:min\((\d+)px/);
    assert.ok(w && Number(w[1]) >= 400, 'ancho >=400px, got ' + (w && w[1]));
  });
  it('glitch corregido: img rota se oculta (hidden) y fallback no se superpone', () => {
    const html = htmlOf();
    const css = styleOf(html);
    const inline = inlineOf(html);
    // El screenshot mostraba un circulo oscuro con X sobre el logo:
    // era el glifo de <img> rota (alt/broken-icon) visible sobre el fallback.
    assert.ok(/img\[hidden\]\{[^}]*display:none/.test(css), 'img[hidden] forzado a display:none');
    assert.ok(html.includes("setAttribute('hidden'") || html.includes('setAttribute("hidden"'),
      'onerror del logo oculta el img roto via hidden (sin glifo superpuesto)');
    assert.ok(!/<button/i.test(html), 'sin botones/capas clicables sobre el logo (read-only C-08)');
    // v3 (2026-10-15, supersede): logo absolute top-left anclado a .pepa-frame
    // relativo — sigue aislado en su stacking context (z-index + isolation).
    assert.ok(/\.pepa-logo\{[^}]*position:(absolute|relative)/.test(css), 'logo aislado en su stacking context');
  });
});

describe('c-14 fixes: 5. textos mas grandes - titulo protagonista + artista visible (proyector)', () => {
  it('titulo .title usa clamp con piso >=40px y techo >=80px (mas grande que antes 28/64)', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.title\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, '.title con font-size:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 40, 'piso titulo >=40px, got ' + m[1]);
    assert.ok(Number(m[3]) >= 80, 'techo titulo >=80px, got ' + m[3]);
  });
  it('artista .artist usa clamp con piso >=20px y techo >=36px (mas grande que antes 16/28)', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.artist\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, '.artist con font-size:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 20, 'piso artista >=20px, got ' + m[1]);
    assert.ok(Number(m[3]) >= 36, 'techo artista >=36px, got ' + m[3]);
  });
  it('titulo y artista usan stack condensado bold (Impact/Arial Narrow Bold/Franklin Gothic Heavy)', () => {
    const css = styleOf(htmlOf());
    assert.ok(/\.title\{[^}]*font-family:[^}]*Impact/.test(css), '.title usa stack condensado');
    assert.ok(/\.artist\{[^}]*font-family:[^}]*Impact/.test(css), '.artist usa stack condensado');
    assert.ok(/\.title\{[^}]*font-weight:900/.test(css), '.title weight 900');
    assert.ok(/\.artist\{[^}]*font-weight:900/.test(css), '.artist weight 900 (bold)');
  });
});

describe('c-14 fixes: 6. quitar "CANCION SORTEADA" del disco - etiqueta limpia/solo inicial', () => {
  it('status NO muestra "CANCION SORTEADA" durante reveal (texto limpio o solo inicial en label)', () => {
    const inline = inlineOf(htmlOf());
    // El texto "CANCIÓN SORTEADA" no debe aparecer en el inline (se usaba en handleState para #status)
    assert.ok(!inline.includes('CANCIÓN SORTEADA'), 'inline no contiene "CANCIÓN SORTEADA"');
    assert.ok(!inline.includes('CANCION SORTEADA'), 'inline no contiene "CANCION SORTEADA" (sin acento)');
  });
  it('.pepa-label solo muestra la inicial (place-items:center + sin texto extra)', () => {
    const css = styleOf(htmlOf());
    assert.ok(/\.pepa-label\{[^}]*place-items:center/.test(css), '.pepa-label centrado');
    assert.ok(/\.pepa-label\{[^}]*width:34%/.test(css), '.pepa-label width 34% (proporcional al vinilo)');
  });
  it('#status durante reveal muestra texto neutro o se oculta (no "CANCION SORTEADA")', () => {
    const inline = inlineOf(htmlOf());
    // Verificar que handleState no setea "CANCIÓN SORTEADA" en #status
    const revealBranch = inline.split("phase==='reveal'")[1] || inline.split('phase==="reveal"')[1] || '';
    assert.ok(!revealBranch.includes('CANCIÓN SORTEADA'), 'rama reveal no setea CANCION SORTEADA');
    assert.ok(!revealBranch.includes('CANCION SORTEADA'), 'rama reveal no setea CANCION SORTEADA (sin acento)');
  });
});

describe('c-14 fixes: 7. centrar circulo amarillo interno del disco (geometricamente)', () => {
  it('.pepa-label centrado geometricamente (position absolute + inset 0 + margin auto O flex center)', () => {
    const css = styleOf(htmlOf());
    // El label debe estar centrado tanto horizontal como verticalmente dentro del vinilo
    // Opcion A: position absolute + inset 0 + margin auto
    // Opcion B: flex parent con align-items:center justify-content:center (ya existe en .pepa-vinyl)
    // Verificamos que el label no tenga margenes que lo descentren
    const labelRule = css.match(/\.pepa-vinyl[^}]*\.pepa-label\{[^}]*\}/) || css.match(/\.pepa-label\{[^}]*\}/);
    assert.ok(labelRule, 'regla .pepa-label presente');
    const labelCss = labelRule[0];
    // No debe tener margenes que lo descentren
    assert.ok(!/margin-(top|bottom):[^;]*px/.test(labelCss) || /margin:auto/.test(labelCss), 'label sin margenes verticales fijos que descentren');
  });
  it('.pepa-vinyl usa flex column con align-items:center + justify-content:center (centra hijos)', () => {
    const css = styleOf(htmlOf());
    assert.ok(/\.pepa-vinyl\{[^}]*display:flex/.test(css), 'vinyl es flex');
    assert.ok(/\.pepa-vinyl\{[^}]*flex-direction:column/.test(css), 'vinyl flex-direction column');
    assert.ok(/\.pepa-vinyl\{[^}]*align-items:center/.test(css), 'vinyl align-items center');
    assert.ok(/\.pepa-vinyl\{[^}]*justify-content:center/.test(css), 'vinyl justify-content center');
  });
});

describe('c-14 fixes: 9. v3 operador — logo absolute top-left + titulo/artista XL sin scroll', () => {
  it('logo en esquina superior izquierda (absolute top-left, fuera del flujo vertical)', () => {
    const css = styleOf(htmlOf());
    assert.ok(/\.pepa-frame\{[^}]*position:relative/.test(css), '.pepa-frame relativo (ancla del logo absoluto)');
    assert.ok(/\.pepa-logo\{[^}]*position:absolute/.test(css), '.pepa-logo absolute (libera eje vertical)');
    assert.ok(/\.pepa-logo\{[^}]*top:/.test(css), 'logo con top declarado');
    assert.ok(/\.pepa-logo\{[^}]*left:/.test(css), 'logo con left declarado (esquina superior izquierda)');
  });
  it('logo mayor que v2 (piso >=140px, techo >=200px) sin margin auto centrado', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.pepa-logo img\{[^}]*height:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, 'logo con height:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 140, 'piso logo >=140px (v2 era 120), got ' + m[1]);
    assert.ok(Number(m[3]) >= 200, 'techo logo >=200px (v2 era 190), got ' + m[3]);
    assert.ok(!/\.pepa-logo img\{[^}]*margin:0 auto/.test(css), 'logo ya no centrado con margin auto');
  });
  it('titulo XL protagonista (piso >=50px, techo >=110px, notoriamente mayor que 40/96)', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.title\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, '.title con font-size:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 50, 'piso titulo >=50px (v2 era 40), got ' + m[1]);
    assert.ok(Number(m[3]) >= 110, 'techo titulo >=110px (v2 era 96), got ' + m[3]);
  });
  it('artista XL (piso >=26px, techo >=56px, notoriamente mayor que 20/48)', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.artist\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, '.artist con font-size:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 26, 'piso artista >=26px (v2 era 20), got ' + m[1]);
    assert.ok(Number(m[3]) >= 56, 'techo artista >=56px (v2 era 48), got ' + m[3]);
  });
  it('100vh sin scroll preservado + compensaciones verticales (stage/pills/gaps reducidos)', () => {
    const css = styleOf(htmlOf());
    assert.ok(css.includes('height:100vh'), 'publicmode height:100vh preservado');
    assert.ok(css.includes('overflow:hidden'), 'overflow hidden preservado (sin scroll)');
    assert.ok(/max-height:\s*9\dvh/.test(css), 'frame max-height ~97vh preservado');
    assert.ok(/\.history\{[^}]*overflow:hidden/.test(css), '.history recorta sin empujar (preservado)');
    const stage = css.match(/\.pepa-cover\{[^}]*width:min\([^}]*?([\d.]+)vh/);
    assert.ok(stage, 'cover con tope vh declarado');
    assert.ok(Number(stage[1]) <= 28, 'zona vinilo/caratula achicada (tope <=' + '28vh, compensa titulo XL), got ' + stage[1]);
  });
});

describe('c-14 fixes: 10. v4 operador — frame full-height + disco limpio + buffer fuera del disco', () => {
  it('frame llena el viewport (publicmode 100dvh sin centrado que encoja, frame flex:1 + space-evenly, ancho pleno)', () => {
    const css = styleOf(htmlOf());
    assert.ok(css.includes('height:100dvh'), '100dvh presente (viewport real del proyector)');
    assert.ok(/\.publicmode\{[^}]*display:flex/.test(css), '.publicmode flex');
    assert.ok(!/\.publicmode\{[^}]*align-items:center/.test(css), '.publicmode ya no centra-encoge (dejaba la franja)');
    assert.ok(/\.pepa-frame\{[^}]*justify-content:space-(evenly|between)/.test(css), 'frame distribuye verticalmente');
    assert.ok(/\.pepa-frame\{[^}]*flex:1/.test(css), 'frame flex:1 (llena el alto disponible)');
    assert.ok(!css.includes('min(1120px'), 'sin tope 1120px (ocupa el ancho del proyector)');
  });
  it('elementos escalan con la pantalla (vh en pills) y cero scroll (body + frame)', () => {
    const css = styleOf(htmlOf());
    assert.ok(/\.history span\{[^}]*font-size:clamp\([^)]*vh/.test(css), 'pills con vh (legibles a distancia)');
    assert.ok(/body\{[^}]*overflow:hidden/.test(css), 'body sin scroll');
    assert.ok(css.includes('overflow:hidden'), 'overflow hidden (presupuesto vertical cierra)');
  });
  it('disco limpio: sin #status, sin <p> ni restos del label anterior dentro de #vinyl', () => {
    const html = htmlOf();
    const vinylInner = html.split('id="vinyl"')[1].split('</div></div>')[0];
    assert.ok(!vinylInner.includes('id="status"'), '#status fuera del disco');
    assert.ok(!/<p[\s>]/.test(vinylInner), 'sin parrafos dentro del disco');
    assert.ok(!/ESPERANDO|SORTEO|CANCI/.test(vinylInner), 'sin restos del label anterior en el disco');
  });
  it('buffer C-15 intacto pero fuera del disco: #status tras el stage + regla .status + scroll en spinning', () => {
    const html = htmlOf();
    const css = styleOf(html);
    const inline = inlineOf(html);
    assert.ok(html.includes('id="waiting"'), '#waiting existe');
    assert.ok(/\.status\{[^}]*font-size:clamp\(/.test(css), 'regla .status propia (fuera del disco)');
    assert.ok(inline.includes('Buscando el tema en cabina'), 'mensaje neutro preservado como fallback');
    assert.ok(/phase==='spinning'[\s\S]*startScroll\(d,w\)/.test(inline), 'spinning usa el word-scroll (sin titulo)');
    assert.ok(inline.includes('scrollPool'), 'el scroll se alimenta del payload offline');
  });
  it('IDs de estado preservados + logo top-left intacto', () => {
    const html = htmlOf();
    const css = styleOf(html);
    for (const id of ['title', 'artist', 'history', 'count', 'status', 'waiting', 'result']) {
      assert.ok(html.includes('id="' + id + '"'), 'id="' + id + '" preservado');
    }
    assert.ok(/\.pepa-logo\{[^}]*position:absolute/.test(css), 'logo top-left intacto');
  });
});

describe('c-14 fixes: 8. logo PNG en vez de SVG', () => {
  it('img del logo apunta a assets/logo-la-pepa.png (no .svg)', () => {
    const html = htmlOf();
    assert.ok(html.includes('src="assets/logo-la-pepa.png"') || html.includes("src='assets/logo-la-pepa.png'"), 'logo usa PNG');
    assert.ok(!html.includes('logo-la-pepa-crema.svg'), 'ya no usa el SVG crema');
  });
  it('fallback texto "BODEGON LA PEPA" sigue presente', () => {
    const html = htmlOf();
    assert.ok(html.includes('BODEGÓN LA PEPA') || html.includes('BODEGON LA PEPA'), 'fallback texto presente');
  });
  it('archivo PNG existe en assets/', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const pngPath = path.join(root, 'assets', 'logo-la-pepa.png');
    assert.ok(fs.existsSync(pngPath), 'assets/logo-la-pepa.png existe');
  });
});

describe('c-14 fixes: 11. v5 operador — sin eyebrow + textos grandes sin scroll', () => {
  it('eyebrow eliminado del builder y del CSS (sin MUSIC BINGO, sin hueco)', () => {
    const html = htmlOf();
    const css = styleOf(html);
    assert.ok(!html.includes('pepa-eyebrow'), 'sin .pepa-eyebrow en el markup');
    assert.ok(!html.includes('MUSIC BINGO'), 'sin texto MUSIC BINGO en la publica');
    assert.ok(!css.includes('.pepa-eyebrow'), 'sin regla .pepa-eyebrow en el CSS');
    const file = require('node:fs').readFileSync(require('node:path').join(root, 'public.html'), 'utf8');
    assert.ok(!file.includes('pepa-eyebrow'), 'public.html sin eyebrow (paridad)');
    assert.ok(!file.includes('MUSIC BINGO'), 'public.html sin MUSIC BINGO');
  });
  it('titulo XL v5 (piso >=64px, techo >=140px, mayor que v3 56/130)', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.title\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, '.title con font-size:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 64, 'piso titulo >=64px (v3 era 56), got ' + m[1]);
    assert.ok(Number(m[3]) >= 140, 'techo titulo >=140px (v3 era 130), got ' + m[3]);
  });
  it('artista XL v5 (piso >=32px, techo >=68px, mayor que v3 28/64)', () => {
    const css = styleOf(htmlOf());
    const m = css.match(/\.artist\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(m, '.artist con font-size:clamp(px,vh,px)');
    assert.ok(Number(m[1]) >= 32, 'piso artista >=32px (v3 era 28), got ' + m[1]);
    assert.ok(Number(m[3]) >= 68, 'techo artista >=68px (v3 era 64), got ' + m[3]);
  });
  it('contador + pills + hint subidos (count piso>=13/techo>=16, pills piso>=14/techo>=18, hint piso>=13/techo>=16)', () => {
    const css = styleOf(htmlOf());
    const count = css.match(/\.count\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(count, '.count con font-size:clamp(px,vh,px)');
    assert.ok(Number(count[1]) >= 13, 'piso count >=13px (era 11), got ' + count[1]);
    assert.ok(Number(count[3]) >= 16, 'techo count >=16px (era 13), got ' + count[3]);
    const pills = css.match(/\.history span\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(pills, 'pills con font-size:clamp(px,vh,px)');
    assert.ok(Number(pills[1]) >= 14, 'piso pills >=14px (era 12), got ' + pills[1]);
    assert.ok(Number(pills[3]) >= 18, 'techo pills >=18px (era 16), got ' + pills[3]);
    const hint = css.match(/\.hint\{[^}]*font-size:clamp\((\d+)px[^,]*,([\d.]+)vh[^,]*,(\d+)px/);
    assert.ok(hint, '.hint con font-size:clamp(px,vh,px)');
    assert.ok(Number(hint[1]) >= 13, 'piso hint >=13px (era 11), got ' + hint[1]);
    assert.ok(Number(hint[3]) >= 16, 'techo hint >=16px (era 13), got ' + hint[3]);
  });
  it('100vh sin scroll + compensaciones + logo/disco/frame intactos', () => {
    const html = htmlOf();
    const css = styleOf(html);
    assert.ok(css.includes('height:100vh'), 'publicmode height:100vh preservado');
    assert.ok(css.includes('height:100dvh'), '100dvh preservado');
    assert.ok(/body\{[^}]*overflow:hidden/.test(css), 'body sin scroll');
    assert.ok(/\.history\{[^}]*overflow:hidden/.test(css), '.history recorta sin empujar');
    assert.ok(/\.pepa-frame\{[^}]*flex:1/.test(css), 'frame flex:1 intacto');
    assert.ok(/\.pepa-frame\{[^}]*justify-content:space-(evenly|between)/.test(css), 'frame distribuye verticalmente');
    assert.ok(/\.pepa-logo\{[^}]*position:absolute/.test(css), 'logo top-left intacto');
    const vinylInner = html.split('id="vinyl"')[1].split('</div></div>')[0];
    assert.ok(!vinylInner.includes('id="status"'), 'disco limpio intacto');
    assert.ok(!/<p[\s>]/.test(vinylInner), 'sin parrafos dentro del disco');
    for (const id of ['title', 'artist', 'history', 'count', 'status', 'waiting', 'result']) {
      assert.ok(html.includes('id="' + id + '"'), 'id="' + id + '" preservado');
    }
  });
});
