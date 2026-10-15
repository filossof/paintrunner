'use strict';

// ============================================================
//  Splash: "Tap to start".
//  Browsers only allow sound after the player has tapped, clicked or pressed a key, so the game opens
//  on this screen and the tap that leaves it also starts the music. Where the browser already
//  allows sound (e.g. after itch.io's "Run game"), the splash steps aside by itself.
// ============================================================

(() => {
  const el = document.getElementById('splash');
  if (!el) return;
  const COLORS = ['#2f7bff', '#ff3b4e', '#1fc160', '#ffc93c', '#9b5de5'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = document.body.classList.contains('touch');
  el.querySelector('.sp-label').textContent = touch ? 'Tap to start' : 'Click or press any key';

  // Tools and links straight to a level skip it.
  if (/[#&](level=|nosplash)/.test(location.hash)) { el.remove(); return; }

  let done = false, raf = 0;

  // ---- the little scene: your character hopping and throwing paint ----
  const cv = el.querySelector('.sp-scene'), ctx = cv.getContext('2d');
  const blobs = [], splats = [];
  let nextThrow = 0.5, colorIdx = 0, last = performance.now();
  function frame(now) {
    if (done) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000, dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const w = r.width, h = r.height, s = h / 78;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const floorY = h * 0.86, heroX = w * 0.26;
    // floor: an ink strip with a hand-drawn top edge
    ctx.fillStyle = '#1c1c1f';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, floorY + Math.sin(x * 0.09) * 1.2);
    ctx.lineTo(w, h); ctx.fill();
    // splats stay on the floor and fade slowly
    for (const sp of splats) {
      sp.life -= dt * 0.25;
      ctx.globalAlpha = Math.max(0, Math.min(1, sp.life));
      SHOP.drawSplat(ctx, null, sp.x, floorY, 7 * s, sp.col, sp.seed);
    }
    ctx.globalAlpha = 1;
    while (splats.length && splats[0].life <= 0) splats.shift();
    // blobs in flight
    if (!reduce && (nextThrow -= dt) <= 0) {
      nextThrow = 0.9;
      const col = COLORS[colorIdx++ % COLORS.length];
      blobs.push({ x: heroX + 12 * s, y: floorY - 30 * s, vx: (40 + Math.random() * 40) * s, vy: -80 * s, col });
    }
    for (const b of blobs) { b.vy += 220 * s * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    for (let i = blobs.length - 1; i >= 0; i--) {
      const b = blobs[i];
      if (b.y >= floorY) { splats.push({ x: b.x, col: b.col, seed: Math.random() * 6, life: 3 }); blobs.splice(i, 1); continue; }
      ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, 4.2 * s, 0, Math.PI * 2); ctx.fill();
    }
    // the hero (your character, wearing what you've equipped), hopping
    const g = window.paintRunner && window.paintRunner.game;
    const ch = (typeof CHARACTERS !== 'undefined' && g && CHARACTERS.find((c) => c.id === g.character)) || (typeof CHARACTERS !== 'undefined' && CHARACTERS[0]);
    const eq = (g && g.wallet && g.wallet.equipped) || {};
    const hop = reduce ? 0 : Math.abs(Math.sin(t * 3.2)) * 10 * s;
    if (ch) {
      ctx.save(); ctx.translate(heroX, floorY - hop);
      SHOP.drawHero(ctx, ch, { s: s * 1.15, col: COLORS[(colorIdx + 4) % COLORS.length], t, run: t * 8, moving: 1, air: hop > 2, face: 1, squash: 1 }, { hat: eq.hat, skin: eq.skin });
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // ---- leaving: a burst of paint from where you tapped, then the menu ----
  function leave(x, y, instant) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    if (instant || reduce) { el.remove(); return; }
    const burst = document.createElement('div');
    burst.className = 'sp-burst';
    // rings of all five colors spreading from the tap: the first (outermost) covers the screen
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 2 / 20 * 1.05;
    COLORS.forEach((c, i) => {
      const d = document.createElement('i');
      d.style.cssText = `left:${x}px;top:${y}px;background:${c};animation-delay:${i * 65}ms;--s:${(reach * (1 - i * 0.17)).toFixed(1)}`;
      burst.appendChild(d);
    });
    el.appendChild(burst);
    setTimeout(() => el.classList.add('sp-out'), 520);
    setTimeout(() => el.remove(), 1100);
  }
  function start(e) {
    if (done) return;
    // this tap/key is "used up" by the splash: it must not also click something in the game
    e.preventDefault(); e.stopImmediatePropagation();
    Sound.init();                        // the gesture that lets the music play
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const x = p && p.clientX !== undefined ? p.clientX : innerWidth / 2, y = p && p.clientY !== undefined ? p.clientY : innerHeight / 2;
    leave(x, y);
  }
  // Browsers count a mouse press as "the player interacted" when the button goes down, but a touch
  // only when the finger lifts - so the splash leaves on mouse-down, or on touch-end.
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') start(e); });
  el.addEventListener('touchend', start, { passive: false });
  el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') start(e); });
  window.addEventListener('keydown', (e) => { if (!done && !e.metaKey && !e.ctrlKey && !e.altKey) start(e); }, true);

  // Where the browser already allows sound, no tap is needed: step aside at once.
  const allowed = Sound.tryAutoplay ? Sound.tryAutoplay() : Promise.resolve(false);
  Promise.race([allowed, new Promise((r) => setTimeout(() => r(false), 900))])   // a blocked resume() never answers
    .then((ok) => { if (ok && Sound.soundAllowed && Sound.soundAllowed()) leave(0, 0, true); });
})();
