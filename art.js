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
  function sketchWorld(g, theme, rnd) {
    g.lineCap = 'round'; g.lineJoin = 'round';
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
    const cloud = (cx, cy, s) => { pencil(0.14); g.beginPath(); g.arc(cx, cy, 14 * s, Math.PI, 0); g.arc(cx + 22 * s, cy - 4 * s, 18 * s, Math.PI, 0); g.arc(cx + 46 * s, cy, 12 * s, Math.PI, 0); g.stroke(); };
    const birds = (bx, by) => { for (let i = 0; i < 3; i++) { const x = bx + i * 20, y = by + (i % 2) * 10; pencil(0.2); g.beginPath(); g.moveTo(x - 6, y); g.quadraticCurveTo(x - 3, y - 4, x, y); g.quadraticCurveTo(x + 3, y - 4, x + 6, y); g.stroke(); } };
    const ph = rnd() * 6;

    if (theme === 0) {                                       // blue: rolling hills, a windmill, clouds
      ridge(300, 60, 0.006, 0.017, ph, 0.2); ridge(370, 40, 0.009, 0.021, ph + 2, 0.13);
      const mx = 120 + rnd() * 700, my = 200;
      wob([[mx - 14, my + 95], [mx - 8, my], [mx + 8, my], [mx + 14, my + 95]], 0.18);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; wob([[mx, my], [mx + Math.cos(a) * 48, my + Math.sin(a) * 48]], 0.18, 1); }
      for (let i = 0; i < 3; i++) cloud(120 + i * 300 + rnd() * 80, 60 + rnd() * 40, 0.9 + rnd() * 0.4);
      birds(400 + rnd() * 200, 110);
    } else if (theme === 1) {                                // red: volcanoes with smoke
      for (let i = 0; i < 2; i++) {
        const vx = 200 + i * 480 + rnd() * 80, vy = 150 + rnd() * 40, base = 400;
        wob([[vx - 190, base], [vx - 30, vy], [vx + 30, vy], [vx + 190, base]], 0.2);
        for (let k = 0; k < 6; k++) { pencil(0.08); g.beginPath(); g.moveTo(vx - 30 + k * 10, vy + 4); g.lineTo(vx - 80 + k * 30, base - 10); g.stroke(); }
        for (let k = 0; k < 4; k++) { pencil(0.12); g.beginPath(); g.arc(vx + Math.sin(k) * 14, vy - 30 - k * 26, 14 + k * 5, 0, Math.PI * 2); g.stroke(); }
      }
      ridge(420, 25, 0.01, 0.03, ph, 0.12);
    } else if (theme === 2) {                                // green: forest of pines and round trees
      ridge(360, 30, 0.007, 0.02, ph, 0.14);
      for (let i = 0; i < 16; i++) {
        const tx = 20 + i * 62 + rnd() * 30, ty = 330 - rnd() * 60, h = 70 + rnd() * 70;
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
        wob([[bx, 420], [bx, by], [bx + bw, by], [bx + bw, 420]], 0.16, 1);
        for (let y = by + 12; y < 410; y += 22) for (let x = bx + 8; x < bx + bw - 10; x += 14) { pencil(0.09); g.strokeRect(x, y, 6, 9); }
        if (rnd() < 0.3) wob([[bx + bw / 2, by], [bx + bw / 2, by - 30]], 0.15, 1);
      }
      for (let i = 0; i < 2; i++) cloud(200 + i * 420, 70, 1);
    } else if (theme === 4) {                                // purple: night sky, moon, stars and a castle
      pencil(0.2); g.beginPath(); g.arc(780, 100, 40, 0, Math.PI * 2); g.stroke();
      pencil(0.08); g.beginPath(); g.arc(795, 92, 34, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 30; i++) {
        const sx = rnd() * W, sy = rnd() * 260, r = 2 + rnd() * 3;
        pencil(0.18); g.beginPath(); g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
      }
      const cx = 260 + rnd() * 200, cy = 220;
      wob([[cx, 420], [cx, cy], [cx + 200, cy], [cx + 200, 420]], 0.16, 1);
      for (const tx of [cx - 20, cx + 180]) { wob([[tx, 420], [tx, cy - 60], [tx + 40, cy - 60], [tx + 40, 420]], 0.16, 1); wob([[tx - 6, cy - 60], [tx + 20, cy - 110], [tx + 46, cy - 60]], 0.16, 1); }
      for (let x = cx; x < cx + 200; x += 20) { pencil(0.14); g.strokeRect(x, cy - 12, 10, 12); }
    } else {                                                  // finale: a bit of everything
      ridge(330, 50, 0.006, 0.018, ph, 0.16);
      const vx = 700; wob([[vx - 150, 380], [vx - 20, 170], [vx + 20, 170], [vx + 150, 380]], 0.16);
      for (let i = 0; i < 6; i++) { const bx = 60 + i * 50, bh = 80 + rnd() * 120; wob([[bx, 380], [bx, 380 - bh], [bx + 36, 380 - bh], [bx + 36, 380]], 0.12, 1); }
      for (let i = 0; i < 12; i++) { const sx = rnd() * W, sy = rnd() * 140, r = 2 + rnd() * 2; pencil(0.16); g.beginPath(); g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke(); }
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
    sketchWorld(g, Math.min(5, Math.floor(levelIdx / 8)), seeded(seed));
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
    const pAt = (c, r) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? lv.paint[r][c] : 0);
    // all plain blocks share one ink texture
    ctx.save(); ctx.beginPath();
    let any = false;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (lv.tiles[r][c] === '#' && !lv.paint[r][c]) { ctx.rect(c * T - 0.5, r * T - 0.5, T + 1, T + 1); any = true; }
    if (any) { ctx.clip(); ctx.fillStyle = inkPattern(ctx); ctx.fillRect(0, 0, W, H); }
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

  return { inkPattern, paper, plainPaper, inkLine, drawTiles, drawLava, makeStain, drawStains, shadow, vignette };
})();
