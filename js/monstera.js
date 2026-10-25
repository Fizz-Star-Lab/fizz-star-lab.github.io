/* ---------- monstera leaves along the page edges ----------
   Every leaf is generated procedurally (seeded, so the layout is stable
   between reloads): its own size, width, number of edge slits and holes —
   small young leaves come out whole, big ones are fully split.

   Interaction (all devices):
   - idle sway, each leaf with its own rhythm
   - brushing: moving the mouse / finger across a leaf bends it in the
     direction of the motion (torque from pointer velocity)
   - click / tap on a visible part of a leaf: it shakes + a few sparks
   - scrolling blows "wind" through the visible leaves
   - Android: tilting the phone leans the leaves a little

   The layer sits behind the content (z-index:-1 like #bg-canvas) and
   doesn't eat any events — hit testing is done by hand on window, and only
   when the tap didn't land on a link/button/text block. */
(() => {
  const layer = document.getElementById('monstera-layer');
  if (!layer || !window.requestAnimationFrame) return;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CONTENT_SKIP = 'a,button,input,textarea,select,label,.header,.hero-inner,.app-card,.project-card,.music-inner,.fanarts-gallery,.section-title,.section-subtitle,.footer';

  // palette: deep jungle greens, kept dark so text over them stays readable
  const PALETTE = [
    { edge: '#063322', base: '#0f5e3b', mid: '#1f8a55', lit: '#b9ffcf', vein: '#a8f0c2' },
    { edge: '#05301f', base: '#0d6a40', mid: '#249a5e', lit: '#c8ffd8', vein: '#b4f5cb' },
    { edge: '#042a1c', base: '#0c5434', mid: '#1a7a4a', lit: '#a6f5c4', vein: '#9be6b8' },
    { edge: '#06362a', base: '#0e6150', mid: '#1f8f78', lit: '#b5fff0', vein: '#a5f0df' },  // teal
    { edge: '#0a3318', base: '#2a6a24', mid: '#4f9a35', lit: '#e8ffb0', vein: '#d6f7a4' },  // yellow-green
  ]

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---- leaf geometry (local coords: base of blade at 0,0, tip at L,0,
          stem goes back to -S,0) ---- */
  function smoothR(phi, table) {
    // table: [[phi, r], ...] sorted, cosine interpolation
    for (let i = 0; i < table.length - 1; i++) {
      const [p0, r0] = table[i], [p1, r1] = table[i + 1];
      if (phi <= p1) {
        const t = (phi - p0) / (p1 - p0);
        return lerp(r0, r1, (1 - Math.cos(t * Math.PI)) / 2);
      }
    }
    return table[table.length - 1][1];
  }

  function buildLeaf(rand, L, maturity) {
    const PI = Math.PI;
    const cx = 0.45 * L;
    const tipSharp = lerp(0.05, 0.1, rand());
    const table = [
      [0, 0.55], [0.25 * PI, lerp(0.47, 0.53, rand())], [0.5 * PI, lerp(0.43, 0.5, rand())],
      [0.75 * PI, lerp(0.48, 0.55, rand())], [0.9 * PI, lerp(0.46, 0.52, rand())], [PI, 0.39],
    ];
    // whole-leaf bend along the midrib + a slightly hooked tip
    const bend = (rand() - 0.5) * 0.16;
    const warp = (x, y) => {
      const t = x / L;
      return [x, y + bend * L * t * t];
    };
    const N = 90;
    const halves = [];
    for (const side of [-1, 1]) {
      const wf = lerp(0.84, 1.06, rand());               // halves are never identical
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const phi = (i / N) * PI;
        const r = smoothR(phi, table) * L + tipSharp * L * Math.exp(-Math.pow(phi / 0.15, 2));
        pts.push([cx + r * Math.cos(phi), side * r * Math.sin(phi) * wf, phi]);
      }
      halves.push({ side, pts });
    }

    const holes = [];
    const veins = [];
    const outline = [];
    halves.forEach(h => {
      const { pts } = h;
      // young leaves: no slits; mature ones up to ~9 per side
      const nSlits = Math.round(maturity * lerp(4, 9, rand()) - 0.8);
      const slitPhis = [];
      if (nSlits > 0) {
        const a0 = 0.14 * PI, a1 = 0.88 * PI;
        for (let k = 0; k < nSlits; k++) {
          const base = lerp(a0, a1, (k + 0.5) / nSlits);
          slitPhis.push(base + (rand() - 0.5) * (a1 - a0) / nSlits * 0.4);
        }
        for (let k = 1; k < slitPhis.length; k++) slitPhis[k] = Math.max(slitPhis[k], slitPhis[k - 1] + 0.1 * PI);
        while (slitPhis.length && slitPhis[slitPhis.length - 1] > 0.92 * PI) slitPhis.pop();
      }
      // lateral veins / slits run from the margin back toward the midrib
      const toMid = (p) => [clamp(p[0] - Math.abs(p[1]) * lerp(0.18, 0.34, rand()), 0.05 * L, 0.9 * L), 0];
      const halfOut = [];
      let si = 0;
      const dW = lerp(0.026, 0.04, rand()) * PI;     // slit mouth half-width (angle)
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (si < slitPhis.length && p[2] >= slitPhis[si] - dW) {
          const phiC = slitPhis[si];
          const pc = pts[Math.min(N, Math.round(phiC / PI * N))];
          const A = p;
          let j = i;
          while (j + 1 < pts.length && pts[j + 1][2] < phiC + dW) j++;
          const B = pts[Math.min(N, j + 1)];
          const m = toMid(pc);
          const depth = clamp(lerp(0.6, 0.9, rand()) * (0.55 + 0.45 * maturity), 0, 0.9);
          const ex = lerp(pc[0], m[0], depth), ey = lerp(pc[1], m[1], depth);
          let nx = -(m[1] - pc[1]), ny = (m[0] - pc[0]);
          const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
          if (nx * (A[0] - pc[0]) + ny * (A[1] - pc[1]) < 0) { nx = -nx; ny = -ny; }
          // slit edges curve toward the tip near the margin, like real veins
          const curve = 0.035 * L;
          const wi = 0.011 * L, wm = 0.021 * L;
          const q1x = lerp(pc[0], ex, 0.3) + curve, q1y = lerp(pc[1], ey, 0.3);
          const q2x = lerp(pc[0], ex, 0.65) + curve * 0.5, q2y = lerp(pc[1], ey, 0.65);
          halfOut.push(A);
          halfOut.push([q1x + nx * wm * 1.2, q1y + ny * wm * 1.2]);
          halfOut.push([q2x + nx * wm, q2y + ny * wm]);
          halfOut.push([ex + nx * wi, ey + ny * wi]);
          halfOut.push([ex - nx * wi * 0.6 + (m[0] - pc[0]) * 0.012, ey - ny * wi * 0.6]);
          halfOut.push([q2x - nx * wm, q2y - ny * wm]);
          halfOut.push([q1x - nx * wm * 1.2, q1y - ny * wm * 1.2]);
          halfOut.push(B);
          // a fenestration (hole) further in, in line with the slit
          if (rand() < maturity * 0.85 && depth < 0.86) {
            const t = lerp(0.35, 0.6, rand());
            const hx = lerp(ex, m[0], t), hy = lerp(ey, m[1], t);
            const len = Math.hypot(m[0] - ex, m[1] - ey);
            const ra = clamp(len * lerp(0.18, 0.3, rand()), 0.012 * L, 0.06 * L);
            holes.push({ hx, hy, ang: Math.atan2(m[1] - ey, m[0] - ex), ra, rb: ra * lerp(0.28, 0.42, rand()) });
          }
          i = j + 1;
          si++;
          continue;
        }
        halfOut.push(p);
      }
      // Chaikin smoothing rounds the lobe tips (tip and base notch stay fixed)
      let sm = halfOut;
      for (let it = 0; it < 3; it++) {
        const o = [sm[0]];
        for (let k = 0; k < sm.length - 1; k++) {
          const q = sm[k], r = sm[k + 1];
          o.push([q[0] * 0.75 + r[0] * 0.25, q[1] * 0.75 + r[1] * 0.25]);
          o.push([q[0] * 0.25 + r[0] * 0.75, q[1] * 0.25 + r[1] * 0.75]);
        }
        o.push(sm[sm.length - 1]);
        sm = o;
      }
      h.out = sm;

      // one lateral vein per lobe (between slits); young leaves still get
      // their veins, plus a few small holes in mid-maturity leaves
      const bounds = [0.04 * PI, ...slitPhis, 0.96 * PI];
      for (let k = 0; k < bounds.length - 1; k++) {
        const phiL = (bounds[k] + bounds[k + 1]) / 2;
        const pl = pts[Math.round(phiL / PI * N)];
        const m = toMid(pl);
        veins.push([m[0], m[1], lerp(m[0], pl[0], 0.9), lerp(m[1], pl[1], 0.9)]);
      }
      if (nSlits <= 0 && maturity > 0.3) {
        const nh = Math.floor(lerp(1, 4, rand()));
        for (let k = 0; k < nh; k++) {
          const phi = lerp(0.25, 0.8, (k + rand() * 0.6) / nh) * PI;
          const pl = pts[Math.round(phi / PI * N)];
          const m = toMid(pl);
          const t = lerp(0.35, 0.55, rand());
          const ra = lerp(0.02, 0.035, rand()) * L;
          holes.push({ hx: lerp(m[0], pl[0], t), hy: lerp(m[1], pl[1], t), ang: Math.atan2(pl[1] - m[1], pl[0] - m[0]), ra, rb: ra * 0.4 });
        }
      }
    });

    // full outline: top half from tip to base notch, bottom half back up
    const top = halves[0].out, bot = halves[1].out;
    for (const p of top) outline.push(warp(p[0], p[1]));
    for (let i = bot.length - 1; i >= 0; i--) outline.push(warp(bot[i][0], bot[i][1]));

    const f = (n) => n.toFixed(1);
    const poly = (pp) => 'M' + pp.map(p => f(p[0]) + ',' + f(p[1])).join('L') + 'Z';
    let d = poly(outline);
    holes.forEach(({ hx, hy, ang, ra, rb }) => {
      const pp = [];
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2;
        // slightly egg-shaped: fatter toward the margin end
        const x = Math.cos(a) * ra, y = Math.sin(a) * rb * (1 + 0.25 * Math.cos(a));
        pp.push(warp(hx + x * Math.cos(ang) - y * Math.sin(ang), hy + x * Math.sin(ang) + y * Math.cos(ang)));
      }
      d += poly(pp);
    });

    // midrib as a tapered strip, and the lit/shaded split along it
    const rib = [], ribB = [], fold = [];
    for (let i = 0; i <= 24; i++) {
      const x = lerp(-0.02, 0.97, i / 24) * L;
      const w = lerp(0.011, 0.002, i / 24) * L;
      rib.push(warp(x, -w)); ribB.unshift(warp(x, w));
      fold.push(warp(lerp(-0.1, 1.15, i / 24) * L, 0));
    }
    const midrib = poly(rib.concat(ribB));
    const shadeHalf = poly(fold.concat([[1.2 * L, 2 * L], [-0.2 * L, 2 * L]]));
    const veinPaths = veins.map(v => {
      const a = warp(v[0], v[1]), b = warp(v[2], v[3]);
      const c = warp((v[0] + v[2]) / 2 + Math.abs(v[3] - v[1]) * 0.22, (v[1] + v[3]) / 2);
      return `M${f(a[0])},${f(a[1])}Q${f(c[0])},${f(c[1])} ${f(b[0])},${f(b[1])}`;
    }).join('');
    return { d, outline, midrib, shadeHalf, veinPaths, tip: warp(L, 0) };
  }

  /* ---- DOM ---- */
  let uid = 0;
  function makeLeafEl(rand, spec) {
    const { L, S } = spec;
    const geo = buildLeaf(rand, L, spec.maturity);
    const pal = PALETTE[Math.floor(rand() * PALETTE.length)];
    const shadowDx = L * 0.035, shadowDy = L * 0.06, blur = L * 0.025;
    let minX = -S - 6, maxX = 0, minY = 0, maxY = 0;
    for (const p of geo.outline) { maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const pad = blur * 3 + 6;
    minY -= pad; maxY += pad + shadowDy; maxX += pad + shadowDx; minX -= pad;
    const W = maxX - minX, H = maxY - minY;
    const id = 'ml' + (uid++);
    const stemBend = (rand() - 0.5) * 0.14 * L;
    const sw = Math.max(3, L * 0.034);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `${minX.toFixed(1)} ${minY.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}`);
    svg.setAttribute('width', W.toFixed(0));
    svg.setAttribute('height', H.toFixed(0));
    svg.setAttribute('class', 'monstera-leaf' + (spec.far ? ' monstera-leaf--far' : ''));
    const f = (n) => n.toFixed(1);
    const g = (k) => `${id}${k}`;
    // everything below is static — the svg is rasterized once and then only
    // rotated by the compositor, so the extra shading costs nothing per frame
    svg.innerHTML =
      `<defs>
        <linearGradient id="${g('lg')}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${f(L)}" y2="0">
          <stop offset="0" stop-color="${pal.mid}"/><stop offset=".55" stop-color="${pal.base}"/><stop offset="1" stop-color="${pal.edge}"/>
        </linearGradient>
        <radialGradient id="${g('hl')}" gradientUnits="userSpaceOnUse" cx="${f(L * 0.42)}" cy="${f(-L * 0.18)}" r="${f(L * 0.42)}">
          <stop offset="0" stop-color="${pal.lit}" stop-opacity=".36"/><stop offset="1" stop-color="${pal.lit}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${g('st')}" gradientUnits="userSpaceOnUse" x1="${f(-S)}" y1="0" x2="0" y2="0">
          <stop offset="0" stop-color="${pal.edge}"/><stop offset="1" stop-color="${pal.mid}"/>
        </linearGradient>
        <clipPath id="${g('c')}"><path d="${geo.d}" clip-rule="evenodd"/></clipPath>
        <filter id="${g('sh')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(blur)}"/></filter>
        <filter id="${g('far')}" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${f(Math.max(0.6, L * 0.004))}"/></filter>
      </defs>
      <g${spec.far ? ` filter="url(#${g('far')})"` : ''}>
      <path d="${geo.d}" fill="#000" fill-opacity=".45" fill-rule="evenodd" transform="translate(${f(shadowDx)} ${f(shadowDy)})" filter="url(#${g('sh')})"/>
      <path d="M${f(-S)},0 Q${f(-S / 2)},${f(stemBend)} ${f(L * 0.02)},0" fill="none" stroke="url(#${g('st')})" stroke-width="${f(sw)}" stroke-linecap="round"/>
      <path d="M${f(-S)},0 Q${f(-S / 2)},${f(stemBend)} ${f(L * 0.02)},0" fill="none" stroke="${pal.lit}" stroke-opacity=".25" stroke-width="${f(sw * 0.3)}" stroke-linecap="round" transform="translate(0 ${f(-sw * 0.2)})"/>
      <path class="ml-blade" d="${geo.d}" fill="url(#${g('lg')})" fill-rule="evenodd"/>
      <g clip-path="url(#${g('c')})">
        <path d="${geo.shadeHalf}" fill="#021a10" fill-opacity=".32"/>
        <path d="${geo.d}" fill="url(#${g('hl')})"/>
        <path d="${geo.veinPaths}" fill="none" stroke="#021a10" stroke-opacity=".35" stroke-width="${f(Math.max(1.6, L * 0.009))}" stroke-linecap="round" transform="translate(0.8 1.2)"/>
        <path d="${geo.veinPaths}" fill="none" stroke="${pal.vein}" stroke-opacity=".32" stroke-width="${f(Math.max(1, L * 0.0055))}" stroke-linecap="round"/>
        <path d="${geo.midrib}" fill="${pal.vein}" fill-opacity=".3"/>
        <path d="${geo.d}" fill="none" stroke="#021a10" stroke-opacity=".55" stroke-width="${f(Math.max(3, L * 0.02))}"/>
        <path d="${geo.d}" fill="none" stroke="${pal.lit}" stroke-opacity=".22" stroke-width="${f(Math.max(1.4, L * 0.006))}" transform="translate(0 ${f(Math.max(1.2, L * 0.006))})"/>
        ${spec.far ? `<path d="${geo.d}" fill="#0a0a16" fill-opacity=".38"/>` : ''}
      </g>
      </g>`;
    const anchorInBox = { x: -S - minX, y: -minY };
    svg.style.left = (spec.ax - anchorInBox.x).toFixed(1) + 'px';
    svg.style.top = (spec.ay - anchorInBox.y).toFixed(1) + 'px';
    svg.style.transformOrigin = `${anchorInBox.x.toFixed(1)}px ${anchorInBox.y.toFixed(1)}px`;
    svg.style.opacity = spec.opacity;
    return svg;
  }

  /* ---- layout ---- */
  let leaves = [];
  let builtFor = { w: 0, h: 0 };

  function build() {
    const W = document.documentElement.clientWidth;
    const H = document.body.offsetHeight;
    builtFor = { w: W, h: H };
    layer.textContent = '';
    leaves = [];
    uid = 0;

    const mobile = W < 700;
    const content = Math.min(W, 1200);
    const margin = Math.max(0, (W - content) / 2);
    // how far a leaf may reach into the page
    const reach = mobile ? clamp(W * 0.26, 70, 120) : clamp(margin * 0.95 + 40, 130, 400);
    const Lmax = mobile ? clamp(W * 0.48, 150, 220) : clamp(reach * 1.15, 170, 420);

    for (const sideSign of [-1, 1]) {           // -1 = left edge, 1 = right edge
      const rand = rng(sideSign < 0 ? 1337 : 4242);
      let y = mobile ? 40 : 30;
      let cluster = 0;
      while (y < H - 60) {
        const count = 1 + Math.floor(rand() * (mobile ? 1.6 : 2.4));
        for (let c = 0; c < count; c++) {
          const big = c === 0;
          const L = Lmax * (big ? lerp(0.78, 1, rand()) : lerp(0.45, 0.72, rand()));
          const S = L * lerp(0.18, 0.32, rand());
          const maturity = clamp(L / Lmax + (rand() - 0.5) * 0.5, 0, 1);
          // angle in "leaf pointing into the page" terms: 0 = horizontal,
          // negative = upwards. Plants mostly rise.
          const a = lerp(-62, 34, rand()) + (c - (count - 1) / 2) * 22;
          const hidden = mobile ? lerp(0.42, 0.6, rand()) : lerp(0.18, 0.42, rand());
          const ax = sideSign < 0 ? -hidden * L : W + hidden * L;
          const ay = y + (rand() - 0.5) * 70 + c * 40;
          const baseAngle = sideSign < 0 ? a : 180 - a;
          const spec = { L, S, maturity, ax, ay, far: !big, opacity: big ? 1 : lerp(0.8, 0.95, rand()) };
          const el = makeLeafEl(rand, spec);
          // small leaves behind big ones
          if (big) layer.appendChild(el); else layer.insertBefore(el, layer.firstChild);
          leaves.push({
            el, side: sideSign, L, S, ax: spec.ax, ay: spec.ay, base: baseAngle,
            angle: 0, vel: 0, phase: rand() * Math.PI * 2, speed: lerp(0.5, 0.95, rand()),
            amp: lerp(1.2, 3.2, rand()) * (60 / Math.max(60, L * 0.35)) * 1.6,
            visible: true, scaleY: 1,
            blade: el.querySelector('.ml-blade'),
            anchorInBox: null,
          });
        }
        cluster++;
        y += (mobile ? lerp(260, 420, rand()) : lerp(300, 480, rand())) * (Lmax / 300 * 0.5 + 0.5);
      }
    }
    leaves.forEach(l => { l.el.style.transform = `rotate(${l.base}deg)`; });
    observeVisibility();
  }

  /* ---- visibility (only animate leaves on screen) ----
     plain math on the stored page coords instead of IntersectionObserver
     (IO was unreliable for leaves clipped by the overflow:hidden layer) */
  function updateVisibility() {
    const top = window.scrollY - 150, bot = window.scrollY + window.innerHeight + 150;
    for (const l of leaves) {
      const r = l.S + l.L;
      l.visible = l.ay + r > top && l.ay - r < bot;
    }
  }
  function observeVisibility() { updateVisibility(); }

  /* ---- input ---- */
  const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, active: false };
  function onMove(clientX, clientY) {
    const now = performance.now();
    const x = clientX + window.scrollX, y = clientY + window.scrollY;
    if (pointer.active && now > pointer.t) {
      const dt = Math.max(8, now - pointer.t) / 1000;
      // smoothed velocity, page px / s
      pointer.vx = lerp(pointer.vx, (x - pointer.x) / dt, 0.5);
      pointer.vy = lerp(pointer.vy, (y - pointer.y) / dt, 0.5);
    }
    pointer.x = x; pointer.y = y; pointer.t = now; pointer.active = true;
  }
  window.addEventListener('pointermove', e => onMove(e.clientX, e.clientY), { passive: true });
  // touchmove keeps firing while the page scrolls (pointer events get cancelled)
  window.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchend', () => { pointer.active = false; pointer.vx = pointer.vy = 0; }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.active = false; });

  function leafAt(clientX, clientY) {
    // topmost first = last in DOM order
    for (let i = layer.children.length - 1; i >= 0; i--) {
      const el = layer.children[i];
      const l = leaves.find(x => x.el === el);
      if (!l || !l.visible || !l.blade) continue;
      const r = el.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
      const ctm = l.blade.getScreenCTM();
      if (!ctm) continue;
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      if (l.blade.isPointInFill ? l.blade.isPointInFill(p) : true) return l;
    }
    return null;
  }

  function sparks(clientX, clientY) {
    const colors = ['#9af5c0', '#ffd700', '#ff1f8f', '#7fe0a8'];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'monstera-spark';
      const a = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 45;
      s.style.left = (clientX + window.scrollX) + 'px';
      s.style.top = (clientY + window.scrollY) + 'px';
      s.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * dist - 18).toFixed(0) + 'px');
      s.style.background = colors[i % colors.length];
      layer.appendChild(s);
      setTimeout(() => s.remove(), 750);
    }
  }

  function rustle(l, strength) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    l.vel += dir * strength;
    leaves.forEach(o => {
      if (o === l || o.side !== l.side) return;
      const d = Math.hypot(o.ay - l.ay, o.ax - l.ax);
      if (d < 320) o.vel += dir * strength * 0.45 * (1 - d / 320);
    });
  }

  window.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest(CONTENT_SKIP)) return;
    const l = leafAt(e.clientX, e.clientY);
    if (!l) return;
    rustle(l, reduceMotion ? 90 : 260);
    if (!reduceMotion) sparks(e.clientX, e.clientY);
  });

  // cursor over a leaf → pointer cursor (desktop nicety)
  let hoverCheck = 0;
  window.addEventListener('mousemove', e => {
    if (++hoverCheck % 3) return;
    const overContent = e.target.closest && e.target.closest(CONTENT_SKIP);
    const l = overContent ? null : leafAt(e.clientX, e.clientY);
    document.body.classList.toggle('monstera-hover', !!l);
  }, { passive: true });

  // scroll wind
  let lastScroll = window.scrollY, scrollDelta = 0;
  window.addEventListener('scroll', () => {
    scrollDelta += window.scrollY - lastScroll;
    lastScroll = window.scrollY;
  }, { passive: true });

  // tilt (Android gives this freely; iOS needs a permission prompt — skipped)
  let tilt = 0;
  window.addEventListener('deviceorientation', e => {
    if (typeof e.gamma === 'number') tilt = clamp(e.gamma, -30, 30) * 0.25;
  }, { passive: true });

  /* ---- simulation ---- */
  const K = 38, D = 5.5;   // spring stiffness, damping
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    const wind = clamp(scrollDelta, -120, 120);
    scrollDelta = 0;
    // pointer velocity decays when the pointer stops
    pointer.vx *= 0.86; pointer.vy *= 0.86;

    updateVisibility();
    for (const l of leaves) {
      if (!l.visible) continue;
      const idle = reduceMotion ? 0 : l.amp * (Math.sin(t * l.speed + l.phase) + 0.35 * Math.sin(t * l.speed * 2.3 + l.phase * 1.7));
      const target = idle + tilt * l.side * -1;
      let torque = 0;

      if (pointer.active) {
        // vector from the leaf anchor to the pointer
        const rx = pointer.x - l.ax, ry = pointer.y - l.ay;
        const dist = Math.hypot(rx, ry);
        const reachLen = l.S + l.L * 1.05;
        if (dist < reachLen && dist > 1) {
          // closeness to the leaf's current axis
          const ang = (l.base + l.angle) * Math.PI / 180;
          const ux = Math.cos(ang), uy = Math.sin(ang);
          const along = rx * ux + ry * uy;
          const across = Math.abs(-rx * uy + ry * ux);
          if (along > l.S * 0.5 && across < l.L * 0.55) {
            const w = 1 - across / (l.L * 0.55);
            // angular velocity the pointer "drags" the leaf with (deg/s)
            const omega = (rx * pointer.vy - ry * pointer.vx) / (dist * dist) * 57.3;
            torque += clamp(omega, -900, 900) * w * 3.5;
          }
        }
      }
      if (wind) torque += wind * (l.side < 0 ? 1 : -1) * 9 * (0.6 + 0.4 * Math.sin(l.phase));

      const acc = K * (target - l.angle) - D * l.vel + torque;
      l.vel += acc * dt;
      l.vel = clamp(l.vel, -600, 600);
      l.angle += l.vel * dt;
      l.angle = clamp(l.angle, -40, 40);
      // a fast-moving leaf flexes a bit (fake bending)
      const flex = 1 - Math.min(0.14, Math.abs(l.vel) / 2600);
      l.el.style.transform = `rotate(${(l.base + l.angle).toFixed(2)}deg) scale(1, ${flex.toFixed(3)})`;
    }
    requestAnimationFrame(tick);
  }

  /* ---- boot / rebuild ---- */
  function maybeRebuild() {
    const W = document.documentElement.clientWidth;
    const H = document.body.offsetHeight;
    // width change = new layout; height-only changes (mobile URL bar, late
    // images) only rebuild when the page grew/shrank noticeably
    if (W !== builtFor.w || Math.abs(H - builtFor.h) > 150) build();
  }
  build();
  requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(maybeRebuild, 200); });
  window.addEventListener('load', maybeRebuild);
  if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(maybeRebuild, 250); }).observe(document.body);
})();
