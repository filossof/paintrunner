'use strict';

// ============================================================
//  Story: the opening comic, "The Great Fade".
//  Five panels drawn in the game's ink-and-watercolor style, each with a caption that types
//  itself out. Tap / click / Space / Enter / → moves on (or finishes the caption first);
//  Esc or "Skip" ends it. Story.play(onDone) shows it in a layer over the game.
// ============================================================

const Story = (() => {
  const SW = 960, SH = 544;
  const INK = '#1c1c1f', PAPER = '#f1ece0';
  const C = { blue: '#2f7bff', red: '#ff3b4e', green: '#1fc160', yellow: '#ffc93c', purple: '#9b5de5' };
  const RAINBOW = [C.red, C.yellow, C.green, C.blue, C.purple];
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

  // ---------------- drawing helpers ----------------
  // a pencil line through points, with a fixed hand-drawn wobble
  function pencil(g, pts, a = 0.5, w = 1.6, seed = 1) {
    g.strokeStyle = `rgba(60,55,50,${a})`; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.globalAlpha = pass ? 0.5 : 1;
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = x + (hash(seed + i, pass + 3) - 0.5) * 2.2, jy = y + (hash(i + 7, seed + pass) - 0.5) * 2.2;
        i ? g.lineTo(jx, jy) : g.moveTo(jx, jy);
      });
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  const curve = (f, x0, x1, step = 16) => { const p = []; for (let x = x0; x <= x1; x += step) p.push([x, f(x)]); return p; };
  // an irregular watercolor wash with a darker dried rim
  function wash(g, x, y, rx, ry, col, a = 0.35, seed = 1) {
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      const n = 30;
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * Math.PI * 2;
        const j = 1 + 0.08 * Math.sin(t * 3 + seed + i) + 0.05 * Math.sin(t * 7 + seed * 2);
        const px = x + Math.cos(t) * rx * j, py = y + Math.sin(t) * ry * j;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
      g.fillStyle = rgba(col, a * (i ? 0.6 : 1)); g.fill();
      g.strokeStyle = rgba(col, a * 0.9); g.lineWidth = 1.5; g.stroke();
    }
  }
  // a band of wash under a curve (hills, ground)
  function washUnder(g, f, col, a, bottom = SH) {
    g.beginPath(); g.moveTo(-10, bottom);
    for (let x = -10; x <= SW + 10; x += 12) g.lineTo(x, f(x));
    g.lineTo(SW + 10, bottom); g.closePath();
    g.fillStyle = rgba(col, a); g.fill();
  }
  function paper(g) {
    g.fillStyle = PAPER; g.fillRect(0, 0, SW, SH);
    if (typeof ART !== 'undefined') g.drawImage(ART.plainPaper(), 0, 0, SW, SH);
  }
  // a paint pail, the paint inside in `col`
  function can(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 1.6;
    g.beginPath(); g.arc(0, -6, 8.5, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    const m = g.createLinearGradient(-8, 0, 8, 0);
    m.addColorStop(0, '#aeb3bc'); m.addColorStop(0.35, '#eef0f3'); m.addColorStop(1, '#8d939d');
    g.fillStyle = m; g.beginPath(); g.moveTo(-8, -6); g.lineTo(8, -6); g.lineTo(6.2, 9); g.quadraticCurveTo(0, 10.4, -6.2, 9); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = col; g.beginPath(); g.ellipse(0, -6, 8.4, 2.7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(5, -5); g.quadraticCurveTo(6.5, 0, 5.2, 3); g.lineTo(4, 3); g.quadraticCurveTo(4.6, 0, 3.6, -5); g.fill();
    g.restore();
  }
  // our hero (the first character), standing on (x, y)
  function hero(g, x, y, o) {
    if (typeof SHOP === 'undefined' || typeof CHARACTERS === 'undefined') return;
    g.save(); g.translate(x, y);
    SHOP.drawHero(g, CHARACTERS[0], { s: 1.6, col: C.blue, t: 0, run: 0, moving: 0, air: false, face: 1, squash: 1, ...o }, {});
    g.restore();
  }
  // the Eraser: a big rubber eraser in a white top hat, with a grumpy face
  function eraser(g, x, y, s, t, mood = 'grumpy') {
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.12 + Math.sin(t * 6) * 0.05);
    g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 3;
    // body: rubber, with a paper sleeve
    g.fillStyle = '#f7c6cf'; rr(g, -70, -40, 140, 80, 14); g.fill(); g.stroke();
    g.fillStyle = '#dfe6f0'; rr(g, -18, -42, 76, 84, 6); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(28,28,31,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-8, -30); g.lineTo(48, -30); g.moveTo(-8, 30); g.lineTo(48, 30); g.stroke();
    g.fillStyle = 'rgba(28,28,31,0.5)'; g.font = '800 13px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('ERASE', 20, 6);
    // face on the rubber
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.4;
    for (const ex of [-52, -32]) { g.beginPath(); g.ellipse(ex, -8, 7, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = INK;
    for (const ex of [-52, -32]) { g.beginPath(); g.arc(ex - 2, -6, 3.2, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = 3.5; g.beginPath();
    if (mood === 'grumpy') { g.moveTo(-61, -22); g.lineTo(-45, -15); g.moveTo(-23, -22); g.lineTo(-39, -15); }
    else { g.moveTo(-61, -18); g.lineTo(-45, -21); g.moveTo(-23, -18); g.lineTo(-39, -21); }
    g.stroke();
    g.lineWidth = 3; g.beginPath();
    if (mood === 'grumpy') { g.moveTo(-52, 18); g.quadraticCurveTo(-42, 10, -32, 18); } else { g.moveTo(-54, 12); g.quadraticCurveTo(-42, 24, -30, 12); }
    g.stroke();
    // white top hat
    g.save(); g.translate(-40, -40); g.rotate(-0.15);
    g.fillStyle = '#fbfaf6'; g.lineWidth = 2.6;
    rr(g, -26, -4, 52, 8, 3); g.fill(); g.stroke();
    rr(g, -17, -42, 34, 40, 4); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(-17, -12, 34, 7);
    g.restore();
    g.restore();
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // a Washer: a little white blob in a white hat, carrying a can over its head
  function washer(g, x, y, s, t, canCol) {
    const bob = Math.abs(Math.sin(t * 8)) * 3;
    g.save(); g.translate(x, y - bob); g.scale(s, s);
    g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 2.2;
    g.fillStyle = '#fbfaf6'; rr(g, -11, -36, 22, 34, 10); g.fill(); g.stroke();
    g.fillStyle = INK;
    for (const ex of [-4, 4]) { g.beginPath(); g.arc(ex + 2, -24, 2.2, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(-16, -8); g.lineTo(-10, -2); g.stroke();
    // feet
    for (const [dx, ph] of [[-5, 0], [5, Math.PI]]) { g.beginPath(); g.ellipse(dx + Math.sin(t * 8 + ph) * 3, -1, 4, 2.4, 0, 0, Math.PI * 2); g.fill(); }
    // hat
    g.fillStyle = '#fbfaf6'; rr(g, -13, -40, 26, 5, 2); g.fill(); g.stroke(); rr(g, -8, -56, 16, 17, 2); g.fill(); g.stroke();
    // arms up, holding the can
    g.beginPath(); g.moveTo(-9, -26); g.lineTo(-7, -62); g.moveTo(9, -26); g.lineTo(7, -62); g.stroke();
    g.restore();
    if (canCol) can(g, x, y - bob - 70 * s, 1.5 * s, canCol);
  }

  // ---------------- the world, in full color or rubbed clean ----------------
  const hill1 = (x) => 330 - Math.sin(x * 0.006 + 0.6) * 46 - Math.sin(x * 0.017) * 12;
  const hill2 = (x) => 392 - Math.sin(x * 0.009 + 2.2) * 30 - Math.sin(x * 0.023 + 1) * 8;
  const ground = (x) => 452 + Math.sin(x * 0.012) * 6;
  function landscape(g, t, color) {
    paper(g);
    if (color) {
      const sky = g.createLinearGradient(0, 0, 0, 340);                                  // sky
      sky.addColorStop(0, rgba(C.blue, 0.24)); sky.addColorStop(1, rgba(C.blue, 0));
      g.fillStyle = sky; g.fillRect(0, 0, SW, 340);
      wash(g, 820, 92, 46, 46, C.yellow, 0.55, 3);                                      // sun
      RAINBOW.forEach((c, i) => {                                                       // rainbow
        g.strokeStyle = rgba(c, 0.4); g.lineWidth = 11; g.beginPath(); g.arc(330, 380, 300 - i * 12, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      });
      washUnder(g, hill1, C.purple, 0.22);
      washUnder(g, hill2, C.green, 0.35);
      washUnder(g, ground, C.green, 0.3);
      for (let i = 0; i < 26; i++) {                                                     // flowers
        const x = 30 + hash(i, 1) * 900, y = ground(x) + 14 + hash(i, 2) * 70;
        wash(g, x, y, 4.5, 4, [C.red, C.yellow, C.purple, C.blue][i % 4], 0.8, i);
      }
      wash(g, 640, 248, 22, 16, C.red, 0.6, 5);                                         // windmill roof
      for (const [x, y, r] of [[140, 360, 34], [210, 372, 26], [760, 380, 30]]) wash(g, x, y, r, r * 0.9, C.green, 0.5, x);
      g.fillStyle = rgba(C.blue, 0.3); g.beginPath(); g.moveTo(0, 520);                 // river
      g.quadraticCurveTo(300, 470, 520, 505); g.quadraticCurveTo(760, 540, 960, 490); g.lineTo(960, 544); g.lineTo(0, 544); g.fill();
    }
    // the pencil drawing (stays when the color is gone)
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pencil(g, [[820 + Math.cos(a) * 58, 92 + Math.sin(a) * 58], [820 + Math.cos(a) * 72, 92 + Math.sin(a) * 72]], 0.4, 1.4, k); }
    g.strokeStyle = 'rgba(60,55,50,0.45)'; g.lineWidth = 1.6; g.beginPath(); g.arc(820, 92, 44, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(60,55,50,0.3)'; g.lineWidth = 1.3;
    for (const r of [300, 240]) { g.beginPath(); g.arc(330, 380, r, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
    pencil(g, curve(hill1, -10, 970), 0.45, 1.6, 11);
    pencil(g, curve(hill2, -10, 970), 0.5, 1.7, 12);
    pencil(g, curve(ground, -10, 970), 0.6, 2, 13);
    // windmill, turning
    pencil(g, [[624, 340], [632, 252], [648, 252], [656, 340]], 0.55, 1.8, 21);
    pencil(g, [[618, 256], [640, 232], [662, 256]], 0.55, 1.8, 22);
    for (let k = 0; k < 4; k++) {
      const a = t * 0.8 + k * Math.PI / 2;
      pencil(g, [[640, 262], [640 + Math.cos(a) * 58, 262 + Math.sin(a) * 58]], 0.55, 1.8, 30 + k);
    }
    // trees
    for (const [x, y, r] of [[140, 360, 34], [210, 372, 26], [760, 380, 30]]) {
      g.strokeStyle = 'rgba(60,55,50,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      pencil(g, [[x, y + r * 0.6], [x, y + r + 34]], 0.55, 2, x);
    }
    // river banks and birds
    pencil(g, [[0, 520], [160, 492], [320, 488], [520, 505], [760, 528], [960, 490]], 0.4, 1.4, 41);
    for (let i = 0; i < 3; i++) {
      const bx = 60 + t * 30 + i * 26, by = 140 + (i % 2) * 12, f = Math.sin(t * 9 + i) * 4;
      if (bx > SW + 20) continue;                         // flown away: gone for good
      pencil(g, [[bx - 7, by - f * 0.4], [bx - 3, by - 4 - f], [bx, by], [bx + 3, by - 4 - f], [bx + 7, by - f * 0.4]], 0.5, 1.4, 50 + i);
    }
  }

  // ---------------- the panels ----------------
  const off = () => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c; };
  let bufA, bufB;
  const INTRO = [
    {
      text: 'Once upon a time, the world was full of color.',
      draw(g, t) {
        landscape(g, t, true);
        // the ink blob, hopping and splashing paint
        const hop = Math.abs(Math.sin(t * 3.4)) * 18;
        hero(g, 420, ground(420) - hop + 2, { t, air: hop > 3, squash: hop > 3 ? 1.08 : 0.94 });
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.5 + i / 4) % 1, c = RAINBOW[(i + Math.floor(t * 0.5)) % 5];
          const x = 420 + 20 + p * 160 * (i % 2 ? 1 : -0.7), y = ground(420) - 70 - Math.sin(p * Math.PI) * 90 + p * 40;
          g.globalAlpha = 1 - p * 0.3; g.fillStyle = c; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        }
      },
    },
    {
      text: 'Then came the Eraser. He hated color.',
      draw(g, t) {
        // the Eraser rubs across the page; the color is gone wherever he has been
        const k = Math.min(1, t / 5.5), ex = -160 + (k * k * (3 - 2 * k)) * (SW + 320), ey = 250 + Math.sin(t * 5) * 34;
        bufA = bufA || off(); bufB = bufB || off();
        landscape(bufA.getContext('2d'), t, false);
        landscape(bufB.getContext('2d'), t, true);
        g.drawImage(bufA, 0, 0);
        g.save(); g.beginPath(); g.moveTo(SW + 10, -10);
        for (let y = -10; y <= SH + 10; y += 20) g.lineTo(ex + 30 + Math.sin(y * 0.05 + t * 4) * 26, y);
        g.lineTo(SW + 10, SH + 10); g.closePath(); g.clip();
        g.drawImage(bufB, 0, 0);
        g.restore();
        // crumbs and smudges behind him
        for (let i = 0; i < 40; i++) {
          const x = ex - 40 - hash(i, 3) * 360, y = 60 + hash(i, 4) * 440;
          if (x < -10) continue;
          g.fillStyle = `rgba(150,140,140,${0.5 * hash(i, 5)})`; g.beginPath(); g.ellipse(x, y, 2 + hash(i, 6) * 3, 1.5, hash(i, 7) * 3, 0, Math.PI * 2); g.fill();
        }
        eraser(g, ex, ey, 1.25, t, 'grumpy');
      },
    },
    {
      text: 'He scrubbed the world clean, and his Washers locked every color away in paint cans.',
      draw(g, t) {
        landscape(g, t, false);
        // a volcano far away: where the colors are taken
        pencil(g, [[720, 340], [810, 236], [846, 236], [940, 340]], 0.45, 1.6, 61);
        for (let k = 0; k < 4; k++) {
          const p = (t * 0.15 + k / 4) % 1;
          g.strokeStyle = `rgba(60,55,50,${0.3 * (1 - p)})`; g.lineWidth = 1.4;
          g.beginPath(); g.arc(826 - p * 70, 224 - p * 60, 8 + p * 14, 0, Math.PI * 2); g.stroke();
        }
        // the Washers march off with the colors - the only color left in the world
        RAINBOW.forEach((c, i) => {
          const x = 60 + i * 120 + t * 46, y = ground(x) + 30 + (i % 2) * 22;
          if (x > SW + 60) return;                         // marched off with the color: gone
          washer(g, x, y, 1.1, t + i, c);
        });
        eraser(g, 150, 205, 0.8, t, 'smug');
      },
    },
    {
      text: 'But one little ink blob was missed... and it found one last can of blue.',
      draw(g, t) {
        paper(g);
        pencil(g, curve((x) => 430 + Math.sin(x * 0.01) * 5, -10, 970), 0.6, 2, 71);
        const rock = [[150, 432], [170, 360], [240, 330], [310, 352], [330, 432]];
        const walk = ease((t - 1.1) / 1.6), got = t > 2.9;
        const hx = 290 + walk * 290, peek = t < 1.1;
        const blob = () => hero(g, hx, 432, { t, moving: walk > 0 && walk < 1 ? 1 : 0, run: (t * 2) % 1, col: got ? C.blue : '#8a8a92', face: 1,
          squash: got ? 1 + Math.sin(t * 9) * 0.05 : 1 });
        if (peek) blob();                                  // peeking out from behind the rock...
        g.fillStyle = PAPER; g.beginPath(); rock.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill();
        pencil(g, rock, 0.55, 2, 72);
        if (!got) can(g, 610, 420, 3, C.blue);
        const splash = Math.max(0, Math.min(1, (t - 2.9) / 0.8));
        if (splash > 0) {
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + 0.4, d = 30 + splash * (60 + hash(i, 9) * 80);
            wash(g, 590 + Math.cos(a) * d, 360 + Math.sin(a) * d * 0.6, 14 + hash(i, 8) * 20, 10 + hash(i, 2) * 14, C.blue, 0.5 * (1 - splash * 0.4), i);
          }
          wash(g, 590, 430, 150 * ease(splash), 16, C.blue, 0.4, 3);
        }
        if (!peek) blob();                                 // ...then out, and to the can
      },
    },
    {
      text: 'Run. Paint. Bring the colors home!',
      final: true,
      draw(g, t) {
        paper(g);
        const gy = (x) => 440 + Math.sin(x * 0.01) * 5;
        // the ground turns blue behind the running hero
        const run = ease(t / 3), hx = -40 + run * 640;          // runs in once, then waits, eager to go
        // a ragged watercolor stripe of blue along the ground, up to the hero
        g.beginPath(); g.moveTo(-10, gy(-10) + 2);
        for (let x = -10; x <= hx; x += 6) g.lineTo(x, gy(x) - 2 + Math.sin(x * 0.06) * 1.5);
        for (let x = hx; x >= -10; x -= 6) g.lineTo(x, gy(x) + 18 + Math.sin(x * 0.045 + 1) * 5 + Math.sin(x * 0.11) * 3);
        g.closePath(); g.fillStyle = rgba(C.blue, 0.4); g.fill(); g.strokeStyle = rgba(C.blue, 0.55); g.lineWidth = 1.5; g.stroke();
        for (let i = 0; i < 12; i++) {                     // drips
          const x = 40 + i * 77; if (x > hx - 20) break;
          const len = 10 + hash(i, 4) * 26;
          g.fillStyle = rgba(C.blue, 0.45); g.beginPath(); g.ellipse(x, gy(x) + 20 + len / 2, 2.4, len / 2, 0, 0, Math.PI * 2); g.fill();
        }
        pencil(g, curve(gy, -10, 970), 0.6, 2, 81);
        const moving = run < 0.98, hop = moving ? Math.abs(Math.sin(t * 10)) * 6 : Math.abs(Math.sin(t * 4)) * 10;
        hero(g, hx, gy(hx) - hop, { t, moving: moving ? 1 : 0, run: (t * 2.6) % 1, face: 1, squash: 1, air: hop > 3 });
        // the five colors waiting far away
        RAINBOW.forEach((c, i) => can(g, 560 + i * 70, 150 + Math.sin(t * 2 + i) * 6, 2.2, c));
        g.fillStyle = INK; g.font = '900 54px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'; g.textAlign = 'center';
        g.fillText('PAINT RUNNER', 320, 170);
      },
    },
  ];

  // ---------------- the ending (after level 45): a teaser for Chapter 2 ----------------
  const shimmer = (t, k = 0) => `hsl(${(t * 140 + k * 60) % 360}, 90%, 56%)`;    // the color nobody has ever seen
  // a swirling ink hole in the paper
  function portal(g, x, y, r, t) {
    for (let i = 5; i >= 0; i--) {
      g.fillStyle = `rgba(28,28,31,${0.18 + i * 0.12})`;
      g.beginPath(); g.ellipse(x, y, r * (1 - i * 0.14) , r * 1.25 * (1 - i * 0.14), 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(240,236,224,0.35)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.2) {
        const rr2 = r * (1 - a / (Math.PI * 3.2)), ang = a + t * 2.4 + k * 2.1;
        const px = x + Math.cos(ang) * rr2, py = y + Math.sin(ang) * rr2 * 1.25;
        a ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
  }
  const ENDING = [
    {
      text: 'You did it! All five colors are home, and the world is bright again.',
      draw(g, t) {
        landscape(g, t, true);
        const hop = Math.abs(Math.sin(t * 4)) * 26;
        hero(g, 470, ground(470) - hop + 2, { t, air: hop > 3, squash: hop > 3 ? 1.1 : 0.9, col: RAINBOW[Math.floor(t * 2) % 5] });
        RAINBOW.forEach((c, i) => can(g, 300 + i * 90 + (i > 1 ? 70 : 0), ground(300 + i * 90) + 6, 2.2, c));
        for (let i = 0; i < 40; i++) {                       // confetti of paint, falling once
          const y = -20 + (t * (90 + hash(i, 1) * 80)) - hash(i, 2) * 300, x = hash(i, 3) * SW + Math.sin(t * 2 + i) * 14;
          if (y < -10 || y > SH + 10) continue;
          g.fillStyle = RAINBOW[i % 5]; g.beginPath(); g.ellipse(x, y, 4, 2.6, t * 3 + i, 0, Math.PI * 2); g.fill();
        }
      },
    },
    {
      text: 'But the Eraser got away...',
      draw(g, t) {
        landscape(g, t, true);
        portal(g, 850, 270, 46 + Math.min(1, t / 0.8) * 20, t);
        // he scurries off toward the hole, getting smaller, and is gone
        const q = Math.min(1, t / 4.5), k = q * q * (3 - 2 * q), x = 300 + k * 550, y = 300 - k * 30, sc = 0.9 - k * 0.75;
        if (k < 0.97) {
          eraser(g, x, y, sc, t, 'smug');
          can(g, x + 60 * sc, y - 10 * sc, 2.6 * sc, shimmer(t));
        }
        hero(g, 170, ground(170) + 2, { t, face: 1, col: C.blue });
      },
    },
    {
      text: '...and he took a color nobody has ever seen.',
      draw(g, t) {
        paper(g);
        g.fillStyle = 'rgba(28,28,31,0.88)'; g.fillRect(0, 0, SW, SH);
        const glow = g.createRadialGradient(SW / 2, 300, 10, SW / 2, 300, 220);
        glow.addColorStop(0, shimmer(t).replace('hsl', 'hsla').replace(')', ', 0.55)')); glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = glow; g.fillRect(0, 0, SW, SH);
        can(g, SW / 2, 320 + Math.sin(t * 2) * 6, 7, shimmer(t));
        for (let i = 0; i < 14; i++) {                       // sparkles
          const a = i * 0.9 + t * 0.6, d = 130 + (i % 3) * 40, p = (t * 0.8 + i * 0.37) % 1;
          g.fillStyle = shimmer(t, i); g.globalAlpha = Math.sin(p * Math.PI);
          const x = SW / 2 + Math.cos(a) * d, y = 300 + Math.sin(a) * d * 0.6, r = 3 + p * 3;
          g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.6, y); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.6, y); g.closePath(); g.fill();
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(241,236,224,0.85)'; g.font = '900 46px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
        g.fillText('?', SW / 2 - 150, 230 + Math.sin(t * 3) * 8); g.fillText('?', SW / 2 + 160, 260 + Math.sin(t * 3 + 2) * 8);
      },
    },
    {
      text: 'Get ready for Chapter 2: the Eraser\'s Kingdom. New worlds and new paint, coming very soon!',
      final: true,
      draw(g, t) {
        paper(g);
        // a land far away, still being drawn: a gray castle on a cliff, snowy peaks, floating islands, a clock tower
        const draw = Math.min(1, t / 1.6), cut = (pts) => pts.slice(0, Math.max(2, Math.ceil(pts.length * draw)));
        pencil(g, cut([[0, 430], [120, 420], [240, 436], [330, 404], [380, 300], [420, 296], [440, 430], [960, 430]]), 0.6, 2, 91);
        pencil(g, cut([[440, 330], [500, 210], [540, 260], [590, 150], [660, 300], [690, 330]]), 0.45, 1.6, 92);
        pencil(g, cut([[700, 330], [700, 210], [760, 210], [760, 150], [790, 120], [820, 150], [820, 210], [880, 210], [880, 330]]), 0.55, 1.8, 93);
        g.strokeStyle = 'rgba(60,55,50,0.5)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(790, 175, 13 * draw, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(790, 175); g.lineTo(790 + Math.cos(t * 3) * 9, 175 + Math.sin(t * 3) * 9); g.stroke();
        for (const [x, y, w] of [[600, 80, 56], [900, 92, 44], [80, 120, 40]]) {
          const b = Math.sin(t * 1.4 + x) * 5;
          pencil(g, [[x - w, y + b], [x + w, y + b], [x + w * 0.5, y + 26 + b], [x - w * 0.4, y + 22 + b], [x - w, y + b]], 0.45 * draw, 1.5, x);
        }
        // the color nobody has seen, glowing in the castle window
        g.fillStyle = shimmer(t); g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4); g.fillRect(782, 240, 16, 22); g.globalAlpha = 1;
        hero(g, 402, 298, { t, face: 1, col: C.blue });
        // COMING SOON stamp
        const st = Math.max(0, Math.min(1, (t - 1.6) / 0.25));
        if (st > 0) {
          g.save(); g.translate(250, 170); g.rotate(-0.16); g.scale(2.2 - st * 1.2, 2.2 - st * 1.2); g.globalAlpha = st;
          g.strokeStyle = C.red; g.lineWidth = 5; rr(g, -150, -40, 300, 80, 10); g.stroke();
          g.lineWidth = 2; rr(g, -140, -31, 280, 62, 7); g.stroke();
          g.fillStyle = C.red; g.font = '900 44px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('COMING SOON', 0, 3);
          g.restore();
        }
      },
    },
  ];
  const SCENES = { intro: INTRO, ending: ENDING };

  // ---------------- playing it ----------------
  let el = null;
  function play(which = 'intro', onDone = () => { }) {
    if (el) return;
    const PANELS = SCENES[which] || INTRO;
    el = document.createElement('div');
    el.id = 'story';
    el.innerHTML = `<canvas aria-hidden="true"></canvas>
      <p class="st-caption" aria-live="polite"></p>
      <button class="st-skip" type="button">Skip ▸▸</button>
      <span class="st-next" aria-hidden="true">tap to continue ▸</span>
      <div class="st-dots" aria-hidden="true">${PANELS.map(() => '<i></i>').join('')}</div>`;
    document.body.appendChild(el);
    const cv = el.querySelector('canvas'), g = cv.getContext('2d');
    const capEl = el.querySelector('.st-caption'), nextEl = el.querySelector('.st-next');
    let idx = 0, start = performance.now(), fade = 1, raf = 0, done = false;
    const typed = () => Math.floor((performance.now() - start - 350) / 32);
    function show(i) {
      idx = i; start = performance.now(); fade = 0;
      el.querySelectorAll('.st-dots i').forEach((d, k) => d.classList.toggle('on', k <= i));
    }
    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      el.classList.add('st-out');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => { el.remove(); el = null; onDone(); }, 450);
    }
    function next() {
      const p = PANELS[idx];
      if (typed() < p.text.length) { start -= 100000; return; }     // finish typing first
      if (idx + 1 < PANELS.length) show(idx + 1); else finish();
    }
    function frame(now) {
      if (done) return;
      const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0);
      const t = (now - start) / 1000;
      PANELS[idx].draw(g, t);
      // panels arrive through the paper
      fade = Math.min(1, fade + 0.06);
      if (fade < 1) { g.fillStyle = `rgba(241,236,224,${1 - fade})`; g.fillRect(0, 0, SW, SH); }
      const text = PANELS[idx].text, n = Math.max(0, Math.min(text.length, typed()));
      if (capEl.textContent !== text.slice(0, n)) capEl.textContent = text.slice(0, n);
      nextEl.classList.toggle('on', n >= text.length);
      nextEl.textContent = PANELS[idx].final ? (document.body.classList.contains('touch') ? 'tap to play ▸' : 'click to play ▸') : (document.body.classList.contains('touch') ? 'tap to continue ▸' : 'click to continue ▸');
      raf = requestAnimationFrame(frame);
    }
    function onKey(e) {
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(); }
      else if (['Space', 'Enter', 'ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); next(); }
    }
    el.addEventListener('pointerup', (e) => { if (e.target.closest('.st-skip')) return; e.preventDefault(); next(); });
    el.querySelector('.st-skip').addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    ['pointerdown', 'touchstart', 'mousedown', 'touchend'].forEach((ty) => el.addEventListener(ty, (e) => e.stopPropagation()));
    document.addEventListener('keydown', onKey, true);
    show(0);
    raf = requestAnimationFrame(frame);
  }

  return { play, get playing() { return !!el; }, drawEraser: eraser };
})();
