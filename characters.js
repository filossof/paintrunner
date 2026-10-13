'use strict';

// ============================================================
//  Characters: how the hero can look. Each one draws standing on
//  (0,0), about 40 units tall at s = 1, facing o.face.
//
//  o = { s, col, t, run (0..1 step phase), moving (0..1), air (bool),
//        face (1 | -1), squash, body (optional: store color for the ink parts) }
//
//  `share` is the part of all the game's stars (3 per level) needed to unlock the
//  character; `stars` turns that into a number, rounded to a multiple of 5, so the
//  thresholds keep making sense when levels are added. With 45 levels (135 stars):
//  ninja 5, paintbrush 15, roller 25, artist 40, pencil 50, crayon 60, sponge 75,
//  spray can 90, palette 105, squid 120, paint drop 135 (every star in the game).
// ============================================================

const CHARACTERS = (() => {
  const INK = '#1c1c1f';
  const PAINTS = ['#2f7bff', '#ff3b4e', '#1fc160', '#ffc93c', '#9b5de5'];

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // stars needed for a share of the whole game's stars, rounded to a multiple of 5
  const starsFor = (share) => Math.round((share * LEVELS.length * 3) / 5) * 5;
  const blink = (t) => ((t * 0.55) % 3.2) < 0.12;

  // two ink feet that swing while running and tuck while airborne
  function feet(ctx, s, o) {
    ctx.fillStyle = o.body || INK;
    const swing = o.air ? 0 : Math.sin(o.run * Math.PI * 2) * 4 * o.moving;
    const lift = o.air ? -3 : 0;
    for (const [dx, k] of [[-5, 1], [5, -1]]) {
      const step = o.moving && !o.air ? Math.max(0, -Math.sin(o.run * Math.PI * 2 * k)) * -2.5 : 0;
      ctx.beginPath(); ctx.ellipse((dx + swing * k) * s, (-2 + lift + step) * s, 4 * s, 2.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // a paint ribbon flowing behind a point
  function trail(ctx, s, o, x, y, len, width, col) {
    ctx.strokeStyle = col; ctx.lineWidth = width * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x * s, y * s);
    for (let i = 1; i <= 6; i++) {
      const k = i / 6;
      ctx.lineTo((x - o.face * len * k) * s, (y + k * (o.air ? -2 : 3) + Math.sin(o.t * 9 + i) * 1.3 * k) * s);
    }
    ctx.stroke();
  }

  return [
    {
      id: 'blob', name: 'Ink blob', share: 0, get stars() { return starsFor(this.share); },
      blurb: 'A soft ink blob with a paint scarf.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        trail(ctx, s, o, -o.face * 4, -24, 16, 4.5, o.col);
        ctx.fillStyle = o.body || INK; rr(ctx, -11 * s, -40 * s, 22 * s, 37 * s, 10 * s); ctx.fill();
        ctx.fillStyle = o.col; rr(ctx, -11.5 * s, -26 * s, 23 * s, 5 * s, 2.5 * s); ctx.fill();
        const ey = -33 * s, eh = blink(o.t) ? 1.2 * s : 7 * s;
        ctx.fillStyle = '#fff';
        rr(ctx, (-6.5 + o.face * 2.5) * s, ey, 4.5 * s, eh, 1.6 * s); ctx.fill();
        rr(ctx, (1.5 + o.face * 2.5) * s, ey, 4.5 * s, eh, 1.6 * s); ctx.fill();
        ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(o.face * 11 * s, -15 * s, 3.4 * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },
    },
    {
      id: 'ninja', name: 'Ink ninja', share: 0.05, get stars() { return starsFor(this.share); },
      blurb: 'Headband tails that stream behind every jump.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        ctx.rotate(o.face * 0.08 * o.moving);
        trail(ctx, s, o, -o.face * 9, -32, 18, 2.6, o.col);
        trail(ctx, s, { ...o, t: o.t + 0.4 }, -o.face * 9, -31, 13, 2.2, o.col);
        ctx.fillStyle = o.body || INK; rr(ctx, -10 * s, -40 * s, 20 * s, 37 * s, 8 * s); ctx.fill();
        ctx.fillStyle = o.col; ctx.fillRect(-10.5 * s, -35.5 * s, 21 * s, 7 * s);
        ctx.fillStyle = o.body || INK; ctx.beginPath(); ctx.arc(-o.face * 9.5 * s, -32 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
        const eh = blink(o.t) ? 0.6 * s : 2.4 * s;
        ctx.fillStyle = '#fff';
        for (const ex of [-5.5, 1.2]) { ctx.beginPath(); ctx.ellipse((ex + 2 + o.face * 2) * s, -32 * s, 2.6 * s, eh, o.face * 0.15, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.moveTo(-9 * s, -14 * s); ctx.lineTo(9 * s, -14 * s); ctx.stroke();
        ctx.restore();
      },
    },
    {
      id: 'brush', name: 'Paintbrush', share: 0.12, get stars() { return starsFor(this.share); },
      blurb: 'Bristle hair dipped in your paint.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        const wood = ctx.createLinearGradient(-7 * s, 0, 7 * s, 0);
        wood.addColorStop(0, '#a8692f'); wood.addColorStop(0.45, '#e2a35f'); wood.addColorStop(1, '#8f5523');
        ctx.fillStyle = wood; ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * s;
        rr(ctx, -7 * s, -27 * s, 14 * s, 25 * s, 6 * s); ctx.fill(); ctx.stroke();
        const metal = ctx.createLinearGradient(-9 * s, 0, 9 * s, 0);
        metal.addColorStop(0, '#9aa0aa'); metal.addColorStop(0.4, '#f1f2f5'); metal.addColorStop(1, '#878d97');
        ctx.fillStyle = metal; rr(ctx, -9 * s, -31 * s, 18 * s, 7 * s, 2 * s); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = s;
        ctx.beginPath(); ctx.moveTo(-8 * s, -28 * s); ctx.lineTo(8 * s, -28 * s); ctx.stroke();
        const sweep = -o.face * (o.moving * 4 + (o.air ? 3 : 0)) + Math.sin(o.t * 6) * 0.8;
        ctx.fillStyle = o.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * s;
        ctx.beginPath(); ctx.moveTo(-8.5 * s, -31 * s);
        ctx.quadraticCurveTo((-10 + sweep * 0.5) * s, -40 * s, sweep * s, -46 * s);
        ctx.quadraticCurveTo((10 + sweep * 0.5) * s, -40 * s, 8.5 * s, -31 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.9 * s;
        for (const k of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(k * s, -31.5 * s); ctx.quadraticCurveTo((k * 0.6 + sweep * 0.4) * s, -37 * s, (k * 0.3 + sweep * 0.8) * s, -41 * s); ctx.stroke(); }
        if (o.moving && !o.air) {
          const p = (o.t * 2.2) % 1;
          ctx.fillStyle = o.col; ctx.globalAlpha = 1 - p;
          ctx.beginPath(); ctx.arc((sweep - o.face * (6 + p * 14)) * s, (-44 + p * 10 + p * p * 16) * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        const ey = -21 * s, eh = blink(o.t) ? 1 * s : 6 * s;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * s;
        for (const ex of [-3.2, 3.2]) { ctx.beginPath(); ctx.ellipse((ex + o.face * 1.2) * s, ey + eh / 2, 2.6 * s, eh / 2 + 0.4 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        if (!blink(o.t)) { ctx.fillStyle = INK; for (const ex of [-3.2, 3.2]) { ctx.beginPath(); ctx.arc((ex + o.face * 2.2) * s, ey + 3.4 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill(); } }
        ctx.restore();
      },
    },
    {
      id: 'roller', name: 'Paint roller', share: 0.2, get stars() { return starsFor(this.share); },
      blurb: 'A fluffy roller soaked in your paint.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        ctx.fillStyle = o.body || INK; rr(ctx, -6 * s, -25 * s, 12 * s, 23 * s, 5 * s); ctx.fill();
        ctx.fillStyle = '#9aa0aa'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * s;
        rr(ctx, -2 * s, -30 * s, 4 * s, 7 * s, 1 * s); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1.8 * s;
        ctx.fillStyle = o.col; rr(ctx, -13 * s, -42 * s, 26 * s, 13 * s, 5.5 * s); ctx.fill(); ctx.stroke();
        ctx.save(); rr(ctx, -13 * s, -42 * s, 26 * s, 13 * s, 5.5 * s); ctx.clip();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1 * s;
        const roll = (o.run * 6) % 1;
        for (let k = -3; k <= 3; k++) { const x = (k + roll) * 4 * s; ctx.beginPath(); ctx.moveTo(x, -42 * s); ctx.lineTo(x + 1 * s, -29 * s); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * s;
        for (const ex of [-13, 13]) { ctx.fillStyle = '#e4e6ea'; ctx.beginPath(); ctx.ellipse(ex * s, -35.5 * s, 2 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        const ey = -38.5 * s, eh = blink(o.t) ? 1 * s : 5 * s;
        ctx.fillStyle = '#fff';
        rr(ctx, (-5 + o.face * 2) * s, ey, 3.6 * s, eh, 1.4 * s); ctx.fill();
        rr(ctx, (1.4 + o.face * 2) * s, ey, 3.6 * s, eh, 1.4 * s); ctx.fill();
        ctx.fillStyle = o.col; ctx.beginPath(); ctx.ellipse(-6 * s, (-27.5 + Math.sin(o.t * 3) * 0.8) * s, 1.3 * s, 2.2 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },
    },
    {
      id: 'artist', name: 'Little artist', share: 0.28, get stars() { return starsFor(this.share); },
      blurb: 'A beret in your color and a splattered apron.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        ctx.fillStyle = o.body || INK;
        ctx.beginPath(); ctx.moveTo(-9 * s, -4 * s); ctx.quadraticCurveTo(-10 * s, -22 * s, 0, -23 * s);
        ctx.quadraticCurveTo(10 * s, -22 * s, 9 * s, -4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fbfaf6';
        rr(ctx, -6 * s, -18 * s, 12 * s, 13 * s, 2.5 * s); ctx.fill();
        const other = PAINTS[(PAINTS.indexOf(o.col) + 2) % PAINTS.length] || PAINTS[2];
        for (const [dx, dy, r, c] of [[-2.5, -14, 1.6, o.col], [2.6, -10, 1.3, other], [-1, -8, 1, o.col]]) {
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = o.body || INK; ctx.beginPath(); ctx.arc(0, -30 * s, 9.5 * s, 0, Math.PI * 2); ctx.fill();
        const ey = -33 * s, eh = blink(o.t) ? 1 * s : 5.5 * s;
        ctx.fillStyle = '#fff';
        rr(ctx, (-5 + o.face * 2) * s, ey, 3.6 * s, eh, 1.4 * s); ctx.fill();
        rr(ctx, (1.4 + o.face * 2) * s, ey, 3.6 * s, eh, 1.4 * s); ctx.fill();
        ctx.save(); ctx.translate(-o.face * 1.5 * s, -38 * s); ctx.rotate(-o.face * 0.28 + Math.sin(o.t * 5) * 0.04 * o.moving);
        ctx.fillStyle = o.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.ellipse(0, 0, 10.5 * s, 4.2 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -4 * s); ctx.lineTo(0.8 * s, -6.5 * s); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.translate(o.face * 9 * s, -14 * s); ctx.rotate(o.face * (0.6 + Math.sin(o.run * Math.PI * 2) * 0.3 * o.moving));
        ctx.strokeStyle = '#b07a43'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -9 * s); ctx.stroke();
        ctx.fillStyle = o.col; ctx.beginPath(); ctx.ellipse(0, -11 * s, 1.6 * s, 2.8 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.restore();
      },
    },
    {
      id: 'pencil', name: 'Pencil', share: 0.37, get stars() { return starsFor(this.share); },
      blurb: 'A colored pencil, sharpened to your paint.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        ctx.rotate(-o.face * 0.05 * o.moving);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.7 * s; ctx.lineJoin = 'round';
        ctx.fillStyle = o.body || '#ffc93c'; rr(ctx, -8 * s, -33 * s, 16 * s, 30 * s, 2 * s); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(3 * s, -32 * s, 4 * s, 28 * s);
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-6 * s, -32 * s, 2.5 * s, 28 * s);
        ctx.fillStyle = '#e8c08a'; ctx.beginPath(); ctx.moveTo(-8 * s, -33 * s); ctx.lineTo(-2.6 * s, -41 * s);
        ctx.lineTo(2.6 * s, -41 * s); ctx.lineTo(8 * s, -33 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = o.col; ctx.beginPath(); ctx.moveTo(-2.6 * s, -41 * s); ctx.lineTo(0, -46 * s); ctx.lineTo(2.6 * s, -41 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c9ccd2'; ctx.fillRect(-8 * s, -8 * s, 16 * s, 4 * s); ctx.strokeRect(-8 * s, -8 * s, 16 * s, 4 * s);
        const ey = -25 * s, eh = blink(o.t) ? 1 * s : 6 * s;
        ctx.fillStyle = INK;
        rr(ctx, (-4.5 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        rr(ctx, (1.5 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        ctx.restore();
      },
    },
    {
      id: 'crayon', name: 'Crayon', share: 0.46, get stars() { return starsFor(this.share); },
      blurb: 'A chunky crayon in whatever color you hold.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        ctx.rotate(-o.face * 0.06 * o.moving);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * s; ctx.lineJoin = 'round';
        ctx.fillStyle = o.col; rr(ctx, -9 * s, -33 * s, 18 * s, 31 * s, 3 * s); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9 * s, -32 * s); ctx.lineTo(-4.5 * s, -42 * s);
        ctx.quadraticCurveTo(0, -45 * s, 4.5 * s, -42 * s); ctx.lineTo(9 * s, -32 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(-5 * s, -33 * s); ctx.lineTo(-2.5 * s, -40 * s); ctx.lineTo(-1 * s, -40 * s); ctx.lineTo(-2.5 * s, -33 * s); ctx.fill();
        ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-8.1 * s, -27 * s, 16.2 * s, 19 * s);
        ctx.strokeStyle = o.col; ctx.lineWidth = 1.5 * s;
        for (const y of [-25, -10]) {
          ctx.beginPath();
          for (let x = -8; x <= 8; x += 2) ctx.lineTo(x * s, (y + (x % 4 === 0 ? 1.2 : -1.2)) * s);
          ctx.stroke();
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * s; ctx.strokeRect(-8.1 * s, -27 * s, 16.2 * s, 19 * s);
        const ey = -21 * s, eh = blink(o.t) ? 1 * s : 6 * s;
        ctx.fillStyle = INK;
        rr(ctx, (-4.5 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        rr(ctx, (1.5 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        ctx.restore();
      },
    },
    {
      id: 'sponge', name: 'Sponge', share: 0.55, get stars() { return starsFor(this.share); },
      blurb: 'Soaked in paint and dripping everywhere.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        const sq = 1 + (o.moving ? Math.sin(o.run * Math.PI * 4) * 0.04 : 0);
        ctx.save(); ctx.scale(1 / (o.squash * sq), o.squash * sq);
        const shape = () => rr(ctx, -12 * s, -37 * s, 24 * s, 34 * s, 6 * s);
        ctx.fillStyle = o.body || '#ffe27a'; shape(); ctx.fill();
        ctx.save(); shape(); ctx.clip();
        ctx.fillStyle = o.col; ctx.beginPath(); ctx.moveTo(-14 * s, -14 * s);
        for (let x = -14; x <= 14; x += 3.5) ctx.lineTo(x * s, (-15 + Math.sin(x * 0.8 + o.t * 2.5) * 1.6) * s);
        ctx.lineTo(14 * s, 0); ctx.lineTo(-14 * s, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        for (const [hx, hy, r] of [[-7, -32, 2], [6, -33, 1.5], [8, -22, 2.2], [-8, -19, 1.6], [-2, -10, 2], [6, -8, 1.4], [-9, -7, 1.2]]) { ctx.beginPath(); ctx.ellipse(hx * s, hy * s, r * s, r * 0.8 * s, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * s; shape(); ctx.stroke();
        const ey = -28 * s, eh = blink(o.t) ? 1 * s : 6 * s;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * s;
        for (const ex of [-4, 4]) { ctx.beginPath(); ctx.ellipse((ex + o.face * 1.5) * s, ey + eh / 2, 2.8 * s, eh / 2 + 0.4 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        if (!blink(o.t)) { ctx.fillStyle = INK; for (const ex of [-4, 4]) { ctx.beginPath(); ctx.arc((ex + o.face * 2.5) * s, ey + 3.4 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill(); } }
        ctx.fillStyle = o.col;
        for (const [dx, ph] of [[-7, 0], [3, 1.7], [8, 3.1]]) { const len = (1.5 + ((o.t * 1.3 + ph) % 1) * 3) * s; ctx.beginPath(); ctx.ellipse(dx * s, -3 * s + len, 1.1 * s, len, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      },
    },
    {
      id: 'spray', name: 'Spray can', share: 0.65, get stars() { return starsFor(this.share); },
      blurb: 'Puffs a little cloud of paint as it runs.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.7 * s; ctx.lineJoin = 'round';
        const g = ctx.createLinearGradient(-9 * s, 0, 9 * s, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.35, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = o.col; rr(ctx, -9 * s, -33 * s, 18 * s, 30 * s, 3 * s); ctx.fill();
        ctx.fillStyle = g; rr(ctx, -9 * s, -33 * s, 18 * s, 30 * s, 3 * s); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fbfaf6'; rr(ctx, -7.8 * s, -26 * s, 15.6 * s, 11 * s, 1 * s); ctx.fill();
        ctx.fillStyle = o.body || '#d6d9de'; rr(ctx, -6.5 * s, -38 * s, 13 * s, 5.5 * s, 2 * s); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f4f4f4'; rr(ctx, -2.3 * s, -43 * s, 4.6 * s, 5 * s, 1 * s); ctx.fill(); ctx.stroke();
        const ey = -24 * s, eh = blink(o.t) ? 1 * s : 6 * s;
        ctx.fillStyle = INK;
        rr(ctx, (-4.5 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        rr(ctx, (1.5 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        if (o.moving || o.air) {
          const p = (o.t * 1.6) % 1;
          for (let k = 0; k < 5; k++) {
            const a = -Math.PI / 2 + (k - 2) * 0.25, d = (4 + p * 12) * s;
            ctx.globalAlpha = (1 - p) * 0.75; ctx.fillStyle = o.col;
            ctx.beginPath(); ctx.arc(Math.cos(a) * d - o.face * p * 6 * s, -43 * s + Math.sin(a) * d, (0.8 + (k % 2)) * s, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },
    },
    {
      id: 'palette', name: 'Palette', share: 0.76, get stars() { return starsFor(this.share); },
      blurb: 'A painter palette with a dab of every color.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        ctx.rotate(o.face * 0.05 * o.moving);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * s;
        ctx.fillStyle = o.body || '#d9a066';
        ctx.beginPath();
        ctx.moveTo(0, -40 * s);
        ctx.bezierCurveTo(10 * s, -40 * s, 14 * s, -30 * s, 12 * s, -18 * s);
        ctx.bezierCurveTo(10 * s, -6 * s, 4 * s, -2 * s, -3 * s, -3 * s);
        ctx.bezierCurveTo(-10 * s, -4 * s, -14 * s, -12 * s, -12 * s, -20 * s);
        ctx.bezierCurveTo(-11 * s, -24 * s, -6 * s, -22 * s, -6 * s, -26 * s);
        ctx.bezierCurveTo(-6 * s, -30 * s, -12 * s, -30 * s, -11 * s, -34 * s);
        ctx.bezierCurveTo(-9 * s, -39 * s, -5 * s, -40 * s, 0, -40 * s);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(4 * s, -35 * s, 4 * s, 1.5 * s, -0.3, 0, Math.PI * 2); ctx.fill();
        const others = PAINTS.filter((c) => c !== o.col);
        const dabs = [[o.col, 5, -31, 3.4], [others[0], -1, -35, 2.2], [others[1], 8, -24, 2.2], [others[2], 6, -12, 2], [others[3], -5, -9, 1.8]];
        for (const [c, x, y, r] of dabs) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill(); }
        const ey = -21 * s, eh = blink(o.t) ? 1 * s : 5.5 * s;
        ctx.fillStyle = INK;
        rr(ctx, (-3.5 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        rr(ctx, (2 + o.face * 1.5) * s, ey, 3 * s, eh, 1.3 * s); ctx.fill();
        ctx.restore();
      },
    },
    {
      id: 'squid', name: 'Ink squid', share: 0.88, get stars() { return starsFor(this.share); },
      blurb: 'Squirts ink and wiggles everywhere.',
      draw(ctx, o) {
        const s = o.s;
        ctx.save(); ctx.scale(1 / o.squash, o.squash);
        const body = o.body || INK;
        ctx.strokeStyle = body; ctx.lineCap = 'round'; ctx.lineWidth = 2.6 * s;
        for (let k = 0; k < 5; k++) {
          const x0 = (-8 + k * 4) * s, ph = o.t * (o.moving ? 12 : 4) + k * 1.3;
          const ex = x0 + Math.sin(ph + 1) * 2.5 * s - o.face * o.moving * 2 * s, ey2 = (o.air ? -6 : -1) * s;
          ctx.beginPath(); ctx.moveTo(x0, -15 * s);
          ctx.quadraticCurveTo(x0 + Math.sin(ph) * 3 * s, -8 * s, ex, ey2);
          ctx.stroke();
          ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(ex, ey2, 1.3 * s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(0, -46 * s);
        ctx.bezierCurveTo(7 * s, -40 * s, 11 * s, -30 * s, 11 * s, -22 * s);
        ctx.bezierCurveTo(11 * s, -15 * s, 6 * s, -13 * s, 0, -13 * s);
        ctx.bezierCurveTo(-6 * s, -13 * s, -11 * s, -15 * s, -11 * s, -22 * s);
        ctx.bezierCurveTo(-11 * s, -30 * s, -7 * s, -40 * s, 0, -46 * s); ctx.fill();
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 5 * s, -40 * s); ctx.lineTo(sx * 12 * s, -42 * s + Math.sin(o.t * 5) * s); ctx.lineTo(sx * 8 * s, -33 * s); ctx.fill(); }
        ctx.fillStyle = o.col;
        for (const [x, y, r] of [[-4, -36, 1.4], [3, -32, 1.8], [-2, -29, 1.1]]) { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill(); }
        const ey = -21 * s, er = blink(o.t) ? 0.6 : 3.4;
        ctx.fillStyle = '#fff';
        for (const ex of [-4.5, 4.5]) { ctx.beginPath(); ctx.ellipse((ex + o.face * 1.5) * s, ey, 3.2 * s, er * s, 0, 0, Math.PI * 2); ctx.fill(); }
        if (!blink(o.t)) { ctx.fillStyle = INK; for (const ex of [-4.5, 4.5]) { ctx.beginPath(); ctx.arc((ex + o.face * 2.8) * s, ey + 0.8 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill(); } }
        ctx.restore();
      },
    },
    {
      id: 'drop', name: 'Paint drop', share: 1, get stars() { return starsFor(this.share); },
      blurb: 'A jelly drop of ink with a paint-dipped tip.',
      draw(ctx, o) {
        const s = o.s;
        feet(ctx, s, o);
        const jig = 1 + Math.sin(o.t * 14) * 0.025 * (o.moving + (o.air ? 1 : 0));
        ctx.save(); ctx.scale(1 / (o.squash * jig), o.squash * jig);
        const tipX = -o.face * (o.moving * 3 + (o.air ? 2 : 0));
        const body = () => {
          ctx.beginPath(); ctx.moveTo(tipX * s, -44 * s);
          ctx.bezierCurveTo((tipX + 4) * s, -34 * s, 12 * s, -24 * s, 12 * s, -14 * s);
          ctx.bezierCurveTo(12 * s, -6 * s, 6 * s, -2.5 * s, 0, -2.5 * s);
          ctx.bezierCurveTo(-6 * s, -2.5 * s, -12 * s, -6 * s, -12 * s, -14 * s);
          ctx.bezierCurveTo(-12 * s, -24 * s, (tipX - 4) * s, -34 * s, tipX * s, -44 * s); ctx.closePath();
        };
        body(); ctx.fillStyle = o.body || INK; ctx.fill();
        ctx.save(); body(); ctx.clip();
        ctx.fillStyle = o.col; ctx.beginPath(); ctx.moveTo(-14 * s, -27 * s);
        for (let x = -14; x <= 14; x += 3.5) ctx.lineTo(x * s, (-28 + Math.sin(x * 0.9 + o.t * 3) * 1.6 + (Math.abs(x) < 3 ? 4 : 0)) * s);
        ctx.lineTo(14 * s, -50 * s); ctx.lineTo(-14 * s, -50 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse((tipX - 3) * s, -34 * s, 1.4 * s, 3.5 * s, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        const ey = -20 * s, er = blink(o.t) ? 0.6 : 3.4;
        ctx.fillStyle = '#fff';
        for (const ex of [-4.2, 4.2]) { ctx.beginPath(); ctx.ellipse((ex + o.face * 2) * s, ey, 3 * s, er * s, 0, 0, Math.PI * 2); ctx.fill(); }
        if (!blink(o.t)) { ctx.fillStyle = INK; for (const ex of [-4.2, 4.2]) { ctx.beginPath(); ctx.arc((ex + o.face * 3.2) * s, ey + 0.6 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill(); } }
        ctx.restore();
      },
    },
  ];
})();

if (typeof module !== 'undefined') module.exports = { CHARACTERS };
