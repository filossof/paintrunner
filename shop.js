'use strict';

// ============================================================
//  Store: cosmetic items bought with Paint Drops, and how each one
//  is drawn. Nothing here changes how the game plays.
//
//  Prices are { drops: n } so a second currency can be added later.
// ============================================================

const SHOP = (() => {
  const INK = '#1c1c1f';
  const PAINTS = ['#2f7bff', '#ff3b4e', '#1fc160', '#ffc93c', '#9b5de5'];

  const RARITY = { common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legendary' };
  const CATS = [['hat', '🎩 Hats'], ['trail', '✨ Trails'], ['skin', '🎨 Colors'], ['splat', '💥 Splats'], ['flag', '🏁 Flags'], ['pop', '🎉 Effects']];
  const ITEMS = [
    { id: 'cap', cat: 'hat', name: 'Baseball cap', price: { drops: 300 }, rarity: 'common' },
    { id: 'party', cat: 'hat', name: 'Party hat', price: { drops: 350 }, rarity: 'common' },
    { id: 'chef', cat: 'hat', name: 'Chef hat', price: { drops: 450 }, rarity: 'rare' },
    { id: 'phones', cat: 'hat', name: 'Headphones', price: { drops: 500 }, rarity: 'rare' },
    { id: 'wizard', cat: 'hat', name: 'Wizard hat', price: { drops: 650 }, rarity: 'epic' },
    { id: 'crown', cat: 'hat', name: 'Crown', price: { drops: 800 }, rarity: 'legend' },
    { id: 'sparkle', cat: 'trail', name: 'Sparkles', price: { drops: 400 }, rarity: 'rare' },
    { id: 'notes', cat: 'trail', name: 'Music notes', price: { drops: 600 }, rarity: 'rare' },
    { id: 'flames', cat: 'trail', name: 'Flames', price: { drops: 700 }, rarity: 'epic' },
    { id: 'rainbow', cat: 'trail', name: 'Rainbow', price: { drops: 800 }, rarity: 'legend' },
    { id: 'candy', cat: 'skin', name: 'Bubblegum', price: { drops: 500 }, rarity: 'rare', body: '#ff6fae' },
    { id: 'ghost', cat: 'skin', name: 'Ghost', price: { drops: 900 }, rarity: 'epic', body: 'rgba(40,40,60,0.42)' },
    { id: 'chrome', cat: 'skin', name: 'Chrome', price: { drops: 1200 }, rarity: 'epic', body: '#8c95a1', shine: true },
    { id: 'gold', cat: 'skin', name: 'Solid gold', price: { drops: 1500 }, rarity: 'legend', body: '#d4a017', shine: true },
    { id: 'stars', cat: 'splat', name: 'Star splats', price: { drops: 300 }, rarity: 'common' },
    { id: 'hearts', cat: 'splat', name: 'Heart splats', price: { drops: 300 }, rarity: 'common' },
    { id: 'pixel', cat: 'splat', name: 'Pixel splats', price: { drops: 500 }, rarity: 'rare' },
    { id: 'checker', cat: 'flag', name: 'Racing flag', price: { drops: 200 }, rarity: 'common' },
    { id: 'pirate', cat: 'flag', name: 'Pirate flag', price: { drops: 500 }, rarity: 'rare' },
    { id: 'confetti', cat: 'pop', name: 'Confetti pop', price: { drops: 300 }, rarity: 'common' },
  ];
  const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

  // Where a hat sits on each character: the top of the head (character units) and its width.
  const HEAD = {
    blob: { y: -40, w: 22 }, ninja: { y: -40, w: 20 }, brush: { y: -46, w: 12 }, artist: { y: -42, w: 16 },
    crayon: { y: -44, w: 11 }, drop: { y: -43, w: 11 }, roller: { y: -41, w: 24 }, pencil: { y: -45, w: 9 },
    sponge: { y: -38, w: 22 }, spray: { y: -43, w: 12 }, palette: { y: -40, w: 22 }, squid: { y: -45, w: 12 },
  };

  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(ctx, x, y, r, rot = 0) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5 - Math.PI / 2, q = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    ctx.closePath();
  }
  function heart(ctx, x, y, r) {
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.4);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); ctx.closePath();
  }

  // A blue paint drop: the currency icon.
  function drawDrop(ctx, x, y, r, col = '#2f9bff') {
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.beginPath(); ctx.moveTo(x, y - r * 1.5);
    ctx.bezierCurveTo(x + r * 0.4, y - r * 0.9, x + r, y - r * 0.3, x + r, y + r * 0.2);
    ctx.arc(x, y + r * 0.2, r, 0, Math.PI); ctx.bezierCurveTo(x - r, y - r * 0.3, x - r * 0.4, y - r * 0.9, x, y - r * 1.5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y, r * 0.18, r * 0.35, 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // ---------------- hats ----------------
  function drawHat(ctx, id, s, charId, face, t) {
    if (!id) return;
    const head = HEAD[charId] || HEAD.blob;
    const k = head.w / 22;
    ctx.save(); ctx.translate(0, head.y * s); ctx.scale(k * s, k * s);
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6 / k;
    if (id === 'cap') {
      ctx.fillStyle = '#ff3b4e';
      ctx.beginPath(); ctx.ellipse(0, 1, 11.5, 8, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(face * 11, 1, 7.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -7, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'party') {
      ctx.save(); ctx.rotate(-face * 0.12);
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(0, -19); ctx.lineTo(8, 2); ctx.closePath();
      ctx.fillStyle = '#ffc93c'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = '#9b5de5';
      for (let y = -16; y < 4; y += 6) { ctx.beginPath(); ctx.moveTo(-12, y + 4); ctx.lineTo(12, y - 2); ctx.lineTo(12, y + 1); ctx.lineTo(-12, y + 7); ctx.fill(); }
      ctx.restore(); ctx.stroke();
      ctx.fillStyle = '#ff3b4e'; ctx.beginPath(); ctx.arc(0, -20, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (id === 'chef') {
      ctx.fillStyle = '#fff';
      rr(ctx, -8, -6, 16, 8, 1.5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-5, -9, 5, 0, Math.PI * 2); ctx.arc(1, -12, 6, 0, Math.PI * 2); ctx.arc(6, -8, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-5, -9, 5, Math.PI * 0.85, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(1, -12, 6, Math.PI * 1.15, Math.PI * 1.95); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, -8, 4.5, Math.PI * 1.4, Math.PI * 2.25); ctx.stroke();
    } else if (id === 'phones') {
      ctx.lineWidth = 2.6; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(0, 8, 12.5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      for (const sx of [-1, 1]) { ctx.fillStyle = '#2f7bff'; rr(ctx, sx * 12.5 - 3.5, 4, 7, 10, 3); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke(); }
      if (Math.sin(t * 8) > 0.6) { ctx.fillStyle = INK; ctx.font = '700 9px Fredoka, ui-rounded, sans-serif'; ctx.fillText('♪', 13, -6); }
    } else if (id === 'wizard') {
      const sway = Math.sin(t * 2.5) * 2;
      ctx.fillStyle = '#5b3fc4';
      ctx.beginPath(); ctx.ellipse(0, 1, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-3, -14, sway - face * 6, -26); ctx.quadraticCurveTo(2, -12, 8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; star(ctx, -2, -8, 2.6); ctx.fill(); star(ctx, 3, -15, 1.8); ctx.fill();
    } else if (id === 'crown') {
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(-10, -9); ctx.lineTo(-5, -4); ctx.lineTo(0, -12); ctx.lineTo(5, -4); ctx.lineTo(10, -9); ctx.lineTo(9, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      const g = (x, y, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); };
      g(-5, -1, '#ff3b4e'); g(0, -2, '#2f7bff'); g(5, -1, '#1fc160');
      if (((t * 0.7) % 1) < 0.25) { ctx.fillStyle = '#fff'; star(ctx, 7, -9, 2.4, t); ctx.fill(); }
    }
    ctx.restore();
  }

  // ---------------- trails: particles left behind a moving point ----------------
  function makeTrail() { return { parts: [], acc: 0 }; }
  // x, y: where to emit (world units); scroll: how fast the world slides by (previews only)
  // emit = false lets the existing particles fade without adding new ones (e.g. standing still)
  function stepTrail(tr, id, x, y, dt, s = 1, scroll = 0, emit = true) {
    if (!id) { tr.parts.length = 0; return; }
    if (emit) tr.acc += dt; else tr.acc = 0;
    const every = { sparkle: 0.05, notes: 0.22, flames: 0.03, rainbow: 0.016 }[id];
    while (tr.acc > every) {
      tr.acc -= every;
      const p = { x: x + (Math.random() - 0.5) * 4 * s, y: y + (Math.random() - 0.5) * 10 * s, life: 1, rot: Math.random() * 6, c: PAINTS[Math.floor(Math.random() * 5)] };
      if (id === 'flames') p.vy = (-20 - Math.random() * 30) * s;
      if (id === 'notes') { p.vy = -16 * s; p.ch = Math.random() < 0.5 ? '♪' : '♫'; }
      if (id === 'rainbow') { p.x = x; p.y = y; }
      tr.parts.push(p);
    }
    for (const p of tr.parts) {
      p.x -= scroll * dt;
      p.life -= dt * (id === 'rainbow' ? 1.6 : id === 'notes' ? 0.6 : 1.4);
      if (p.vy) p.y += p.vy * dt;
      p.rot += dt * 3;
    }
    tr.parts = tr.parts.filter((p) => p.life > 0);
  }
  function drawTrail(ctx, tr, id, s, t) {
    if (!id) return;
    if (id === 'rainbow') {
      const cols = ['#ff3b4e', '#ff8c1a', '#ffc93c', '#1fc160', '#2f7bff', '#9b5de5'];
      ctx.lineCap = 'round';
      cols.forEach((c, k) => {
        ctx.strokeStyle = c; ctx.lineWidth = 2.2 * s; ctx.globalAlpha = 0.9;
        ctx.beginPath();
        tr.parts.forEach((p, i) => { const yy = p.y + (k - 2.5) * 2.1 * s + Math.sin(p.x * 0.06 + t * 4) * 2 * s; if (i === 0) ctx.moveTo(p.x, yy); else ctx.lineTo(p.x, yy); });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      return;
    }
    for (const p of tr.parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      if (id === 'sparkle') { ctx.fillStyle = p.c; star(ctx, p.x, p.y, (2 + p.life * 3) * s, p.rot); ctx.fill(); }
      if (id === 'flames') {
        const r = 6 * s * p.life + 1;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ff8c1a'); g.addColorStop(1, 'rgba(255,59,78,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (id === 'notes') { ctx.fillStyle = p.c; ctx.font = `700 ${11 * s}px Fredoka, ui-rounded, sans-serif`; ctx.fillText(p.ch, p.x, p.y); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- splats ----------------
  function drawSplat(ctx, id, x, y, r, col, seed) {
    ctx.fillStyle = col;
    if (id === 'stars') { star(ctx, x, y, r * 1.3, seed); ctx.fill(); for (let k = 0; k < 3; k++) { star(ctx, x + Math.cos(k * 2 + seed) * r * 1.9, y + Math.sin(k * 2 + seed) * r * 0.9, r * 0.35, k); ctx.fill(); } return; }
    if (id === 'hearts') { heart(ctx, x, y, r); ctx.fill(); heart(ctx, x + r * 1.7, y - r * 0.4, r * 0.4); ctx.fill(); heart(ctx, x - r * 1.6, y - r * 0.2, r * 0.32); ctx.fill(); return; }
    if (id === 'pixel') {
      const q = Math.max(2, r / 3);
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) if (hash(i + 9, j + Math.round(seed * 7)) > 0.35 + (Math.abs(i) + Math.abs(j)) * 0.12) ctx.fillRect(Math.round(x + i * q), Math.round(y + j * q * 0.7), q, q);
      return;
    }
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2, q = r * (0.7 + 0.5 * hash(k, Math.round(seed * 10))); ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.55); }
    ctx.fill();
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 2.1 + seed) * r * 1.6, y + Math.sin(k * 2.1 + seed) * r * 0.7, r * 0.18, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---------------- finish flags ----------------
  function drawFlag(ctx, id, x, base, s, t) {
    ctx.fillStyle = INK; ctx.fillRect(x, base - 52 * s, 3 * s, 52 * s);
    const wave = Math.sin(t * 6);
    const fx = x + 3 * s, fy = base - 52 * s, w = 26 * s, h = 18 * s;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx + w / 2, fy + wave * 3 * s, fx + w, fy + wave * 2 * s);
    ctx.lineTo(fx + w, fy + h + wave * 2 * s); ctx.quadraticCurveTo(fx + w / 2, fy + h + wave * 3 * s, fx, fy + h); ctx.closePath();
    ctx.clip();
    if (id === 'checker') {
      const q = 4.4 * s;
      for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) { ctx.fillStyle = (i + j) % 2 ? INK : '#fff'; ctx.fillRect(fx + i * q, fy - 4 * s + j * q + Math.sin(t * 6 + i) * 1.5 * s, q + 0.5, q + 0.5); }
    } else if (id === 'pirate') {
      ctx.fillStyle = INK; ctx.fillRect(fx - 2, fy - 6 * s, w + 4, h + 12 * s);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx + w / 2, fy + h / 2 - s, 4.2 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(fx + w / 2 - 1.6 * s, fy + h / 2 - 1.5 * s, s, 0, Math.PI * 2); ctx.arc(fx + w / 2 + 1.6 * s, fy + h / 2 - 1.5 * s, s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * s;
      ctx.beginPath(); ctx.moveTo(fx + w / 2 - 6 * s, fy + h / 2 + 4 * s); ctx.lineTo(fx + w / 2 + 6 * s, fy + h / 2 + 7 * s);
      ctx.moveTo(fx + w / 2 + 6 * s, fy + h / 2 + 4 * s); ctx.lineTo(fx + w / 2 - 6 * s, fy + h / 2 + 7 * s); ctx.stroke();
    } else {
      PAINTS.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(fx - 2, fy - 4 * s + i * 5 * s, w + 4, 5 * s); });
    }
    ctx.restore();
  }

  // ---------------- pop effects (when you fall) ----------------
  function burst(list, id, x, y, s = 1) {
    const n = id === 'confetti' ? 36 : 22;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 120) * s;
      list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * s, life: 1, rot: Math.random() * 6, c: id === 'confetti' ? PAINTS[i % 5] : INK, w: (id === 'confetti' ? 5 + Math.random() * 4 : 4 + Math.random() * 4) * s });
    }
  }
  function stepBurst(list, dt, s = 1) {
    for (const p of list) { p.vy += 260 * s * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.life -= dt * 0.8; p.rot += dt * 8; }
    return list.filter((p) => p.life > 0);
  }
  function drawBurst(ctx, list, id) {
    for (const p of list) {
      ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c;
      if (id === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- a character wearing a look ----------------
  // ctx is already translated to the character's feet. look = { hat, skin }.
  let shineCanvas = null;
  function drawHero(ctx, ch, o, look) {
    const skin = look.skin ? byId[look.skin] : null;
    const opts = { ...o, body: skin ? skin.body : undefined };
    if (skin && skin.shine && typeof document !== 'undefined') {
      // draw into a scratch canvas so the moving shine only lands on the character
      const m = ctx.getTransform();
      const scale = Math.hypot(m.a, m.b) * o.s;
      const size = Math.ceil(90 * scale);
      shineCanvas = shineCanvas || document.createElement('canvas');
      if (shineCanvas.width < size || shineCanvas.height < size) { shineCanvas.width = size; shineCanvas.height = size; }
      const sc = shineCanvas.getContext('2d');
      sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, shineCanvas.width, shineCanvas.height);
      sc.setTransform(scale / o.s, 0, 0, scale / o.s, size / 2, size * 0.8);
      ch.draw(sc, opts);
      sc.globalCompositeOperation = 'source-atop';
      sc.setTransform(1, 0, 0, 1, 0, 0);
      const sx = ((o.t * 0.6) % 1.6 - 0.3) * size;
      const g = sc.createLinearGradient(sx - size * 0.12, 0, sx + size * 0.12, size);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      sc.fillStyle = g; sc.fillRect(0, 0, size, size);
      sc.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.scale(o.s / scale, o.s / scale);
      ctx.drawImage(shineCanvas, 0, 0, size, size, -size / 2, -size * 0.8, size, size);
      ctx.restore();
    } else {
      ch.draw(ctx, opts);
    }
    drawHat(ctx, look.hat, o.s, ch.id, o.face, o.t);
  }

  return { ITEMS, CATS, RARITY, byId, HEAD, PAINTS, drawDrop, drawHat, makeTrail, stepTrail, drawTrail, drawSplat, drawFlag, burst, stepBurst, drawBurst, drawHero };
})();

if (typeof module !== 'undefined') module.exports = { SHOP };
