'use strict';

// ============================================================
//  Reward chests: five looks and five ways to open, for the level-complete screen.
//
//    const ch = Chest.make({ look: 'ink', anim: 'burst', total: 150, x, y, counter: { x, y } });
//    Chest.open(ch);  each frame: Chest.step(ch, dt); Chest.draw(ctx, ch)
//    ch.shown = the Paint Drops counted so far (they count up as drops land); ch.done when all landed
// ============================================================

const Chest = (() => {
  const INK = '#1c1c1f';
  const PAINTS = ['#2f7bff', '#ff3b4e', '#1fc160', '#ffc93c', '#9b5de5'];
  const LOOKS = {
    royal: 'Royal treasure', painter: "Painter's chest", inkchest: 'Ink chest', iron: "Adventurer's chest", mimic: 'Mimic',
    pirate: 'Classic pirate', ink: 'Ink & paint', can: 'Paint can', crystal: 'Crystal', gold: 'Golden',
  };
  const ANIMS = {
    burst: 'Shake & burst', geyser: 'Paint geyser', spring: 'Spring lid', magnet: 'Magnet pull', jackpot: 'Jackpot',
  };

  const rnd = (a, b) => a + Math.random() * (b - a);
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // a paint drop (the currency), pointing up
  function drop(g, x, y, r, col) {
    g.fillStyle = col; g.strokeStyle = 'rgba(28,28,31,0.55)'; g.lineWidth = Math.max(1, r * 0.18);
    g.beginPath(); g.moveTo(x, y - r * 1.7);
    g.bezierCurveTo(x + r * 0.5, y - r, x + r, y - r * 0.35, x + r, y + r * 0.15);
    g.arc(x, y + r * 0.15, r, 0, Math.PI); g.bezierCurveTo(x - r, y - r * 0.35, x - r * 0.5, y - r, x, y - r * 1.7);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.2, r * 0.22, r * 0.4, -0.4, 0, Math.PI * 2); g.fill();
  }
  function sparkle(g, x, y, r, a = 1) {
    g.save(); g.globalAlpha *= a; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.25, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.25, y); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y + r * 0.25); g.lineTo(x + r, y); g.lineTo(x, y - r * 0.25); g.closePath(); g.fill();
    g.restore();
  }

  const goldGrad = (g, x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#b37400'); gr.addColorStop(0.45, '#ffe58a'); gr.addColorStop(1, '#b37400'); return gr; };
  const rivet = (g, x, y, r = 2.4) => { g.fillStyle = '#fff3c0'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(28,28,31,0.6)'; g.lineWidth = 1; g.stroke(); };
  const splat = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, q = r * (k % 2 ? 0.62 : 1); g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); g.beginPath(); g.arc(x + r * 1.5, y - r * 0.4, r * 0.25, 0, Math.PI * 2); g.fill(); };
  // the mimic's eyes, looking around and blinking (on its lid)
  function eyes(g, t, open) {
    const look = Math.sin(t * 1.3) * 3, blink = (t * 0.45) % 3 < 0.12 && !open;
    for (const ex of [-20, 20]) {
      g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.ellipse(ex, -30, 11, blink ? 1.5 : 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      if (!blink) { g.fillStyle = INK; g.beginPath(); g.arc(ex + look, -28, 5.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + look - 2, -30, 1.8, 0, Math.PI * 2); g.fill(); }
    }
  }

  // ---------------- the looks ----------------
  // Each draws the body (x -60..60, y -10..55) and the lid (x -60..60, y -48..-10, hinged at y -10).
  // t: time in seconds (for shimmer), glow: light from inside 0..1
  const BODY = {
    royal(g, t) {
      const wood = g.createLinearGradient(0, -10, 0, 55); wood.addColorStop(0, '#9c3f1c'); wood.addColorStop(1, '#5a210d');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4; rr(g, -60, -10, 120, 66, 6); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
      for (const x of [-30, 0, 30]) { g.beginPath(); g.moveTo(x, -8); g.lineTo(x, 54); g.stroke(); }
      g.strokeStyle = goldGrad(g, -60, 0, 60, 0); g.lineWidth = 5; rr(g, -55, -6, 110, 57, 4); g.stroke();
      g.fillStyle = goldGrad(g, -60, 0, 60, 0); g.strokeStyle = INK; g.lineWidth = 2;
      for (const [x, y, sx, sy] of [[-60, 56, 1, -1], [60, 56, -1, -1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + sx * 20, y); g.lineTo(x, y + sy * 20); g.closePath(); g.fill(); g.stroke(); rivet(g, x + sx * 6, y + sy * 6); }
      // the big lock with a keyhole
      g.fillStyle = goldGrad(g, -14, 0, 14, 0); rr(g, -14, -6, 28, 30, 6); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(0, 6, 4, 0, Math.PI * 2); g.fill(); g.fillRect(-1.6, 6, 3.2, 10);
      if ((t * 0.6) % 1 < 0.2) sparkle(g, 10, -2, 6, 1 - ((t * 0.6) % 1) / 0.2);
    },
    painter(g, t) {
      const wood = g.createLinearGradient(0, -10, 0, 55); wood.addColorStop(0, '#e8bd84'); wood.addColorStop(1, '#b9824a');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4; rr(g, -60, -10, 120, 66, 7); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(80,45,15,0.35)'; g.lineWidth = 2;
      for (const y of [12, 34]) { g.beginPath(); g.moveTo(-57, y); g.lineTo(57, y); g.stroke(); }
      splat(g, -36, 22, 7, '#2f7bff'); splat(g, 30, 38, 6, '#ff3b4e'); splat(g, -10, 44, 4, '#1fc160'); splat(g, 42, 8, 4, '#ffc93c');
      // paint running down from the seam
      PAINTS.forEach((c, i) => { const x = -48 + i * 24, len = 10 + ((i * 7) % 4) * 6 + Math.sin(t * 1.4 + i) * 2; g.fillStyle = c; g.beginPath(); g.moveTo(x - 5, -10); g.lineTo(x + 5, -10); g.lineTo(x + 2.5, -10 + len); g.arc(x, -10 + len, 2.5, 0, Math.PI); g.closePath(); g.fill(); });
      g.fillStyle = '#c98a00'; g.strokeStyle = INK; g.lineWidth = 2; rr(g, -9, -8, 18, 18, 4); g.fill(); g.stroke();
    },
    inkchest(g, t) {
      g.fillStyle = INK; g.strokeStyle = '#fbf8f0'; g.lineWidth = 3; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(61, -11); g.lineTo(59, 56); g.lineTo(-61, 55); g.closePath(); g.fill();
      g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 3;
      for (let k = -60; k < 70; k += 9) { g.beginPath(); g.moveTo(k, 56); g.lineTo(k + 30, -10); g.stroke(); }
      g.restore();
      g.strokeStyle = '#fbf8f0'; g.lineWidth = 3; g.beginPath(); g.moveTo(-58, -8); g.lineTo(59, -9); g.lineTo(57, 53); g.lineTo(-59, 52); g.closePath(); g.stroke();
      g.fillStyle = goldGrad(g, -60, 0, 60, 0); g.strokeStyle = '#fbf8f0'; g.lineWidth = 2;
      for (const x of [-44, 36]) { g.fillRect(x, -10, 8, 66); }
      rr(g, -11, -6, 22, 24, 5); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(0, 4, 3.2, 0, Math.PI * 2); g.fill(); g.fillRect(-1.3, 4, 2.6, 8);
      splat(g, -26, 36, 5, '#ff3b4e'); splat(g, 22, 40, 4, '#2f7bff'); splat(g, 50, 24, 3, '#ffc93c');
    },
    iron(g, t) {
      const wood = g.createLinearGradient(0, -10, 0, 55); wood.addColorStop(0, '#6d4a2a'); wood.addColorStop(1, '#3f2814');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4; rr(g, -60, -10, 120, 66, 5); g.fill(); g.stroke();
      const iron = g.createLinearGradient(0, -10, 0, 55); iron.addColorStop(0, '#9aa0aa'); iron.addColorStop(1, '#565c66');
      g.fillStyle = iron; g.strokeStyle = INK; g.lineWidth = 2;
      for (const x of [-48, 38]) { g.fillStyle = iron; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(x, -10, 10, 66); g.strokeRect(x, -10, 10, 66); }
      for (const y of [-10, 46]) { g.fillStyle = iron; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(-60, y, 120, 9); g.strokeRect(-60, y, 120, 9); for (let x = -52; x <= 52; x += 13) rivet(g, x, y + 4.5, 1.8); }
      for (const sx of [-1, 1]) { g.strokeStyle = '#6b717b'; g.lineWidth = 4; g.beginPath(); g.arc(sx * 62, 22, 7, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx > 0 ? Math.PI / 2 : Math.PI * 1.5); g.stroke(); }
      // padlock
      g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath(); g.arc(0, 0, 7, Math.PI, 0); g.stroke();
      g.fillStyle = iron; g.lineWidth = 2; rr(g, -11, 0, 22, 18, 3); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(0, 8, 2.6, 0, Math.PI * 2); g.fill();
    },
    mimic(g, t, inside, open) {
      const wood = g.createLinearGradient(0, -10, 0, 55); wood.addColorStop(0, '#d99a52'); wood.addColorStop(1, '#a8682a');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4; rr(g, -60, -10, 120, 66, 12); g.fill(); g.stroke();
      g.fillStyle = goldGrad(g, -60, 0, 60, 0); g.strokeStyle = INK; g.lineWidth = 2;
      for (const x of [-46, 38]) { g.fillRect(x, -10, 8, 66); g.strokeRect(x, -10, 8, 66); }
      g.fillStyle = 'rgba(255,90,110,0.45)'; for (const x of [-28, 28]) { g.beginPath(); g.ellipse(x, 18, 8, 5, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath();
      if (open) { g.arc(0, 18, 14, 0.1, Math.PI - 0.1); } else { g.arc(0, 14, 9, 0.2, Math.PI - 0.2); }
      g.stroke();
    },
    pirate(g, t) {
      const wood = g.createLinearGradient(0, -10, 0, 55); wood.addColorStop(0, '#c07a3a'); wood.addColorStop(1, '#7d4a1d');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4; rr(g, -60, -10, 120, 65, 8); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(28,28,31,0.3)'; g.lineWidth = 2;
      for (const y of [12, 34]) { g.beginPath(); g.moveTo(-57, y); g.lineTo(57, y); g.stroke(); }
      const gold = g.createLinearGradient(-60, 0, 60, 0); gold.addColorStop(0, '#c98a00'); gold.addColorStop(0.5, '#ffe27a'); gold.addColorStop(1, '#c98a00');
      g.fillStyle = gold; g.strokeStyle = INK; g.lineWidth = 2.5;
      for (const x of [-46, 36]) { g.fillRect(x, -10, 10, 65); g.strokeRect(x, -10, 10, 65); }
    },
    ink(g, t) {
      // paper-white, inked by hand, paint running down the front
      g.fillStyle = '#fbf8f0'; g.strokeStyle = INK; g.lineWidth = 4.5; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(61, -11); g.lineTo(59, 56); g.lineTo(-61, 55); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(28,28,31,0.35)'; g.lineWidth = 1.4;
      for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(-52 + k * 13, 50); g.lineTo(-44 + k * 13, 34); g.stroke(); }   // hatching
      PAINTS.forEach((c, i) => {
        const x = -44 + i * 22, len = 14 + ((i * 37) % 5) * 5 + Math.sin(t * 1.5 + i) * 2;
        g.fillStyle = c; g.beginPath(); g.moveTo(x - 6, -10); g.lineTo(x + 6, -10); g.lineTo(x + 3, -10 + len);
        g.arc(x, -10 + len, 3, 0, Math.PI); g.closePath(); g.fill();
      });
    },
    can(g, t) {
      // a giant paint bucket
      const m = g.createLinearGradient(-58, 0, 58, 0); m.addColorStop(0, '#9aa0aa'); m.addColorStop(0.4, '#f1f2f5'); m.addColorStop(1, '#7d838d');
      g.fillStyle = m; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-58, -10); g.lineTo(58, -10); g.lineTo(50, 55); g.quadraticCurveTo(0, 62, -50, 55); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(28,28,31,0.3)'; g.lineWidth = 2.5;
      for (const y of [6, 34]) { const k = (y + 10) / 65 * 8; g.beginPath(); g.moveTo(-58 + k, y); g.lineTo(58 - k, y); g.stroke(); }
      // a paint label, and a drip
      g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2; rr(g, -30, 12, 60, 18, 4); g.fill(); g.stroke();
      PAINTS.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(-20 + i * 10, 21, 3.5, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(0, -4, 62, Math.PI * 1.08, Math.PI * 1.92); g.stroke();   // the handle
    },
    crystal(g, t, inside) {
      // glass: what's inside shows through
      inside(g);
      g.fillStyle = 'rgba(150,215,255,0.28)'; g.strokeStyle = '#2f7bff'; g.lineWidth = 3.5; rr(g, -60, -10, 120, 65, 10); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-48, 0); g.lineTo(-30, 0); g.moveTo(-50, 8); g.lineTo(-44, 40); g.stroke();
      const sx = ((t * 0.5) % 1.6 - 0.3) * 160 - 80;               // a glint sweeping across
      g.save(); rr(g, -60, -10, 120, 65, 10); g.clip();
      const sh = g.createLinearGradient(sx - 20, 0, sx + 20, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sh; g.fillRect(-60, -10, 120, 65); g.restore();
    },
    gold(g, t) {
      const gold = g.createLinearGradient(-60, -10, 60, 55); gold.addColorStop(0, '#fff3a0'); gold.addColorStop(0.45, '#ffc93c'); gold.addColorStop(1, '#b37400');
      g.fillStyle = gold; g.strokeStyle = INK; g.lineWidth = 4; rr(g, -60, -10, 120, 65, 8); g.fill(); g.stroke();
      [['#ff3b4e', -34], ['#2f7bff', 0], ['#1fc160', 34]].forEach(([c, x]) => {
        g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 9, 22); g.lineTo(x, 32); g.lineTo(x - 9, 22); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(x - 3, 17); g.lineTo(x, 14); g.lineTo(x + 2, 18); g.fill();
      });
      if ((t * 0.7) % 1 < 0.3) sparkle(g, 44, 40, 7, 1 - ((t * 0.7) % 1) / 0.3);
    },
  };
  const LID = {
    royal(g) {
      const wood = g.createLinearGradient(0, -64, 0, -10); wood.addColorStop(0, '#b44c22'); wood.addColorStop(1, '#7a2e12');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(-60, -28); g.bezierCurveTo(-55, -70, 55, -70, 60, -28); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = goldGrad(g, -60, 0, 60, 0); g.lineWidth = 5;
      g.beginPath(); g.moveTo(-55, -13); g.lineTo(-55, -28); g.bezierCurveTo(-50, -62, 50, -62, 55, -28); g.lineTo(55, -13); g.stroke();
      g.fillStyle = goldGrad(g, -10, 0, 10, 0); g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-9, -10); g.lineTo(-9, -58); g.lineTo(9, -58); g.lineTo(9, -10); g.closePath(); g.fill(); g.stroke();
      for (const y of [-20, -36, -50]) rivet(g, 0, y);
      g.fillStyle = '#ff3b4e'; g.beginPath(); g.moveTo(0, -46); g.lineTo(5, -40); g.lineTo(0, -34); g.lineTo(-5, -40); g.closePath(); g.fill(); g.stroke();
    },
    painter(g) {
      const wood = g.createLinearGradient(0, -60, 0, -10); wood.addColorStop(0, '#f1cb94'); wood.addColorStop(1, '#c99459');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(-60, -26); g.quadraticCurveTo(0, -62, 60, -26); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      splat(g, -30, -28, 6, '#9b5de5'); splat(g, 26, -34, 5, '#1fc160'); splat(g, 4, -22, 3.5, '#ff3b4e');
      // a paintbrush resting on top
      g.save(); g.translate(8, -48); g.rotate(-0.25);
      g.fillStyle = '#b07a43'; g.strokeStyle = INK; g.lineWidth = 2; rr(g, -34, -3, 44, 6, 3); g.fill(); g.stroke();
      g.fillStyle = '#c9ccd2'; g.fillRect(10, -4, 8, 8); g.strokeRect(10, -4, 8, 8);
      g.fillStyle = '#2f7bff'; g.beginPath(); g.moveTo(18, -5); g.quadraticCurveTo(32, -6, 34, 0); g.quadraticCurveTo(32, 6, 18, 5); g.closePath(); g.fill(); g.stroke();
      g.restore();
    },
    inkchest(g) {
      g.fillStyle = INK; g.strokeStyle = '#fbf8f0'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-61, -9); g.lineTo(-60, -27); g.quadraticCurveTo(0, -60, 61, -28); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = goldGrad(g, -60, 0, 60, 0);
      for (const x of [-44, 36]) { g.beginPath(); g.moveTo(x, -10); g.lineTo(x, -34 + Math.abs(x) * 0.18); g.lineTo(x + 8, -35 + Math.abs(x) * 0.18); g.lineTo(x + 8, -10); g.closePath(); g.fill(); }
      splat(g, 12, -34, 5, '#1fc160'); splat(g, -22, -24, 3.5, '#9b5de5');
    },
    iron(g) {
      const wood = g.createLinearGradient(0, -60, 0, -10); wood.addColorStop(0, '#7d5631'); wood.addColorStop(1, '#4c311a');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(-60, -26); g.quadraticCurveTo(0, -62, 60, -26); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      const iron = g.createLinearGradient(0, -60, 0, -10); iron.addColorStop(0, '#a8aeb8'); iron.addColorStop(1, '#5e646e');
      g.fillStyle = iron; g.lineWidth = 2;
      for (const x of [-48, 38]) { g.beginPath(); g.moveTo(x, -10); g.lineTo(x, -34 + Math.abs(x) * 0.12); g.lineTo(x + 10, -36 + Math.abs(x) * 0.12); g.lineTo(x + 10, -10); g.closePath(); g.fill(); g.stroke(); }
      g.fillStyle = iron; g.fillRect(-60, -18, 120, 8); g.strokeRect(-60, -18, 120, 8);
      for (let x = -52; x <= 52; x += 13) rivet(g, x, -14, 1.8);
    },
    mimic(g, t, open) {
      if (open) { g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 1.5; for (let x = -48; x < 48; x += 16) { g.beginPath(); g.moveTo(x, -10); g.lineTo(x + 8, 0); g.lineTo(x + 16, -10); g.closePath(); g.fill(); g.stroke(); } }
      const wood = g.createLinearGradient(0, -62, 0, -10); wood.addColorStop(0, '#e6aa62'); wood.addColorStop(1, '#bd7a35');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(-60, -28); g.quadraticCurveTo(0, -66, 60, -28); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      eyes(g, t, open);
    },
    pirate(g) {
      const wood = g.createLinearGradient(0, -48, 0, -10); wood.addColorStop(0, '#d08a48'); wood.addColorStop(1, '#a0632b');
      g.fillStyle = wood; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(-60, -26); g.quadraticCurveTo(0, -62, 60, -26); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      const gold = g.createLinearGradient(-60, 0, 60, 0); gold.addColorStop(0, '#c98a00'); gold.addColorStop(0.5, '#ffe27a'); gold.addColorStop(1, '#c98a00');
      g.fillStyle = gold; g.lineWidth = 2.5;
      for (const x of [-46, 36]) { g.beginPath(); g.moveTo(x, -10); g.lineTo(x, -34 + Math.abs(x) * 0.02); g.lineTo(x + 10, -36 + Math.abs(x) * 0.02); g.lineTo(x + 10, -10); g.closePath(); g.fill(); g.stroke(); }
      rr(g, -9, -18, 18, 18, 4); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(0, -10, 3, 0, Math.PI * 2); g.fill();
    },
    ink(g) {
      g.fillStyle = '#fbf8f0'; g.strokeStyle = INK; g.lineWidth = 4.5; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-62, -9); g.lineTo(-61, -27); g.quadraticCurveTo(0, -58, 62, -28); g.lineTo(61, -10); g.closePath(); g.fill(); g.stroke();
      [[-30, -32, '#ff3b4e'], [18, -38, '#2f7bff'], [40, -24, '#ffc93c']].forEach(([x, y, c]) => {
        g.fillStyle = c; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x + 8, y + 4, 2, 0, Math.PI * 2); g.arc(x - 7, y - 3, 1.6, 0, Math.PI * 2); g.fill();
      });
    },
    can(g) {
      const m = g.createLinearGradient(-62, 0, 62, 0); m.addColorStop(0, '#9aa0aa'); m.addColorStop(0.4, '#ffffff'); m.addColorStop(1, '#7d838d');
      g.fillStyle = m; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.ellipse(0, -12, 63, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, -16, 55, 9, 0, Math.PI, 0); g.stroke();
    },
    crystal(g) {
      g.fillStyle = 'rgba(150,215,255,0.35)'; g.strokeStyle = '#2f7bff'; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(-52, -38); g.lineTo(52, -38); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-42, -32); g.lineTo(-10, -32); g.stroke();
    },
    gold(g) {
      const gold = g.createLinearGradient(-60, -48, 60, -10); gold.addColorStop(0, '#fff3a0'); gold.addColorStop(0.5, '#ffc93c'); gold.addColorStop(1, '#c98a00');
      g.fillStyle = gold; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-60, -10); g.lineTo(-60, -26); g.quadraticCurveTo(0, -64, 60, -26); g.lineTo(60, -10); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#9b5de5'; g.lineWidth = 2; g.beginPath(); g.arc(0, -34, 8, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(-3, -37, 2.5, 0, Math.PI * 2); g.fill();
    },
  };

  // ---------------- the chest and its drops ----------------
  function make({ look = 'pirate', anim = 'burst', total = 100, x, y, counter, scale = 1.5 }) {
    return { look, anim, total, x, y, counter, s: scale, t: 0, opened: false, ot: 0, drops: [], coins: [], landed: 0, n: 0, shown: 0, done: total <= 0, lidY: 0, lidA: 0, open: 0, flash: 0 };
  }
  function addDrop(ch, d) {
    ch.drops.push(Object.assign({ x: ch.x, y: ch.y - 20 * ch.s, vx: 0, vy: 0, g: 0.32, home: 0, landed: false, col: Math.random() < 0.3 ? PAINTS[ch.drops.length % 5] : '#2f9bff', r: rnd(6, 9), spin: rnd(0, 6) }, d));
    ch.n++;
  }
  function open(ch) {
    if (ch.opened || ch.done) return;
    ch.opened = true; ch.ot = 0;
  }
  const count = (total) => Math.max(14, Math.min(40, 10 + Math.round(total / 6)));

  // starts the drops for each animation at its moment
  function launch(ch) {
    const n = count(ch.total);
    if (ch.anim === 'burst') {
      for (let i = 0; i < n; i++) addDrop(ch, { vx: rnd(-4.5, 4.5), vy: rnd(-15, -9), g: 0.36, homeAt: 1.15 + i * 0.035 });
    } else if (ch.anim === 'geyser') {
      for (let i = 0; i < n; i++) {
        const a = i * 0.6;
        addDrop(ch, { y: ch.y - 170, vx: Math.cos(a) * rnd(3, 6), vy: Math.sin(a) * 3 - 4, g: 0.25, col: PAINTS[i % 5], homeAt: 0.9 + i * 0.03, delay: i * 0.012 });
      }
    } else if (ch.anim === 'spring') {
      for (let i = 0; i < n; i++) addDrop(ch, { vx: rnd(-5, 5), vy: rnd(-11, -7), g: 0.45, delay: i * 0.055, bounce: true, homeAt: 1.0 + i * 0.055 });
    } else if (ch.anim === 'magnet') {
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; addDrop(ch, { vx: Math.cos(a) * 9, vy: Math.sin(a) * 6 - 2, g: 0, drag: 0.88, ring: a, homeAt: 1.1 }); }
    } else if (ch.anim === 'jackpot') {
      for (let i = 0; i < n; i++) addDrop(ch, { x: ch.x + rnd(-260, 260), y: ch.y - rnd(260, 420), vx: rnd(-0.5, 0.5), vy: rnd(1, 3), g: 0.25, delay: rnd(0, 0.5), homeAt: 1.3 + i * 0.03 });
      for (let i = 0; i < 26; i++) ch.coins.push({ x: ch.x + rnd(-300, 300), y: ch.y - rnd(260, 480), vy: rnd(2, 5), spin: rnd(0, 6), delay: rnd(0, 0.6) });
      ch.flash = 1;
    }
  }

  function step(ch, dt) {
    ch.t += dt;
    if (!ch.opened) return;
    const prev = ch.ot; ch.ot += dt;
    const ot = ch.ot, A = ch.anim;
    // the lid
    if (A === 'burst') { ch.shake = ot < 0.8 ? ot / 0.8 : 0; ch.glow = Math.min(1, ot / 0.8); if (ot >= 0.8) ch.open = Math.min(1, ch.open + dt * 8); }
    else if (A === 'geyser') { ch.open = Math.min(1, ot / 0.7); ch.glow = ch.open; ch.column = ot < 0.4 ? 0 : Math.min(1, (ot - 0.4) / 0.35) * (ot > 1.6 ? Math.max(0, 1 - (ot - 1.6) * 2) : 1); }
    else if (A === 'spring') { const s = Math.max(0, ot - 0.15); ch.lidY = ot < 0.15 ? 0 : -110 * Math.exp(-s * 2.6) * Math.abs(Math.cos(s * 9)) - (s > 0 ? 30 : 0); ch.lidA = Math.sin(s * 11) * 0.5 * Math.exp(-s * 2); ch.open = ot > 0.15 ? 1 : 0; ch.glow = ch.open; }
    else if (A === 'magnet') { ch.open = Math.min(1, ot / 0.25); ch.glow = ch.open; }
    else if (A === 'jackpot') { ch.open = Math.min(1, ot / 0.2); ch.glow = 1; ch.hop = Math.abs(Math.sin(ot * 9)) * 14 * Math.max(0, 1 - ot / 2.5); ch.flash = Math.max(0, ch.flash - dt * 2.5); }
    const launchAt = { burst: 0.8, geyser: 0.75, spring: 0.2, magnet: 0.25, jackpot: 0.05 }[A];
    if (prev < launchAt && ot >= launchAt) { launch(ch); ch.ot0 = ot; }
    // the drops
    const lt = ot - (ch.ot0 || 0);
    for (const d of ch.drops) {
      if (d.landed) continue;
      if (d.delay && lt < d.delay) continue;
      if (lt < d.homeAt) {
        if (A === 'magnet' && lt > 0.5) {                       // the ring hangs, turning slowly
          d.ring += dt * 1.2; const R = 150, tx = ch.x + Math.cos(d.ring) * R, ty = ch.y - 40 + Math.sin(d.ring) * R * 0.55;
          d.x += (tx - d.x) * 0.15; d.y += (ty - d.y) * 0.15; continue;
        }
        d.vy += d.g * 60 * dt * (A === 'burst' && d.vy > -1 && d.vy < 1.5 ? 0.25 : 1);   // a moment of hang at the top
        if (d.drag) { d.vx *= d.drag; d.vy *= d.drag; }
        d.x += d.vx * 60 * dt; d.y += d.vy * 60 * dt;
        if (d.bounce && d.y > ch.y + 55 * ch.s && d.vy > 0) { d.y = ch.y + 55 * ch.s; d.vy *= -0.55; d.vx *= 0.8; }
      } else {
        // fly into the counter (a swirl for the magnet)
        const tx = ch.counter.x, ty = ch.counter.y;
        d.home = Math.min(1, d.home + dt * (A === 'magnet' ? 1.6 : 2.4));
        const k = d.home * d.home;
        if (A === 'magnet') { const ang = Math.atan2(d.y - ty, d.x - tx) + dt * 6 * (1 - k); const dist = Math.hypot(d.x - tx, d.y - ty) * (1 - k * 0.5); d.x = tx + Math.cos(ang) * dist; d.y = ty + Math.sin(ang) * dist; }
        else { d.x += (tx - d.x) * (0.08 + k * 0.4); d.y += (ty - d.y) * (0.08 + k * 0.4); }
        if (Math.hypot(tx - d.x, ty - d.y) < 10) { d.landed = true; ch.landed++; ch.pop = 1; }
      }
    }
    for (const c of ch.coins) { if (c.delay && lt < c.delay) continue; c.vy += 0.3; c.y += c.vy; c.spin += dt * 10; }
    ch.pop = Math.max(0, (ch.pop || 0) - dt * 5);
    ch.shown = ch.n ? Math.round(ch.total * ch.landed / ch.n) : 0;
    if (ch.n && ch.landed >= ch.n) ch.done = true;
  }

  function draw(g, ch) {
    const t = ch.t, A = ch.anim;
    g.save();
    // glow and rays from inside
    const glow = ch.opened ? (ch.glow || 0) * (ch.done ? 0.5 : 1) : 0.25 + 0.1 * Math.sin(t * 4);
    if (glow > 0) {
      const R = 150 * ch.s, rg = g.createRadialGradient(ch.x, ch.y - 20 * ch.s, 6, ch.x, ch.y - 20 * ch.s, R);
      rg.addColorStop(0, `rgba(255,230,140,${0.75 * glow})`); rg.addColorStop(1, 'rgba(255,230,140,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(ch.x, ch.y - 20 * ch.s, R, 0, Math.PI * 2); g.fill();
      if (ch.opened && ch.open > 0.5) {
        g.strokeStyle = `rgba(255,240,170,${0.5 * glow})`; g.lineWidth = 5;
        for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.26 + Math.sin(t * 2 + k) * 0.03; g.beginPath(); g.moveTo(ch.x + Math.cos(a) * 30 * ch.s, ch.y - 15 * ch.s + Math.sin(a) * 30 * ch.s); g.lineTo(ch.x + Math.cos(a) * 140 * ch.s, ch.y - 15 * ch.s + Math.sin(a) * 140 * ch.s); g.stroke(); }
      }
    }
    // the geyser's column of paint
    if (A === 'geyser' && ch.column > 0) {
      const h = 175 * ch.column, y0 = ch.y - 15 * ch.s;
      PAINTS.forEach((c, i) => { g.fillStyle = c; const w = (30 - i * 5) * ch.s, x = ch.x - w / 2 + Math.sin(t * 9 + i) * 3; g.fillRect(x, y0 - h, w, h); });
      g.fillStyle = '#fff'; g.globalAlpha = 0.5; g.fillRect(ch.x - 4, y0 - h, 3, h); g.globalAlpha = 1;
      PAINTS.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(ch.x + Math.cos(t * 7 + i * 1.3) * 22 * ch.s, y0 - h + Math.sin(t * 7 + i) * 8, 9 * ch.s, 0, Math.PI * 2); g.fill(); });
    }
    // the chest: shaking before it bursts, hopping for a jackpot, wiggling while it waits
    const shake = A === 'burst' && ch.opened && ch.shake ? Math.sin(t * 70) * 5 * ch.shake : 0;
    const wait = !ch.opened ? Math.sin(t * 7) * (Math.sin(t * 0.8) > 0.6 ? 0.06 : 0) : 0;
    const hop = !ch.opened ? Math.abs(Math.sin(t * 3)) * 5 : (ch.hop || 0);
    g.translate(ch.x + shake, ch.y - hop); g.scale(ch.s, ch.s); g.rotate(wait + (shake ? Math.sin(t * 55) * 0.03 * ch.shake : 0));
    const inside = (gg) => { if (ch.look === 'crystal') for (let i = 0; i < 6; i++) drop(gg, -36 + i * 14, 30 + Math.sin(t * 3 + i) * 6, 6, PAINTS[i % 5]); };
    if (ch.open > 0.05) {                                    // a glowing pool of paint inside
      g.fillStyle = '#2f9bff'; g.beginPath(); g.ellipse(0, -10, 54, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-14, -12, 16, 3, 0, 0, Math.PI * 2); g.fill();
    }
    BODY[ch.look](g, t, inside, ch.open > 0.3);
    // light leaking from the seam before it bursts
    if (A === 'burst' && ch.opened && ch.open < 0.5) { g.strokeStyle = `rgba(255,236,160,${ch.glow})`; g.lineWidth = 4; g.beginPath(); g.moveTo(-58, -10); g.lineTo(58, -10); g.stroke(); }
    // the lid: swung open (squashed as it tips back), or flying on its spring
    g.save();
    if (A === 'spring' && ch.opened) { g.translate(0, ch.lidY); g.rotate(ch.lidA); }
    else if (ch.open > 0 && ch.look === 'mimic') { g.translate(-60, -10); g.rotate(-0.55 * ch.open); g.translate(60, 10 - 14 * ch.open); }
    else if (ch.open > 0) { g.translate(0, -10); g.scale(1, Math.cos(ch.open * 2.0)); g.translate(0, 10 - ch.open * 6); }
    LID[ch.look](g, t, ch.open > 0.3);
    g.restore();
    g.restore();
    // coins (jackpot) and the drops
    for (const c of ch.coins) {
      const s = Math.cos(c.spin);
      g.save(); g.translate(c.x, c.y); g.scale(Math.abs(s) * 0.9 + 0.1, 1);
      g.fillStyle = s > 0 ? '#ffc93c' : '#e0a400'; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    }
    for (const d of ch.drops) {
      if (d.landed || (d.delay && ch.ot - (ch.ot0 || 0) < d.delay)) continue;
      drop(g, d.x, d.y, d.r, d.col);
      if (A === 'burst' && d.home === 0 && Math.abs(d.vy) < 1.5) sparkle(g, d.x + 9, d.y - 10, 5, 0.9);
    }
    if (ch.flash > 0) { g.fillStyle = `rgba(255,248,220,${ch.flash * 0.8})`; g.fillRect(-2000, -2000, 6000, 6000); }
    g.restore();
  }

  return { LOOKS, ANIMS, make, open, step, draw, drop };
})();

if (typeof module !== 'undefined') module.exports = { Chest };
