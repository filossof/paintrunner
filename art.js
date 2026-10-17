'use strict';

// ============================================================
//  Art: the hand-inked sketchbook look.
//  - paper with grain, a vignette, and a faint pencil drawing behind
//    each level (a different theme per world), drawn once per level
//  - ink-textured walls with gently wobbling hand-drawn outlines
//  - watercolor paint, drips, fiery lava
//  Uses T, COLS, ROWS, W, H from world.js.
// ============================================================

const ART = (() => {
  const INK = '#1c1c1f';
  const PAPER = '#f1ece0';
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const seeded = (seed) => { let s = (seed % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---------------- textures (made once) ----------------
  let grain = null, inkTex = null;
  function textures() {
    if (grain) return;
    const rnd = seeded(12345);
    grain = off(256, 256);
    const g = grain.getContext('2d'), img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd();
      img.data[i] = 60; img.data[i + 1] = 50; img.data[i + 2] = 40; img.data[i + 3] = v < 0.5 ? v * 26 : 0;
    }
    g.putImageData(img, 0, 0);
    inkTex = off(256, 256);
    const k = inkTex.getContext('2d');
    k.fillStyle = '#18181b'; k.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 220; i++) {
      k.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.05})`;
      k.lineWidth = 1 + rnd() * 3;
      const x = rnd() * 256, y = rnd() * 256, a = -0.8 + rnd() * 0.3, l = 10 + rnd() * 50;
      k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); k.stroke();
    }
  }
  const patterns = new WeakMap();
  function inkPattern(ctx) {
    textures();
    if (!patterns.has(ctx)) patterns.set(ctx, ctx.createPattern(inkTex, 'repeat'));
    return patterns.get(ctx);
  }

  // ---------------- pencil sketches behind the levels ----------------
  // Draws a world's sketch. `to(layer)` picks where each part goes: 'far' (hills, distant shapes),
  // 'mid' (closer shapes) or 'anim' (clouds, birds, windmill blades, smoke, stars: things that can
  // move). Anything sent to 'anim' is also reported to `anim(item)` so it can be drawn alive.
  // With a single target (the classic still paper) everything lands on the same canvas.
  function sketchWorld(to, theme, rnd, anim = () => { }) {
    let g = to('far');
    const use = (layer) => { g = to(layer); g.lineCap = 'round'; g.lineJoin = 'round'; };
    use('far');
    const pencil = (a, w = 1.1) => { g.strokeStyle = `rgba(70,64,58,${a})`; g.lineWidth = w; };
    const wob = (pts, a, n = 2) => {
      for (let k = 0; k < n; k++) {
        pencil(a * (k ? 0.6 : 1)); g.beginPath();
        pts.forEach(([x, y], i) => { const jx = x + (rnd() - 0.5) * 2.4, jy = y + (rnd() - 0.5) * 2.4; i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); });
        g.stroke();
      }
    };
    const ridge = (base, amp, f1, f2, ph, a) => {
      const pts = []; for (let x = -20; x <= W + 20; x += 24) pts.push([x, base - Math.sin(x * f1 + ph) * amp - Math.sin(x * f2 + ph * 2) * amp * 0.3]);
      wob(pts, a);
      for (let x = 0; x < W; x += 8) { const y = base - Math.sin(x * f1 + ph) * amp - Math.sin(x * f2 + ph * 2) * amp * 0.3; pencil(a * 0.35); g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x - 9, y + 20); g.stroke(); }
    };
    const cloud = (cx, cy, s) => { use('anim'); anim({ kind: 'cloud', x: cx, y: cy, s }); cloudShape(g, cx, cy, s); };
    const birds = (bx, by) => { use('anim'); anim({ kind: 'birds', x: bx, y: by }); birdShapes(g, bx, by, null); };
    const ph = rnd() * 6;

    if (theme === 0) {                                       // blue: rolling hills, a windmill, clouds
      ridge(300, 60, 0.006, 0.017, ph, 0.2); use('mid'); ridge(370, 40, 0.009, 0.021, ph + 2, 0.13);
      const mx = 120 + rnd() * 700, my = 200;
      wob([[mx - 14, my + 95], [mx - 8, my], [mx + 8, my], [mx + 14, my + 95]], 0.18);
      use('anim'); anim({ kind: 'windmill', x: mx, y: my });
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; wob([[mx, my], [mx + Math.cos(a) * 48, my + Math.sin(a) * 48]], 0.18, 1); }
      for (let i = 0; i < 3; i++) cloud(120 + i * 300 + rnd() * 80, 60 + rnd() * 40, 0.9 + rnd() * 0.4);
      birds(400 + rnd() * 200, 110);
    } else if (theme === 1) {                                // red: volcanoes with smoke
      use('mid');
      for (let i = 0; i < 2; i++) {
        const vx = 200 + i * 480 + rnd() * 80, vy = 150 + rnd() * 40, base = 400;
        use(i ? 'mid' : 'far');
        wob([[vx - 190, base], [vx - 30, vy], [vx + 30, vy], [vx + 190, base]], 0.2);
        for (let k = 0; k < 6; k++) { pencil(0.08); g.beginPath(); g.moveTo(vx - 30 + k * 10, vy + 4); g.lineTo(vx - 80 + k * 30, base - 10); g.stroke(); }
        use('anim'); anim({ kind: 'smoke', x: vx, y: vy });
        for (let k = 0; k < 4; k++) { pencil(0.12); g.beginPath(); g.arc(vx + Math.sin(k) * 14, vy - 30 - k * 26, 14 + k * 5, 0, Math.PI * 2); g.stroke(); }
      }
      use('mid'); ridge(420, 25, 0.01, 0.03, ph, 0.12);
    } else if (theme === 2) {                                // green: forest of pines and round trees
      ridge(360, 30, 0.007, 0.02, ph, 0.14);
      use('mid'); anim({ kind: 'leaves' });
      for (let i = 0; i < 16; i++) {
        const tx = 20 + i * 62 + rnd() * 30, ty = 330 - rnd() * 60, h = 70 + rnd() * 70;
        use(i % 2 ? 'mid' : 'far');
        if (rnd() < 0.6) {
          wob([[tx, ty - h], [tx - h * 0.28, ty], [tx + h * 0.28, ty], [tx, ty - h]], 0.17, 1);
          for (let k = 1; k < 4; k++) wob([[tx - h * 0.07 * k, ty - h + h * 0.25 * k], [tx + h * 0.07 * k, ty - h + h * 0.25 * k]], 0.1, 1);
        } else {
          pencil(0.16); g.beginPath(); g.arc(tx, ty - h * 0.6, h * 0.32, 0, Math.PI * 2); g.stroke();
          wob([[tx, ty - h * 0.3], [tx, ty + 10]], 0.17, 1);
        }
      }
      birds(500 + rnd() * 200, 80);
    } else if (theme === 3) {                                // yellow: a sketched city skyline
      for (let i = 0; i < 14; i++) {
        const bx = i * 72 + rnd() * 20, bw = 40 + rnd() * 30, bh = 90 + rnd() * 200, by = 420 - bh;
        use(bh > 190 ? 'far' : 'mid');
        wob([[bx, 420], [bx, by], [bx + bw, by], [bx + bw, 420]], 0.16, 1);
        for (let y = by + 12; y < 410; y += 22) for (let x = bx + 8; x < bx + bw - 10; x += 14) { pencil(0.09); g.strokeRect(x, y, 6, 9); }
        if (rnd() < 0.3) wob([[bx + bw / 2, by], [bx + bw / 2, by - 30]], 0.15, 1);
      }
      for (let i = 0; i < 2; i++) cloud(200 + i * 420, 70, 1);
      use('anim'); anim({ kind: 'windows' });
    } else if (theme === 4) {                                // purple: night sky, moon, stars and a castle
      pencil(0.2); g.beginPath(); g.arc(780, 100, 40, 0, Math.PI * 2); g.stroke();
      pencil(0.08); g.beginPath(); g.arc(795, 92, 34, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 30; i++) {
        const sx = rnd() * W, sy = rnd() * 260, r = 2 + rnd() * 3;
        use('anim'); anim({ kind: 'star', x: sx, y: sy, r, ph: hash(i, 4) * 6 });
        pencil(0.18); g.beginPath(); g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
      }
      use('mid');
      const cx = 260 + rnd() * 200, cy = 220;
      wob([[cx, 420], [cx, cy], [cx + 200, cy], [cx + 200, 420]], 0.16, 1);
      for (const tx of [cx - 20, cx + 180]) { wob([[tx, 420], [tx, cy - 60], [tx + 40, cy - 60], [tx + 40, 420]], 0.16, 1); wob([[tx - 6, cy - 60], [tx + 20, cy - 110], [tx + 46, cy - 60]], 0.16, 1); }
      for (let x = cx; x < cx + 200; x += 20) { pencil(0.14); g.strokeRect(x, cy - 12, 10, 12); }
      use('anim'); anim({ kind: 'bats', x: cx + 100, y: cy - 80 });
    } else {                                                  // finale: a bit of everything
      ridge(330, 50, 0.006, 0.018, ph, 0.16);
      use('mid');
      const vx = 700; wob([[vx - 150, 380], [vx - 20, 170], [vx + 20, 170], [vx + 150, 380]], 0.16);
      use('anim'); anim({ kind: 'smoke', x: vx, y: 170 });
      use('mid');
      for (let i = 0; i < 6; i++) { const bx = 60 + i * 50, bh = 80 + rnd() * 120; wob([[bx, 380], [bx, 380 - bh], [bx + 36, 380 - bh], [bx + 36, 380]], 0.12, 1); }
      for (let i = 0; i < 12; i++) {
        const sx = rnd() * W, sy = rnd() * 140, r = 2 + rnd() * 2;
        use('anim'); anim({ kind: 'star', x: sx, y: sy, r, ph: hash(i, 5) * 6 });
        pencil(0.16); g.beginPath(); g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
      }
      use('anim'); anim({ kind: 'embers' });
    }
  }
  const pencilOf = (g, a, w = 1.1) => { g.strokeStyle = `rgba(70,64,58,${a})`; g.lineWidth = w; };
  function cloudShape(g, cx, cy, s) {
    pencilOf(g, 0.14); g.beginPath(); g.arc(cx, cy, 14 * s, Math.PI, 0); g.arc(cx + 22 * s, cy - 4 * s, 18 * s, Math.PI, 0); g.arc(cx + 46 * s, cy, 12 * s, Math.PI, 0); g.stroke();
  }
  function birdShapes(g, bx, by, flap) {
    for (let i = 0; i < 3; i++) {
      const x = bx + i * 20, y = by + (i % 2) * 10, f = flap === null ? 0 : Math.sin(flap + i * 1.7) * 3;
      pencilOf(g, 0.2); g.beginPath(); g.moveTo(x - 6, y - f * 0.4); g.quadraticCurveTo(x - 3, y - 4 - f, x, y); g.quadraticCurveTo(x + 3, y - 4 - f, x + 6, y - f * 0.4); g.stroke();
    }
  }

  // The paper for one level: color, pencil sketch, grain. Cached per level.
  const papers = new Map();
  function paper(levelName, levelIdx) {
    if (papers.has(levelName)) return papers.get(levelName);
    textures();
    const c = off(W, H), g = c.getContext('2d');
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    const seed = [...levelName].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) >>> 0;
    sketchWorld(() => g, Math.min(5, Math.floor(levelIdx / 8)), seeded(seed));
    g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W, H);
    papers.set(levelName, c);
    return c;
  }
  // plain paper with grain (menus)
  let plain = null;
  function plainPaper() {
    if (plain) return plain;
    textures();
    plain = off(W, H);
    const g = plain.getContext('2d');
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W, H);
    return plain;
  }

  // ---------------- gently wobbling ink lines ----------------
  // A hand-drawn line: a fixed little wobble plus a slow, smooth sway over time.
  function inkLine(ctx, x1, y1, x2, y2, seed, amp, width, t) {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(len / 7));
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    ctx.lineWidth = width; ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const ends = i === 0 || i === n ? 0.3 : 1;
      const o = ((hash(seed + i * 7, seed * 3) - 0.5) * amp + Math.sin(t * 1.3 + i * 0.9 + seed * 0.7) * amp * 0.55) * ends;
      const k = i / n, x = x1 + (x2 - x1) * k + nx * o, y = y1 + (y2 - y1) * k + ny * o;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // ---------------- tiles: ink walls, metal, watercolor paint, drips, spikes ----------------
  function drawTiles(ctx, w, t, colorHex) {
    const lv = w.level;
    const solid = (c, r) => w.solid(c, r);
    const ROWS = lv.rows, COLS = lv.cols;
    const pAt = (c, r) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? lv.paint[r][c] : 0);
    // all plain blocks share one ink texture
    ctx.save(); ctx.beginPath();
    let any = false;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (lv.tiles[r][c] === '#' && !lv.paint[r][c]) { ctx.rect(c * T - 0.5, r * T - 0.5, T + 1, T + 1); any = true; }
    if (any) { ctx.clip(); ctx.fillStyle = inkPattern(ctx); ctx.fillRect(0, 0, lv.w, lv.h); }
    ctx.restore();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const tl = lv.tiles[r][c], x = c * T, y = r * T;
      if (tl === 'M') {
        const g = ctx.createLinearGradient(x, y, x + T, y + T);
        g.addColorStop(0, '#b3b8c0'); g.addColorStop(0.5, '#8d929b'); g.addColorStop(1, '#6f747d');
        ctx.fillStyle = g; ctx.fillRect(x - 0.25, y - 0.25, T + 0.5, T + 0.5);
        ctx.strokeStyle = 'rgba(28,28,31,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
        ctx.fillStyle = '#e1e4e8';
        for (const [dx, dy] of [[6, 6], [T - 6, 6], [6, T - 6], [T - 6, T - 6]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2); ctx.fill(); }
      } else if (tl === '#' && lv.paint[r][c]) {
        const p = colorHex[lv.paint[r][c]];
        ctx.fillStyle = p; ctx.globalAlpha = 0.9; ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';                                   // granulation
        for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.arc(x + hash(c * 7 + k, r) * T, y + hash(r * 5 + k, c) * T, 0.7 + hash(k, c + r) * 1.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(x + 10 + hash(c, r) * 10, y + 8, 7, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;               // darker pooled edges
        if (pAt(c, r - 1) !== lv.paint[r][c]) { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + T, y + 1); ctx.stroke(); }
        if (pAt(c, r + 1) !== lv.paint[r][c]) { ctx.beginPath(); ctx.moveTo(x, y + T - 1); ctx.lineTo(x + T, y + T - 1); ctx.stroke(); }
        if (pAt(c - 1, r) !== lv.paint[r][c]) { ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + T); ctx.stroke(); }
        if (pAt(c + 1, r) !== lv.paint[r][c]) { ctx.beginPath(); ctx.moveTo(x + T - 1, y); ctx.lineTo(x + T - 1, y + T); ctx.stroke(); }
        ctx.fillStyle = p; ctx.globalAlpha = 0.16;                             // bleeding onto the paper
        for (const [dc, dr] of [[0, -1], [1, 0], [-1, 0]]) if (!solid(c + dc, r + dr)) for (let k = 0; k < 3; k++) {
          const bx = x + T / 2 + dc * (T / 2 + 2) + (dr ? (hash(c + k, r) - 0.5) * T : 0), by = y + T / 2 + dr * (T / 2 + 2) + (dc ? (hash(r + k, c) - 0.5) * T : 0);
          ctx.beginPath(); ctx.ellipse(bx, by, 4 + hash(k, c) * 4, 2 + hash(c, k) * 2, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    // drips below painted tiles
    for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
      const col = lv.paint[r][c]; if (!col || solid(c, r + 1)) continue;
      const p = colorHex[col];
      for (let k = 0; k < 2; k++) {
        const dx = 6 + hash(c + k * 31, r) * (T - 12), len = 6 + hash(r + k * 17, c) * 12 + Math.sin(t * 1.4 + c + k) * 2.5;
        const X = c * T + dx, Y = (r + 1) * T;
        ctx.fillStyle = p; ctx.beginPath(); ctx.moveTo(X - 3, Y);
        ctx.quadraticCurveTo(X - 1.4, Y + len * 0.6, X - 2.2, Y + len);
        ctx.arc(X, Y + len, 2.4, Math.PI, 0, true);
        ctx.quadraticCurveTo(X + 1.4, Y + len * 0.6, X + 3, Y); ctx.fill();
      }
    }
    // hand-inked outlines on every exposed edge
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const tl = lv.tiles[r][c];
      if (tl !== '#' && tl !== 'M') continue;
      const x = c * T, y = r * T, sd = (c * 31 + r * 17) * 3, amp = 1.3 * 0.5;
      if (!solid(c, r - 1)) inkLine(ctx, x - 1, y, x + T + 1, y, sd, amp, 2.5, t);
      if (!solid(c, r + 1)) inkLine(ctx, x - 1, y + T, x + T + 1, y + T, sd + 1, amp, 2.5, t);
      if (!solid(c - 1, r)) inkLine(ctx, x, y - 1, x, y + T + 1, sd + 2, amp, 2.5, t);
      if (!solid(c + 1, r)) inkLine(ctx, x + T, y - 1, x + T, y + T + 1, sd + 3, amp, 2.5, t);
    }
    if (opts.livingPaint) livingPaint(ctx, w, t, colorHex);
    // spikes: inked teeth
    for (const s of lv.spikes) {
      const x = s.c * T, y = s.r * T;
      ctx.fillStyle = inkPattern(ctx); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = k * T / 3, b = a + T / 3, m = (a + b) / 2, lean = Math.sin(t * 1.2 + s.c + k) * 0.6;
        if (s.dir === 'up') { ctx.moveTo(x + a, y + T); ctx.lineTo(x + m + lean, y + 7); ctx.lineTo(x + b, y + T); }
        if (s.dir === 'down') { ctx.moveTo(x + a, y); ctx.lineTo(x + m + lean, y + T - 7); ctx.lineTo(x + b, y); }
        if (s.dir === 'right') { ctx.moveTo(x, y + a); ctx.lineTo(x + T - 7, y + m + lean); ctx.lineTo(x, y + b); }
        if (s.dir === 'left') { ctx.moveTo(x + T, y + a); ctx.lineTo(x + 7, y + m + lean); ctx.lineTo(x + T, y + b); }
      }
      ctx.fill(); ctx.stroke();
    }
  }

  // ---------------- living paint ----------------
  // Each color becomes a material: blue jelly that wobbles when you land on it, green that grows
  // grass and vines, red that glows hot and throws sparks, yellow that sparkles.
  const jelly = new Map();   // "c,r" -> wobble energy (from bounces and landings)
  const grown = new Map();   // "c,r,color" -> when that paint appeared (things grow from then)
  function poke(x, y, k = 1) {
    const c = Math.floor(x / T), r = Math.floor((y + 4) / T);
    for (let dc = -2; dc <= 2; dc++) {
      const key = `${c + dc},${r}`;
      jelly.set(key, Math.min(1.6, (jelly.get(key) || 0) + k * (1 - Math.abs(dc) * 0.3)));
    }
  }
  function livingPaint(ctx, w, t, colorHex) {
    const lv = w.level, open = (c, r) => !w.solid(c, r);
    const now = performance.now();
    for (let r = 0; r < lv.rows; r++) for (let c = 0; c < lv.cols; c++) {
      const col = lv.paint[r][c];
      if (!col || lv.tiles[r][c] !== '#') continue;
      const x = c * T, y = r * T, hex = colorHex[col], key = `${c},${r},${col}`;
      if (!grown.has(key)) grown.set(key, now);
      const age = Math.min(1, (now - grown.get(key)) / 700), h1 = hash(c, r), h2 = hash(r + 3, c);
      if (col === 1) {                                   // BLUE: jelly
        const jk = `${c},${r}`, e = jelly.get(jk) || 0;
        if (e > 0.01) jelly.set(jk, e * 0.93); else jelly.delete(jk);
        if (open(c, r - 1)) {
          const amp = 1.2 + e * 7;
          ctx.fillStyle = hex; ctx.beginPath(); ctx.moveTo(x - 0.5, y + 3);
          for (let i = 0; i <= 8; i++) { const X = x + i * T / 8; ctx.lineTo(X, y + 1 - Math.abs(Math.sin(t * 9 + X * 0.25)) * amp - Math.sin(t * 2 + X * 0.1) * 0.8); }
          ctx.lineTo(x + T + 0.5, y + 3); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath(); ctx.ellipse(x + 8 + ((t * 10 + h1 * 30) % (T - 14)), y + 4, 4, 1.4, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';           // bubbles drifting up inside
        for (let k = 0; k < 2; k++) {
          const p = (t * 0.25 + h1 + k * 0.5) % 1;
          ctx.beginPath(); ctx.arc(x + 6 + hash(c + k, r) * (T - 12), y + T - 4 - p * (T - 8), 1.2 + k * 0.8, 0, Math.PI * 2); ctx.fill();
        }
      } else if (col === 3) {                            // GREEN: grass on top, vines underneath, leaves on the sides
        const sway = Math.sin(t * 2 + c * 0.7) * 2;
        ctx.strokeStyle = '#13a14f'; ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
        if (open(c, r - 1)) {
          for (let k = 0; k < 5; k++) {
            const bx = x + 3 + k * 6.5 + h1 * 2, hgt = (5 + hash(c * 5 + k, r) * 7) * age;
            ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + sway * 0.5, y - hgt * 0.6, bx + sway, y - hgt); ctx.stroke();
          }
          if (h2 > 0.55 && age > 0.6) {                    // a little flower
            ctx.fillStyle = ['#ffc93c', '#ff3b4e', '#fff'][Math.floor(h1 * 3)];
            ctx.beginPath(); ctx.arc(x + 16 + sway, y - 10 * age, 2.4, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (open(c, r + 1)) {
          for (let k = 0; k < 2; k++) {
            const vx = x + 7 + k * 16 + h2 * 4, len = (8 + hash(c, r * 3 + k) * 16) * age, s2 = Math.sin(t * 1.6 + c + k) * 3;
            ctx.beginPath(); ctx.moveTo(vx, y + T); ctx.quadraticCurveTo(vx + s2, y + T + len * 0.5, vx + s2 * 0.6, y + T + len); ctx.stroke();
            ctx.fillStyle = '#1fc160'; ctx.beginPath(); ctx.ellipse(vx + s2 * 0.6 + 2.5, y + T + len - 2, 3.2, 1.6, 0.6, 0, Math.PI * 2); ctx.fill();
          }
        }
        for (const side of [-1, 1]) {
          if (!open(c + side, r)) continue;
          const lx = side < 0 ? x : x + T;
          for (let k = 0; k < 2; k++) {
            const ly = y + 8 + k * 14 + h1 * 4;
            ctx.fillStyle = '#1fc160'; ctx.beginPath(); ctx.ellipse(lx + side * 3 * age, ly + Math.sin(t * 2 + k) * 1, 3.4 * age, 1.6 * age, side * 0.5, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (col === 2) {                            // RED: hot - a glow, sparks, heat haze
        if (open(c, r - 1)) {
          const f = 0.75 + 0.25 * Math.sin(t * 7 + c * 1.3);
          const g = ctx.createLinearGradient(0, y - 22, 0, y + 2);
          g.addColorStop(0, 'rgba(255,90,40,0)'); g.addColorStop(1, `rgba(255,120,40,${0.32 * f})`);
          ctx.fillStyle = g; ctx.fillRect(x, y - 22, T, 24);
          for (let k = 0; k < 2; k++) {
            const p = (t * 0.9 + h1 + k * 0.5) % 1;
            ctx.globalAlpha = 1 - p; ctx.fillStyle = k ? '#ffd23f' : '#ff7a1a';
            ctx.beginPath(); ctx.arc(x + 6 + hash(c, k + r) * (T - 12) + Math.sin(p * 8 + c) * 3, y - p * 30, 1.4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255,140,80,0.18)'; ctx.lineWidth = 1;
          ctx.beginPath(); for (let s2 = 0; s2 <= 18; s2 += 3) ctx.lineTo(x + 16 + Math.sin(s2 * 0.4 + t * 6 + c) * 2.5, y - 4 - s2); ctx.stroke();
        }
      } else if (col === 4) {                            // YELLOW: sparkles and a soft glow
        for (let k = 0; k < 2; k++) {
          const p = (t * 0.7 + hash(c * 3 + k, r)) % 1, a = Math.sin(p * Math.PI);
          const sx = x + 5 + hash(c + k * 7, r) * (T - 10), sy = y + 5 + hash(r + k * 5, c) * (T - 10) - (open(c, r - 1) && k ? 14 : 0), z = 2 + a * 3;
          ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
          ctx.beginPath(); ctx.moveTo(sx, sy - z); ctx.lineTo(sx + z * 0.3, sy); ctx.lineTo(sx, sy + z); ctx.lineTo(sx - z * 0.3, sy); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx - z, sy); ctx.lineTo(sx, sy + z * 0.3); ctx.lineTo(sx + z, sy); ctx.lineTo(sx, sy - z * 0.3); ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  // ---------------- lava ----------------
  function drawLava(ctx, w, t) {
    const lv = w.level;
    if (!lv.lava.length) return;
    for (const l of lv.lava) {
      const x = l.c * T, y = l.r * T;
      const g = ctx.createLinearGradient(0, y, 0, y + T);
      if (l.surface) { g.addColorStop(0, '#fff1a0'); g.addColorStop(0.25, '#ffb703'); g.addColorStop(0.6, '#ff6a00'); g.addColorStop(1, '#c2410c'); }
      else { g.addColorStop(0, '#c2410c'); g.addColorStop(1, '#7c1d06'); }
      ctx.fillStyle = g;
      if (l.surface) {
        ctx.beginPath(); ctx.moveTo(x - 0.5, y + T + 1);
        for (let i = 0; i <= T + 1; i += 3) ctx.lineTo(x + i, y + 5 + Math.sin((x + i) * 0.13 + t * 3) * 2.8 + Math.sin((x + i) * 0.05 - t * 2) * 1.6);
        ctx.lineTo(x + T + 1, y + T + 1); ctx.closePath(); ctx.fill();
        const ph = (t * 0.35 + hash(l.c, l.r) * 10) % 1;                     // bubbles
        if (hash(l.c * 3, l.r) > 0.4) {
          ctx.fillStyle = ph > 0.85 ? 'rgba(255,245,190,0.9)' : 'rgba(255,210,90,0.8)';
          ctx.beginPath(); ctx.arc(x + 6 + hash(l.c, l.r * 7) * (T - 12), y + T - ph * (T - 6), 1.5 + ph * 2.5, 0, Math.PI * 2); ctx.fill();
        }
      } else ctx.fillRect(x - 0.5, y, T + 1, T + 1);
      ctx.strokeStyle = 'rgba(255,240,170,0.28)'; ctx.lineWidth = 1.5;     // heat bands
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        for (let i = 0; i <= T; i += 4) { const X = x + i; ctx.lineTo(X, y + 12 + k * 10 + Math.sin(X * 0.05 + t * 1.5 + k * 2) * 3); }
        ctx.stroke();
      }
    }
    // glow, sparks and heat haze above each run of surface tiles
    const runs = [];
    for (const l of lv.lava.filter((q) => q.surface).sort((a, b) => a.r - b.r || a.c - b.c)) {
      const last = runs[runs.length - 1];
      if (last && last.r === l.r && last.c1 === l.c - 1) last.c1 = l.c; else runs.push({ r: l.r, c0: l.c, c1: l.c });
    }
    for (const run of runs) {
      const x0 = run.c0 * T, x1 = (run.c1 + 1) * T, y = run.r * T;
      const g = ctx.createLinearGradient(0, y - 64, 0, y + 4);
      g.addColorStop(0, 'rgba(255,120,20,0)'); g.addColorStop(1, 'rgba(255,120,20,0.3)');
      ctx.fillStyle = g; ctx.fillRect(x0, y - 64, x1 - x0, 68);
      const n = Math.max(2, Math.round((x1 - x0) / 40));
      for (let k = 0; k < n; k++) {
        const p = (t * 0.6 + hash(k, run.c0)) % 1, sx = x0 + hash(k, run.c0 * 3) * (x1 - x0) + Math.sin(p * 9 + k) * 6, sy = y - p * 80;
        ctx.globalAlpha = 1 - p; ctx.fillStyle = k % 2 ? '#ffd23f' : '#ff8c1a';
        ctx.beginPath(); ctx.arc(sx, sy, 1.5 + (1 - p) * 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,170,90,0.16)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < n; k++) {
        const hx = x0 + (k + 0.5) * (x1 - x0) / n;
        ctx.beginPath(); for (let s = 0; s <= 36; s += 4) ctx.lineTo(hx + Math.sin(s * 0.3 + t * 5 + k) * 3, y - 12 - s); ctx.stroke();
      }
    }
  }

  // ---------------- splatter stains on the paper ----------------
  function makeStain(x, y, col) {
    const drops = [];
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * (0.05 + Math.random() * 0.9), d = 5 + Math.random() * 24;
      drops.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7 - 2, r: 0.9 + Math.random() * 2.4, e: 0.7 + Math.random() * 0.4, a: Math.random() * 3 });
    }
    return { x, y, col, drops };
  }
  function drawStains(ctx, stains) {
    for (const s of stains) {
      ctx.globalAlpha = 0.8; ctx.fillStyle = s.col;
      for (const d of s.drops) { ctx.beginPath(); ctx.ellipse(s.x + d.x, s.y + d.y, d.r, d.r * d.e, d.a, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- finishing touches ----------------
  function shadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.beginPath(); ctx.ellipse(x, y + 1, w, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  let vig = null;
  function vignette(ctx) {
    if (!vig) {
      vig = off(W, H);
      const g = vig.getContext('2d'), v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
      v.addColorStop(0, 'rgba(60,40,20,0)'); v.addColorStop(1, 'rgba(60,40,20,0.15)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(vig, 0, 0);
  }

  // ============================================================
  //  Looks that can be switched (`opts`), all on by default:
  //   color   - 'off': paint stays on the walls (today)
  //             'bloom': paint soaks into the paper around it like watercolor
  //             'sketch': ...and colors the pencil drawing it touches
  //   living  - clouds drift, birds fly, the windmill turns, smoke rises, stars twinkle
  //   parallax- the drawing behind the level shifts a little as you move: depth
  // ============================================================
  // living backgrounds and parallax are the look for everyone (still, for players who ask for less motion)
  const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opts = { color: 'bloom', living: !calm, parallax: !calm };
  const layered = () => opts.color !== 'off' || opts.living || opts.parallax;

  // the sketch in layers, for living/parallax backgrounds (cached per level)
  const M = 28;                                   // spare margin around each layer, for the parallax shift
  const scenes = new Map();
  // How far the drawing behind a wide level scrolls compared with the level (far, mid): depth.
  const SCROLL = [0.12, 0.24];
  function scene(levelName, levelIdx, levelW = W) {
    if (scenes.has(levelName)) return scenes.get(levelName);
    textures();
    // a wide level gets a wider drawing: several sketches side by side, each a bit different
    const lw = W + Math.ceil(Math.max(0, levelW - W) * SCROLL[1]), panels = Math.ceil(lw / W);
    const mk = () => { const c = off(lw + 2 * M, H + 2 * M), g = c.getContext('2d'); return { c, g }; };
    const far = mk(), mid = mk(), still = mk();
    const base = off(W, H), bg = base.getContext('2d');
    bg.fillStyle = PAPER; bg.fillRect(0, 0, W, H);
    const seed = [...levelName].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) >>> 0;
    const anims = [];
    const theme = Math.min(5, Math.floor(levelIdx / 8));
    for (let k = 0; k < panels; k++) {
      for (const L of [far, mid, still]) { L.g.setTransform(1, 0, 0, 1, M + k * W, M); }
      sketchWorld((layer) => (layer === 'far' ? far.g : layer === 'mid' ? mid.g : still.g), theme, seeded(seed + k * 7919), (it) => anims.push({ ...it, ox: k * W }));
    }
    const grainPat = bg.createPattern(grain, 'repeat');
    const sc = { base, far: far.c, mid: mid.c, still: still.c, anims, theme, grainPat };
    scenes.set(levelName, sc);
    return sc;
  }

  // where the player is, for parallax (eased so the background glides)
  const cam = { x: null, y: null, tx: 0, ty: 0 };
  function setCamera(x, y) { cam.tx = x; cam.ty = y; if (cam.x === null) { cam.x = x; cam.y = y; } }

  // things that move in the drawing (pencil style)
  function drawAnims(g, sc, t, dx, dy) {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const it of sc.anims) {
      g.restore(); g.save(); g.translate(dx + (it.ox || 0), dy);
      if (it.kind === 'cloud') {
        const span = W + 220, x = ((it.x + t * (7 + it.s * 4) + 110) % span + span) % span - 110;
        cloudShape(g, x, it.y + Math.sin(t * 0.3 + it.x) * 2, it.s);
      } else if (it.kind === 'birds') {
        const span = W + 300, x = ((it.x + t * 22) % span + span) % span - 150;
        birdShapes(g, x, it.y + Math.sin(t * 0.8) * 8, t * 9);
      } else if (it.kind === 'windmill') {
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + 0.4 + t * 0.5;
          pencilOf(g, 0.18); g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(it.x + Math.cos(a) * 48, it.y + Math.sin(a) * 48); g.stroke();
          pencilOf(g, 0.1); g.beginPath(); g.moveTo(it.x + Math.cos(a) * 14, it.y + Math.sin(a) * 14);
          g.lineTo(it.x + Math.cos(a) * 46 + Math.cos(a + 1.57) * 8, it.y + Math.sin(a) * 46 + Math.sin(a + 1.57) * 8); g.stroke();
        }
        pencilOf(g, 0.2); g.beginPath(); g.arc(it.x, it.y, 3, 0, Math.PI * 2); g.stroke();
      } else if (it.kind === 'smoke') {
        for (let k = 0; k < 5; k++) {
          const p = ((t * 0.12 + k / 5) % 1), y = it.y - 18 - p * 130, x = it.x + Math.sin(p * 5 + k) * 10 + p * 24;
          pencilOf(g, 0.16 * (1 - p)); g.beginPath(); g.arc(x, y, 10 + p * 22, 0, Math.PI * 2); g.stroke();
        }
      } else if (it.kind === 'star') {
        const a = 0.08 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2.2 + it.ph)), r = it.r * (0.8 + 0.3 * Math.sin(t * 2.2 + it.ph));
        pencilOf(g, a); g.beginPath(); g.moveTo(it.x - r, it.y); g.lineTo(it.x + r, it.y); g.moveTo(it.x, it.y - r); g.lineTo(it.x, it.y + r); g.stroke();
      } else if (it.kind === 'leaves') {
        for (let k = 0; k < 7; k++) {
          const p = (t * 0.05 + hash(k, 3)) % 1, x = hash(k, 9) * W + Math.sin(t * 1.3 + k) * 18, y = -10 + p * (H * 0.75);
          g.save(); g.translate(x, y); g.rotate(Math.sin(t * 2 + k) * 0.9);
          pencilOf(g, 0.2 * Math.min(1, (1 - p) * 4)); g.beginPath(); g.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2); g.moveTo(-5, 0); g.lineTo(5, 0); g.stroke();
          g.restore();
        }
      } else if (it.kind === 'bats') {
        for (let k = 0; k < 3; k++) {
          const a = t * 0.7 + k * 2.1, x = it.x + Math.cos(a) * (60 + k * 20), y = it.y + Math.sin(a * 1.3) * 26, f = Math.sin(t * 12 + k) * 4;
          pencilOf(g, 0.22); g.beginPath(); g.moveTo(x - 8, y - f); g.quadraticCurveTo(x - 4, y + 2, x, y); g.quadraticCurveTo(x + 4, y + 2, x + 8, y - f); g.stroke();
        }
      } else if (it.kind === 'embers') {
        for (let k = 0; k < 10; k++) {
          const p = (t * 0.07 + hash(k, 21)) % 1, x = hash(k, 22) * W + Math.sin(t + k) * 12, y = H * 0.8 - p * H * 0.75;
          g.fillStyle = `rgba(255,${120 + k * 10},40,${0.35 * (1 - p)})`; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
        }
      } else if (it.kind === 'windows') {
        // a few city windows light up and go dark
        for (let k = 0; k < 8; k++) {
          if (Math.sin(t * 0.4 + k * 2.3) < 0.3) continue;
          const x = 30 + hash(k, 41) * (W - 60), y = 250 + hash(k, 42) * 140;
          g.fillStyle = 'rgba(255,201,60,0.18)'; g.fillRect(x, y, 6, 9);
        }
      }
    }
    g.restore();
  }

  // ---- color soaking into the paper ----
  // (canvases made on first use: W and H come from world.js, which loads after this file)
  let bleed, bleedG, live, liveG;
  function buffers(w = W, h = H) {
    if (bleed && bleed.width === w && bleed.height === h) return;
    const mk = () => { const c = off(w, h); return [c, c.getContext('2d')]; };
    [bleed, bleedG] = mk(); [live, liveG] = mk();
  }
  let blooms = [];
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // one watercolor bloom: a couple of ragged, overlapping washes with a darker rim where the
  // water dried, and a few granules of pigment
  function blobPath(g, x, y, r, seed) {
    const n = 28, p1 = hash(seed, 1) * 6, p2 = hash(seed, 2) * 6, p3 = hash(seed, 3) * 6;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + 0.16 * Math.sin(a * 3 + p1) + 0.09 * Math.sin(a * 5 + p2) + 0.05 * Math.sin(a * 9 + p3);
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k * 0.86;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }
  function paintBloom(g, b, k) {
    const [R, G, B] = rgb(b.col), e = 1 - Math.pow(1 - Math.min(1, k), 3), rad = b.r * e, s = b.strength;
    if (rad < 1) return;
    g.save();
    g.translate(b.x, b.y); g.scale(b.along === 'v' ? 0.5 : 2, b.along === 'v' ? 2 : 0.5); g.translate(-b.x, -b.y);
    for (let i = 0; i < 3; i++) {
      const a = b.seed * 7 + i * 2.4, d = rad * 0.28 * hash(b.seed + i, 3);
      const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d * 0.8, r = rad * (0.62 + 0.38 * hash(i, b.seed));
      const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r * 1.1);
      gr.addColorStop(0, `rgba(${R},${G},${B},${0.07 * s})`);
      gr.addColorStop(0.75, `rgba(${R},${G},${B},${0.12 * s})`);
      gr.addColorStop(1, `rgba(${R},${G},${B},${0.2 * s})`);
      g.fillStyle = gr; blobPath(g, x, y, r, b.seed * 3 + i); g.fill();
      g.strokeStyle = `rgba(${R},${G},${B},${0.16 * s})`; g.lineWidth = 1.6; g.stroke();   // the dried rim
    }
    if (k >= 1) {                                    // granulation, once it has settled
      g.fillStyle = `rgba(${R},${G},${B},${0.22 * s})`;
      for (let i = 0; i < 26; i++) {
        const a = hash(b.seed, i) * Math.PI * 2, d = Math.sqrt(hash(i, b.seed)) * rad * 0.9;
        g.beginPath(); g.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * 0.86, 0.6 + hash(i, i + b.seed) * 1.1, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }
  // along: 'h' for a floor or ceiling, 'v' for a wall - the wash spreads along the surface, low and wide
  function bloom(x, y, col, along = 'h', size = 1) {
    if (opts.color === 'off') return;
    blooms.push({ x, y, col, along, r: (14 + Math.random() * 6) * size, seed: Math.floor(Math.random() * 1000), born: performance.now(), dur: 500 + size * 300, strength: 0.85 });
  }
  // a new level (w x h pixels): fresh paper, nothing soaked in yet
  function resetLevel(w = W, h = H) { buffers(w, h); bleedG.clearRect(0, 0, w, h); blooms = []; jelly.clear(); grown.clear(); }
  // the bleed layer this frame: settled blooms, plus the ones still spreading
  function bleedNow() {
    const now = performance.now();
    blooms = blooms.filter((b) => {
      const k = (now - b.born) / b.dur;
      if (k >= 1) { paintBloom(bleedG, b, 1); return false; }
      return true;
    });
    if (!blooms.length) return bleed;
    liveG.clearRect(0, 0, live.width, live.height); liveG.drawImage(bleed, 0, 0);
    for (const b of blooms) { const k = (now - b.born) / b.dur; if (k > 0) paintBloom(liveG, b, k); }
    return live;
  }

  // the whole background for the lab looks: paper, sketch (moving or still), soaked-in color, grain
  // the background: paper and the pencil drawing (moving, with parallax depth). Screen space.
  // scrollX: how far a wide level's camera has moved (0 for one-screen levels).
  function drawScene(ctx, levelName, levelIdx, t, scrollX = 0, levelW = W) {
    const sc = scene(levelName, levelIdx, levelW);
    cam.x += (cam.tx - cam.x) * 0.06; cam.y += (cam.ty - cam.y) * 0.06;
    const px = opts.parallax ? (W / 2 - cam.x) : 0, py = opts.parallax ? (H / 2 - cam.y) : 0;
    const far = [px * 0.022 - scrollX * SCROLL[0], py * 0.012], mid = [px * 0.05 - scrollX * SCROLL[1], py * 0.025];
    ctx.drawImage(sc.base, 0, 0);
    ctx.drawImage(sc.far, -M + far[0], -M + far[1]);
    ctx.drawImage(sc.mid, -M + mid[0], -M + mid[1]);
    if (opts.living) drawAnims(ctx, sc, t, mid[0] * 0.6 - scrollX * SCROLL[1] * 0.4, mid[1] * 0.6);
    else ctx.drawImage(sc.still, -M + mid[0] * 0.6 - scrollX * SCROLL[1] * 0.4, -M + mid[1] * 0.6);
    ctx.fillStyle = sc.grainPat; ctx.fillRect(0, 0, W, H);
  }
  // the paint soaked into the paper around painted surfaces. Level space (under the walls).
  function drawBleed(ctx) {
    if (opts.color === 'off' || !bleed) return;
    const b = bleedNow();
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(b, 0, 0); ctx.restore();
  }

  return { inkPattern, paper, plainPaper, inkLine, drawTiles, drawLava, makeStain, drawStains, shadow, vignette,
    opts, layered, drawScene, drawBleed, setCamera, bloom, resetLevel, poke };
})();
