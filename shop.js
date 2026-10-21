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
    { id: 'beanie', cat: 'hat', name: 'Beanie', price: { drops: 300 }, rarity: 'common' },
    { id: 'tophat', cat: 'hat', name: 'Top hat', price: { drops: 400 }, rarity: 'common' },
    { id: 'propeller', cat: 'hat', name: 'Propeller cap', price: { drops: 550 }, rarity: 'rare' },
    { id: 'viking', cat: 'hat', name: 'Viking helmet', price: { drops: 700 }, rarity: 'epic' },
    { id: 'halo', cat: 'hat', name: 'Halo', price: { drops: 900 }, rarity: 'legend' },
    // can't be bought: it's the reward for unlocking every achievement
    { id: 'trophy', cat: 'hat', name: 'Golden Trophy', price: { drops: 0 }, rarity: 'legend', exclusive: true, how: '🏅 Unlock every achievement' },
    // can't be bought either: rewards for a long play streak
    // the gift for signing in with Google
    { id: 'captainhat', cat: 'hat', name: "Captain's Hat", price: { drops: 0 }, rarity: 'legend', exclusive: true, how: '✨ Sign in with Google' },
    { id: 'laurel', cat: 'hat', name: 'Golden Laurel', price: { drops: 0 }, rarity: 'legend', exclusive: true, how: '🔥 Play 14 days in a row' },
    { id: 'sparkle', cat: 'trail', name: 'Sparkles', price: { drops: 400 }, rarity: 'rare' },
    { id: 'notes', cat: 'trail', name: 'Music notes', price: { drops: 600 }, rarity: 'rare' },
    { id: 'flames', cat: 'trail', name: 'Flames', price: { drops: 700 }, rarity: 'epic' },
    { id: 'rainbow', cat: 'trail', name: 'Rainbow', price: { drops: 800 }, rarity: 'legend' },
    { id: 'bubbles', cat: 'trail', name: 'Bubbles', price: { drops: 350 }, rarity: 'common' },
    { id: 'lovetrail', cat: 'trail', name: 'Hearts', price: { drops: 450 }, rarity: 'rare' },
    { id: 'drips', cat: 'trail', name: 'Paint drips', price: { drops: 500 }, rarity: 'rare' },
    { id: 'comet', cat: 'trail', name: 'Comet', price: { drops: 750 }, rarity: 'epic' },
    { id: 'streakblaze', cat: 'trail', name: 'Streak Blaze', price: { drops: 0 }, rarity: 'legend', exclusive: true, how: '🔥 Play 7 days in a row' },
    { id: 'candy', cat: 'skin', name: 'Bubblegum', price: { drops: 500 }, rarity: 'rare', body: '#ff6fae' },
    { id: 'ghost', cat: 'skin', name: 'Ghost', price: { drops: 900 }, rarity: 'epic', body: 'rgba(40,40,60,0.42)' },
    { id: 'chrome', cat: 'skin', name: 'Chrome', price: { drops: 1200 }, rarity: 'epic', body: '#8c95a1', shine: true },
    { id: 'gold', cat: 'skin', name: 'Solid gold', price: { drops: 1500 }, rarity: 'legend', body: '#d4a017', shine: true },
    { id: 'mint', cat: 'skin', name: 'Mint', price: { drops: 400 }, rarity: 'common', body: '#22b893' },
    { id: 'sunset', cat: 'skin', name: 'Sunset', price: { drops: 600 }, rarity: 'rare', body: '#ff7a3d' },
    { id: 'galaxy', cat: 'skin', name: 'Galaxy', price: { drops: 1000 }, rarity: 'epic', body: '#3b2a8f' },
    { id: 'ice', cat: 'skin', name: 'Ice crystal', price: { drops: 1300 }, rarity: 'legend', body: '#7cc9ee', shine: true },
    { id: 'livingpaint', cat: 'skin', name: 'Living Paint', price: { drops: 0 }, rarity: 'legend', body: '#2f7bff', cycle: true, exclusive: true, how: '🔥 Play 30 days in a row' },
    { id: 'stars', cat: 'splat', name: 'Star splats', price: { drops: 300 }, rarity: 'common' },
    { id: 'hearts', cat: 'splat', name: 'Heart splats', price: { drops: 300 }, rarity: 'common' },
    { id: 'pixel', cat: 'splat', name: 'Pixel splats', price: { drops: 500 }, rarity: 'rare' },
    { id: 'paws', cat: 'splat', name: 'Paw prints', price: { drops: 300 }, rarity: 'common' },
    { id: 'flowers', cat: 'splat', name: 'Flower splats', price: { drops: 400 }, rarity: 'rare' },
    { id: 'smiley', cat: 'splat', name: 'Smiley splats', price: { drops: 450 }, rarity: 'rare' },
    { id: 'checker', cat: 'flag', name: 'Racing flag', price: { drops: 200 }, rarity: 'common' },
    { id: 'pirate', cat: 'flag', name: 'Pirate flag', price: { drops: 500 }, rarity: 'rare' },
    { id: 'heartflag', cat: 'flag', name: 'Heart flag', price: { drops: 300 }, rarity: 'common' },
    { id: 'starflag', cat: 'flag', name: 'Starry flag', price: { drops: 700 }, rarity: 'epic' },
    { id: 'confetti', cat: 'pop', name: 'Confetti pop', price: { drops: 300 }, rarity: 'common' },
    { id: 'popbubbles', cat: 'pop', name: 'Bubble pop', price: { drops: 350 }, rarity: 'common' },
    { id: 'fireworks', cat: 'pop', name: 'Fireworks', price: { drops: 650 }, rarity: 'epic' },
    { id: 'supernova', cat: 'pop', name: 'Paint Supernova', price: { drops: 0 }, rarity: 'legend', exclusive: true, how: '🔥 Play 100 days in a row' },
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
    } else if (id === 'trophy') {
      // a little golden cup with handles, sparkling now and then
      const g = ctx.createLinearGradient(-9, -22, 9, 0); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.45, '#ffc93c'); g.addColorStop(1, '#c98a00');
      ctx.fillStyle = g;
      rr(ctx, -7, -2, 14, 3.5, 1.2); ctx.fill(); ctx.stroke();                         // base
      ctx.beginPath(); ctx.moveTo(-2.5, -2); ctx.lineTo(-2, -8); ctx.lineTo(2, -8); ctx.lineTo(2.5, -2); ctx.closePath(); ctx.fill(); ctx.stroke();   // stem
      ctx.beginPath(); ctx.moveTo(-9, -21); ctx.lineTo(9, -21); ctx.quadraticCurveTo(9, -8, 0, -8); ctx.quadraticCurveTo(-9, -8, -9, -21); ctx.closePath(); ctx.fill(); ctx.stroke();   // cup
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-9.5, -16, 3.6, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(9.5, -16, 3.6, Math.PI * 1.5, Math.PI * 0.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-6, -19, 2, 7);
      if (((t * 0.8) % 1) < 0.25) { ctx.fillStyle = '#fff'; star(ctx, 7, -22, 2.4, t); ctx.fill(); }
    } else if (id === 'captainhat') {
      // a pirate captain's tricorn: black felt, gold trim, a gold paint-drop badge and a red feather
      ctx.fillStyle = '#ff3b4e';
      ctx.beginPath(); ctx.ellipse(-face * 7, -13, 2.6, 8, -face * 0.7 + Math.sin(t * 3) * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#26262b';
      ctx.beginPath(); ctx.moveTo(-15, 1); ctx.quadraticCurveTo(-13, -7, -8, -10); ctx.quadraticCurveTo(0, -17, 8, -10);
      ctx.quadraticCurveTo(13, -7, 15, 1); ctx.quadraticCurveTo(0, -4, -15, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffc93c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-12.5, -1.2); ctx.quadraticCurveTo(0, -6.5, 12.5, -1.2); ctx.stroke();
      ctx.fillStyle = '#ffc93c'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -12.5); ctx.quadraticCurveTo(3, -8.5, 2.6, -7); ctx.arc(0, -7, 2.6, 0, Math.PI); ctx.quadraticCurveTo(-3, -8.5, 0, -12.5); ctx.fill(); ctx.stroke();
      if (((t * 0.7) % 1) < 0.2) { ctx.fillStyle = '#fff'; star(ctx, 10, -10, 2.2, t); ctx.fill(); }
    } else if (id === 'laurel') {
      // a golden victory wreath: two branches of leaves curling around the head, a red ribbon at the back
      const g = ctx.createLinearGradient(-12, -10, 12, 4); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#c98a00');
      ctx.lineWidth = 1.2;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const a = Math.PI * (0.98 - k * 0.11), x = side * Math.cos(a) * 11.5 * -1, y = 2 - Math.sin(a) * 7.5;
          ctx.save(); ctx.translate(x, y); ctx.rotate(side * (0.9 - k * 0.32));
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -2.6, 1.9, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.fillStyle = '#ff3b4e'; ctx.beginPath(); ctx.moveTo(-face * 9, 3); ctx.lineTo(-face * 14, 9); ctx.lineTo(-face * 11, 4); ctx.lineTo(-face * 13, 10); ctx.lineTo(-face * 8, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (((t * 0.6) % 1) < 0.2) { ctx.fillStyle = '#fff'; star(ctx, 9, -6, 2.2, t); ctx.fill(); }
    } else if (id === 'beanie') {
      ctx.fillStyle = '#1fc160';
      ctx.beginPath(); ctx.ellipse(0, 0, 11.5, 11, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#14994b'; rr(ctx, -12.5, -3, 25, 6, 2.5); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      for (let x = -9; x <= 9; x += 3.6) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x, 2); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.sin(t * 3) * 0.8, -12, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (id === 'tophat') {
      ctx.fillStyle = '#3d3d48'; ctx.strokeStyle = '#0b0b0d';
      ctx.beginPath(); ctx.ellipse(0, 1, 14, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      rr(ctx, -8.5, -20, 17, 21, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff3b4e'; ctx.fillRect(-8.5, -6, 17, 3.5);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-6, -18, 2.2, 10);
    } else if (id === 'propeller') {
      const cols = ['#2f7bff', '#ffc93c', '#ff3b4e', '#1fc160'];
      for (let k = 0; k < 4; k++) { ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(0, 1); ctx.ellipse(0, 1, 11.5, 9, 0, Math.PI + k * Math.PI / 4, Math.PI + (k + 1) * Math.PI / 4); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, 1, 11.5, 9, 0, Math.PI, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -13); ctx.stroke();
      const spin = Math.cos(t * 22) * 10;
      ctx.fillStyle = '#ff3b4e'; ctx.beginPath(); ctx.ellipse(0, -14, Math.max(1, Math.abs(spin)), 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(0, -14, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'viking') {
      ctx.fillStyle = '#f3ead2';
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sx * 9, -2); ctx.quadraticCurveTo(sx * 19, -3, sx * 17, -17); ctx.quadraticCurveTo(sx * 14, -8, sx * 7, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      const g = ctx.createLinearGradient(-10, -10, 10, 2); g.addColorStop(0, '#d9dde3'); g.addColorStop(1, '#8d939d');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 1, 11.5, 10.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9a6b34'; rr(ctx, -12, -2.5, 24, 4.5, 1.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; for (const x of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(x, -0.3, 1.1, 0, Math.PI * 2); ctx.fill(); }
    } else if (id === 'halo') {
      const y = -9 + Math.sin(t * 3) * 1.5;
      ctx.strokeStyle = 'rgba(255,214,90,0.35)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0, y, 10, 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(0, y, 10, 3, 0, 0, Math.PI * 2); ctx.stroke();
      if (((t * 0.6) % 1) < 0.2) { ctx.fillStyle = '#fff'; star(ctx, 9, y - 2, 2.2, t); ctx.fill(); }
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
    const every = { sparkle: 0.05, notes: 0.22, flames: 0.03, rainbow: 0.016, bubbles: 0.09, lovetrail: 0.1, drips: 0.07, comet: 0.012, streakblaze: 0.022 }[id];
    while (tr.acc > every) {
      tr.acc -= every;
      const p = { x: x + (Math.random() - 0.5) * 4 * s, y: y + (Math.random() - 0.5) * 10 * s, life: 1, rot: Math.random() * 6, c: PAINTS[Math.floor(Math.random() * 5)] };
      if (id === 'flames' || id === 'streakblaze') p.vy = (-20 - Math.random() * 30) * s;
      if (id === 'notes') { p.vy = -16 * s; p.ch = Math.random() < 0.5 ? '♪' : '♫'; }
      if (id === 'rainbow') { p.x = x; p.y = y; }
      if (id === 'bubbles') p.vy = (-10 - Math.random() * 14) * s;
      if (id === 'drips') p.vy = (20 + Math.random() * 20) * s;
      if (id === 'comet') { p.x = x + (Math.random() - 0.5) * 2 * s; p.y = y + (Math.random() - 0.5) * 3 * s; }
      tr.parts.push(p);
    }
    for (const p of tr.parts) {
      p.x -= scroll * dt;
      p.life -= dt * (id === 'rainbow' ? 1.6 : id === 'notes' ? 0.6 : id === 'bubbles' ? 0.9 : id === 'comet' ? 2 : 1.4);
      if (id === 'bubbles') p.x += Math.sin(p.rot * 2) * 6 * s * dt;
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
      if (id === 'streakblaze') {                         // flames in every paint color, white-hot at the core
        const r = (7 * p.life + 1) * s;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.c); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (id === 'notes') { ctx.fillStyle = p.c; ctx.font = `700 ${11 * s}px Fredoka, ui-rounded, sans-serif`; ctx.fillText(p.ch, p.x, p.y); }
      if (id === 'bubbles') {
        const r = (2 + (1 - p.life) * 3) * s;
        ctx.fillStyle = 'rgba(160,215,255,0.25)'; ctx.strokeStyle = 'rgba(70,140,220,0.8)'; ctx.lineWidth = Math.max(0.8, s);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.25, 0, Math.PI * 2); ctx.fill();
      }
      if (id === 'lovetrail') { ctx.fillStyle = ['#ff3b4e', '#ff6fae'][Math.floor(p.rot * 10) % 2]; heart(ctx, p.x, p.y - (1 - p.life) * 8 * s, (1.5 + p.life * 2.5) * s); ctx.fill(); }
      if (id === 'drips') {
        const r = (1 + p.life * 1.8) * s;
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(p.x, p.y - r * 2.2); ctx.quadraticCurveTo(p.x + r, p.y - r * 0.6, p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI); ctx.quadraticCurveTo(p.x - r, p.y - r * 0.6, p.x, p.y - r * 2.2); ctx.fill();
      }
      if (id === 'comet') {
        const r = (1 + p.life * 4) * s;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#ffe27a'); g.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (hash(Math.round(p.rot * 50), 3) > 0.93) { ctx.fillStyle = '#fff'; star(ctx, p.x, p.y - 4 * s, 2 * s, p.rot); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- splats ----------------
  function drawSplat(ctx, id, x, y, r, col, seed) {
    ctx.fillStyle = col;
    if (id === 'stars') { star(ctx, x, y, r * 1.3, seed); ctx.fill(); for (let k = 0; k < 3; k++) { star(ctx, x + Math.cos(k * 2 + seed) * r * 1.9, y + Math.sin(k * 2 + seed) * r * 0.9, r * 0.35, k); ctx.fill(); } return; }
    if (id === 'hearts') { heart(ctx, x, y, r); ctx.fill(); heart(ctx, x + r * 1.7, y - r * 0.4, r * 0.4); ctx.fill(); heart(ctx, x - r * 1.6, y - r * 0.2, r * 0.32); ctx.fill(); return; }
    if (id === 'flowers') {
      const flower = (fx, fy, fr) => {
        for (let k = 0; k < 5; k++) { const a = seed + k * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * fr * 0.62, fy + Math.sin(a) * fr * 0.62, fr * 0.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.save(); ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.arc(fx, fy, fr * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      };
      flower(x, y, r * 1.1); flower(x + r * 1.9, y - r * 0.5, r * 0.5);
      return;
    }
    if (id === 'paws') {
      const paw = (px, py, pr, rot) => {
        ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(0, pr * 0.3, pr * 0.62, pr * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        for (const [tx, ty] of [[-0.62, -0.32], [-0.22, -0.68], [0.22, -0.68], [0.62, -0.32]]) { ctx.beginPath(); ctx.ellipse(tx * pr, ty * pr, pr * 0.2, pr * 0.26, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      };
      paw(x, y, r * 1.2, (seed % 1) - 0.5); paw(x + r * 2, y - r * 0.8, r * 0.7, (seed % 1) - 0.2);
      return;
    }
    if (id === 'smiley') {
      ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.arc(x + r * 0.4, y - r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); ctx.restore();
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 2.1 + seed) * r * 1.8, y + Math.sin(k * 2.1 + seed) * r * 0.8, r * 0.16, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
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
    } else if (id === 'heartflag') {
      ctx.fillStyle = '#ff6fae'; ctx.fillRect(fx - 2, fy - 6 * s, w + 4, h + 12 * s);
      ctx.fillStyle = '#fff'; heart(ctx, fx + w / 2, fy + h / 2 + wave * 2.5 * s, 5.2 * s * (1 + Math.max(0, Math.sin(t * 5)) * 0.12)); ctx.fill();
    } else if (id === 'starflag') {
      ctx.fillStyle = '#26285e'; ctx.fillRect(fx - 2, fy - 6 * s, w + 4, h + 12 * s);
      ctx.fillStyle = '#ffd23f'; star(ctx, fx + w / 2, fy + h / 2 + wave * 2.5 * s, 6.5 * s, Math.sin(t) * 0.1); ctx.fill();
      for (let k = 0; k < 4; k++) {
        const tw = Math.sin(t * 4 + k * 1.7);
        if (tw > 0) { ctx.fillStyle = `rgba(255,255,255,${tw})`; star(ctx, fx + [4, 21, 6, 22][k] * s, fy + [4, 3, 14, 15][k] * s + wave * 2 * s, 1.5 * s); ctx.fill(); }
      }
    } else {
      PAINTS.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(fx - 2, fy - 4 * s + i * 5 * s, w + 4, 5 * s); });
    }
    ctx.restore();
  }

  // ---------------- pop effects (when you fall) ----------------
  function burst(list, id, x, y, s = 1) {
    const n = { confetti: 36, fireworks: 48, popbubbles: 18, supernova: 30 }[id] || 22;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 120) * s;
      const p = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * s, life: 1, rot: Math.random() * 6, c: id === 'confetti' ? PAINTS[i % 5] : INK, w: (id === 'confetti' ? 5 + Math.random() * 4 : 4 + Math.random() * 4) * s };
      if (id === 'fireworks') {            // two rings of colored sparks
        const ring = i % 2 ? 150 : 95, b = (i / n) * Math.PI * 2;
        Object.assign(p, { vx: Math.cos(b) * ring * s, vy: Math.sin(b) * ring * s - 40 * s, c: PAINTS[Math.floor(i / 2) % 5], w: 3.2 * s, g: 70 });
      }
      if (id === 'supernova') {            // a ring of paint drops in every color, flung out fast
        const ang = (i / 30) * Math.PI * 2, sp = (130 + (i % 3) * 60) * s;
        Object.assign(p, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40 * s, c: PAINTS[i % 5], w: (5 + (i % 3) * 2) * s, g: 160 });
      }
      if (id === 'popbubbles') Object.assign(p, { vx: (Math.random() - 0.5) * 90 * s, vy: (-30 - Math.random() * 60) * s, w: (5 + Math.random() * 7) * s, g: -20 });
      list.push(p);
    }
  }
  function stepBurst(list, dt, s = 1) {
    for (const p of list) { p.vy += (p.g ?? 260) * s * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.life -= dt * 0.8; p.rot += dt * 8; }
    return list.filter((p) => p.life > 0);
  }
  function drawBurst(ctx, list, id) {
    for (const p of list) {
      ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c;
      if (id === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); ctx.restore(); }
      else if (id === 'fireworks') { star(ctx, p.x, p.y, p.w * (0.6 + p.life * 0.6), p.rot); ctx.fill(); }
      else if (id === 'supernova') drawDrop(ctx, p.x, p.y, p.w * (0.5 + p.life * 0.5), p.c);
      else if (id === 'popbubbles') {
        ctx.fillStyle = 'rgba(160,215,255,0.25)'; ctx.strokeStyle = 'rgba(70,140,220,0.85)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(p.x - p.w * 0.17, p.y - p.w * 0.17, p.w * 0.12, 0, Math.PI * 2); ctx.fill();
      }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- a character wearing a look ----------------
  // ctx is already translated to the character's feet. look = { hat, skin }.
  let shineCanvas = null;
  // a color between the five paints, flowing over time (the Living Paint skin)
  function flowingPaint(t) {
    const k = ((t * 0.35) % 1) * 5, i = Math.floor(k), f = k - i;
    const a = parseInt(PAINTS[i % 5].slice(1), 16), b = parseInt(PAINTS[(i + 1) % 5].slice(1), 16);
    const mix = (sh) => Math.round(((a >> sh) & 255) * (1 - f) + ((b >> sh) & 255) * f);
    return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
  }
  function drawHero(ctx, ch, o, look) {
    const skin = look.skin ? byId[look.skin] : null;
    const opts = { ...o, body: skin ? (skin.cycle ? flowingPaint(o.t || 0) : skin.body) : undefined };
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
