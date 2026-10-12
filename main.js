'use strict';

// ============================================================
//  Browser side: input, rendering, menus.
//  Uses globals from levels.js, world.js and audio.js.
// ============================================================

(function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ALL_COLORS = [BLUE, RED, GREEN, YELLOW, PURPLE];
  const COLOR_HEX = { 1: '#2f7bff', 2: '#ff3b4e', 3: '#1fc160', 4: '#ffc93c', 5: '#9b5de5' };
  const COLOR_NAME = { 1: 'Blue', 2: 'Red', 3: 'Green', 4: 'Yellow', 5: 'Purple' };
  const WASH = '#ffffff';
  const paintHex = (c) => COLOR_HEX[c] || WASH;
  const PAPER = '#efece4', INK = '#1c1c1f', INK_LINE = '#2c2c31', METAL = '#8d929b';
  const sfx = Sound.sfx;

  // ---------- storage (best-effort) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('paintRunner.' + key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('paintRunner.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  // ---------- scaling ----------
  let scale = 1, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    scale = Math.min(window.innerWidth / W, window.innerHeight / H); // as big as fits, same shape
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.floor(W * scale * dpr);
    canvas.height = Math.floor(H * scale * dpr);
  }
  window.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize);
  document.addEventListener('webkitfullscreenchange', resize);
  resize();

  // Real full screen (hides the browser's bars). F toggles it.
  function toggleFullscreen() {
    const el = document.documentElement;
    const isFull = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (isFull) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { /* not supported */ }
  }

  // ---------- input ----------
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: W / 2, y: H / 2, down: false, right: false };

  const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
  const uiBusy = () => typeof UI !== 'undefined' && UI.modalOpen;
  window.addEventListener('keydown', (e) => {
    if (uiBusy()) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    Sound.init();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = mouse.right = false; });

  function toGame(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width * W;
    mouse.y = (e.clientY - rect.top) / rect.height * H;
  }
  canvas.addEventListener('mousemove', toGame);
  canvas.addEventListener('mousedown', (e) => {
    toGame(e); Sound.init();
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.right = true;
    e.preventDefault();
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (game.mode === 'play') cycleColor(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  const held = (...codes) => codes.some((c) => keys.has(c));
  const tapped = (...codes) => codes.some((c) => pressed.has(c));

  // ---------- game state ----------
  const game = {
    mode: 'title',        // title | play | complete | end
    levelIdx: 0,
    world: null,
    color: BLUE,
    unlocked: Math.min(store.get('unlocked', 0), LEVELS.length - 1),
    best: store.get('bestByName', {}),
    stars: store.get('starsByName', {}),
    best3: store.get('best3ByName', {}),        // fastest time with all 3 cans
    fewest: store.get('fewestByName', {}),      // fewest paint throws
    menuIdx: 0,
    shake: 0,
    tick: 0,
    lastResult: null,
    toast: null,
  };
  game.menuIdx = game.unlocked;

  let particles = [];
  let squash = 1;
  let scarf = [];
  let prevJumpHeld = false;

  function startLevel(i) {
    game.levelIdx = i;
    game.world = new World(LEVELS[i]);
    game.mode = 'play';
    game.color = LEVELS[i].colors[0];
    particles = [];
    scarf = [];
    squash = 1;
  }

  function cycleColor(d) {
    const cols = game.world.level.colors;
    const i = cols.indexOf(game.color);
    game.color = cols[(i + d + cols.length) % cols.length];
    sfx.select();
  }

  function showToast(str) { game.toast = { str, t: 90 }; }

  function burst(x, y, color, n, speed = 4, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 30 + Math.random() * 30, color, size: size * (0.5 + Math.random()) });
    }
  }

  function handleEvents(world) {
    for (const ev of world.events) {
      switch (ev.type) {
        case 'jump': sfx.jump(); squash = 1.25; break;
        case 'bounce': sfx.bounce(); squash = 1.4; burst(ev.x, ev.y, COLOR_HEX[BLUE], 10, 3, 3); break;
        case 'throw': sfx.throw(); break;
        case 'splat':
          if (ev.quiet) { /* yellow shot hit the player; grow/shrink plays instead */ }
          else if (ev.painted) sfx.splat(); else sfx.clank();
          burst(ev.x, ev.y, ev.color ? COLOR_HEX[ev.color] : '#f4f1ea', ev.painted ? 14 : 6, 3.5, 4);
          break;
        case 'stick': sfx.stick(); break;
        case 'land': sfx.land(); squash = 0.7; break;
        case 'shrink': sfx.shrink(); squash = 0.6; burst(ev.x, ev.y, COLOR_HEX[YELLOW], 16, 3, 3); break;
        case 'grow': sfx.grow(); squash = 1.4; burst(ev.x, ev.y, COLOR_HEX[YELLOW], 16, 4, 4); break;
        case 'die': sfx.die(); game.shake = 12; burst(ev.x, ev.y, '#111', 30, 6, 5); break;
        case 'respawn': sfx.respawn(); break;
        case 'stomp': sfx.stomp(); squash = 1.3; game.shake = 4; burst(ev.x, ev.y, INK, 18, 5, 4); break;
        case 'monsterDie': sfx.stomp(); burst(ev.x, ev.y, INK, 14, 4, 4); break;
        case 'stun': sfx.stun(); burst(ev.x, ev.y, paintHex(ev.color), 12, 3, 3); break;
        case 'deflect': sfx.clank(); burst(ev.x, ev.y, paintHex(ev.color), 6, 3, 2); showToast('Same color as its hat - no effect!'); break;
        case 'warn': sfx.warn(); break;
        case 'shoot': sfx.shoot(); break;
        case 'can': sfx.can(); burst(ev.x, ev.y, '#ffd166', 18, 4, 3); break;
        case 'portal': sfx.portal(); burst(ev.x, ev.y, COLOR_HEX[PURPLE], 14, 3, 3); break;
        case 'teleport':
          sfx.teleport();
          burst(ev.fx, ev.fy, COLOR_HEX[PURPLE], 16, 4, 3);
          burst(ev.x, ev.y, COLOR_HEX[PURPLE], 16, 4, 3);
          scarf = [];
          break;
        case 'win':
          sfx.win();
          for (const c of ALL_COLORS) burst(ev.x, ev.y, COLOR_HEX[c], 16, 7, 5);
          break;
      }
    }
    world.events.length = 0;
  }

  function completeLevel() {
    const w = game.world;
    const time = w.frame / 60;
    const key = LEVELS[game.levelIdx].name;
    const prev = game.best[key];
    const isBest = !prev || time < prev;
    if (isBest) { game.best[key] = time; store.set('bestByName', game.best); }
    const stars = w.cansCollected;
    const newStars = stars > (game.stars[key] || 0);
    if (newStars) { game.stars[key] = stars; store.set('starsByName', game.stars); }
    if (stars === 3 && !(game.best3[key] <= time)) { game.best3[key] = time; store.set('best3ByName', game.best3); }
    if (!(game.fewest[key] <= w.throws)) { game.fewest[key] = w.throws; store.set('fewestByName', game.fewest); }
    game.lastResult = { time, throws: w.throws, deaths: w.deaths, isBest, stars, newStars, cloud: null };
    if (game.levelIdx + 1 > game.unlocked && game.levelIdx + 1 < LEVELS.length) {
      game.unlocked = game.levelIdx + 1;
      store.set('unlocked', game.unlocked);
    }
    postResult(game.lastResult, true);
    game.mode = 'complete';
  }

  // ---------- online (leaderboards + stats) ----------
  const online = () => typeof Cloud !== 'undefined' && Cloud.available;

  function postResult(result, completed) {
    if (!online() || !Cloud.user) { result.cloud = online() ? 'signin' : null; return; }
    const lv = LEVELS[game.levelIdx];
    const run = { level: lv.name, levelIdx: game.levelIdx, completed, time: result.time, stars: result.stars, throws: result.throws, deaths: result.deaths };
    Cloud.logRun(run).catch((e) => console.warn('logRun', e.code || e));
    if (!completed) return;
    result.cloud = 'saving';
    // keep the star ranking up to date too (total stars, levels cleared)
    Cloud.saveProfile(localProgress(), LEVELS).catch((e) => console.warn('saveProfile', e.code || e));
    Cloud.submitScore(run)
      .then((ranks) => { result.cloud = ranks; })
      .catch((e) => { console.warn('submitScore', e); result.cloud = 'error'; });
  }

  // Leaving a level without finishing it is logged too, so the stats show where people get stuck.
  function logAbandon() {
    const w = game.world;
    if (!w || w.state === 'won' || w.frame < 120) return;
    postResult({ time: w.frame / 60, stars: w.cansCollected, throws: w.throws, deaths: w.deaths }, false);
  }

  function cloudLine(r) {
    const c = r.cloud;
    if (c === 'signin') return ['Sign in (top right) to put this on the leaderboards', 15, 'rgba(255,255,255,0.75)', 600];
    if (c === 'saving') return ['Posting to the leaderboards…', 15, 'rgba(255,255,255,0.75)', 600];
    if (c === 'error') return ['Could not reach the leaderboards', 15, 'rgba(255,255,255,0.6)', 500];
    if (c && typeof c === 'object') {
      const parts = [];
      if (c.fastest) parts.push(`#${c.fastest} fastest`);
      if (c.perfect) parts.push(`#${c.perfect} perfect run`);
      if (c.efficient) parts.push(`#${c.efficient} fewest throws`);
      return [`🏆 ${parts.join('  ·  ')}   (L for leaderboards)`, 16, '#ffd166', 700];
    }
    return ['', 14, '#fff', 500];
  }

  function localProgress() {
    const progress = {};
    for (const l of LEVELS) {
      if (game.best[l.name] === undefined) continue;
      progress[l.name] = { t: game.best[l.name], s: game.stars[l.name] || 0, t3: game.best3[l.name], th: game.fewest[l.name] };
    }
    return { progress, unlocked: game.unlocked };
  }

  function applyProgress(m) {
    for (const [name, p] of Object.entries(m.progress)) {
      if (p.t !== undefined) game.best[name] = p.t;
      game.stars[name] = Math.max(game.stars[name] || 0, p.s || 0);
      if (p.t3 !== undefined) game.best3[name] = p.t3;
      if (p.th !== undefined) game.fewest[name] = p.th;
    }
    const wasAtUnlocked = game.menuIdx === game.unlocked;
    game.unlocked = Math.max(game.unlocked, Math.min(m.unlocked || 0, LEVELS.length - 1));
    if (game.mode === 'title' && wasAtUnlocked) game.menuIdx = game.unlocked;
    store.set('bestByName', game.best); store.set('starsByName', game.stars);
    store.set('best3ByName', game.best3); store.set('fewestByName', game.fewest);
    store.set('unlocked', game.unlocked);
  }

  // ---------- fixed-step update ----------
  function update() {
    game.tick++;
    if (game.shake > 0) game.shake--;
    if (game.toast && --game.toast.t <= 0) game.toast = null;

    if (tapped('KeyM')) showToast(Sound.toggleMusic() ? '♪ Music on' : '♪ Music off');
    if (tapped('KeyF')) toggleFullscreen();
    if (tapped('KeyL') && game.mode !== 'play' && typeof UI !== 'undefined') {
      UI.openLeaderboard(game.mode === 'title' ? game.menuIdx : game.levelIdx);
      pressed.clear(); keys.clear(); mouse.down = false;
      return;
    }

    if (game.mode === 'title') {
      if (tapped('ArrowLeft', 'KeyA')) { game.menuIdx = Math.max(0, game.menuIdx - 1); sfx.select(); }
      if (tapped('ArrowRight', 'KeyD')) { game.menuIdx = Math.min(game.unlocked, game.menuIdx + 1); sfx.select(); }
      if (tapped('Enter', 'Space') || mouse.down) { mouse.down = false; startLevel(game.menuIdx); }
    } else if (game.mode === 'complete') {
      if (tapped('Enter', 'Space') || mouse.down) {
        mouse.down = false;
        if (game.levelIdx + 1 < LEVELS.length) startLevel(game.levelIdx + 1);
        else game.mode = 'end';
      }
      if (tapped('KeyR')) startLevel(game.levelIdx);
      if (tapped('Escape')) { game.mode = 'title'; game.menuIdx = game.unlocked; }
    } else if (game.mode === 'end') {
      if (tapped('Enter', 'Space', 'Escape')) { game.mode = 'title'; game.menuIdx = game.unlocked; }
    } else if (game.mode === 'play') {
      const w = game.world;
      if (tapped('Escape')) { logAbandon(); game.mode = 'title'; game.menuIdx = game.levelIdx; pressed.clear(); return; }
      if (tapped('KeyR')) { logAbandon(); startLevel(game.levelIdx); pressed.clear(); return; }
      const cols = w.level.colors;
      ALL_COLORS.forEach((c, i) => {
        if (tapped('Digit' + (i + 1)) && cols.includes(c)) { game.color = c; sfx.select(); }
      });
      if (tapped('KeyQ')) cycleColor(-1);
      if (tapped('KeyE')) cycleColor(1);

      const jumpHeld = held('Space', 'KeyW', 'ArrowUp');
      const inp = {
        left: held('KeyA', 'ArrowLeft'),
        right: held('KeyD', 'ArrowRight'),
        up: held('KeyW', 'ArrowUp'),
        down: held('KeyS', 'ArrowDown'),
        jump: jumpHeld,
        jumpPressed: jumpHeld && !prevJumpHeld,
        spacePressed: tapped('Space'),
      };
      prevJumpHeld = jumpHeld;

      const wash = mouse.right || (mouse.down && held('ShiftLeft', 'ShiftRight'));
      if (mouse.down || mouse.right) w.throwPaint(mouse.x, mouse.y, wash ? NONE : game.color);

      w.step(inp);
      handleEvents(w);
      if (w.state === 'won' && w.timer > 70) completeLevel();
    }
    pressed.clear();

    for (const p of particles) {
      p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.life--;
    }
    particles = particles.filter((p) => p.life > 0);
    squash += (1 - squash) * 0.2;
  }

  // ============================================================
  //  Rendering
  // ============================================================

  // Stable pseudo-random per tile, so drips don't flicker.
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'left', weight = 700) {
    ctx.font = `${weight} ${size}px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function hatch(x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = INK_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -h; k < w; k += 8) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
    ctx.stroke();
    ctx.restore();
  }

  function drawDrip(x, y, len, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.lineTo(x - 2.5, y + len);
    ctx.arc(x, y + len, 2.5, Math.PI, 0, true);
    ctx.lineTo(x + 2.5, y);
    ctx.fill();
  }

  function drawBackground() {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.035)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
  }

  function drawTiles(w) {
    const lv = w.level;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = lv.tiles[r][c];
        const x = c * T, y = r * T;
        if (t === '#') {
          const col = lv.paint[r][c];
          if (col) {
            ctx.fillStyle = COLOR_HEX[col];
            ctx.fillRect(x, y, T, T);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x + 4 + hash(c, r) * 12, y + 4 + hash(r, c) * 10, 6, 3);
          } else {
            ctx.fillStyle = INK;
            ctx.fillRect(x, y, T, T);
            hatch(x, y, T, T);
          }
        } else if (t === 'M') {
          ctx.fillStyle = METAL;
          ctx.fillRect(x, y, T, T);
          ctx.strokeStyle = '#6c717a';
          ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
          ctx.fillStyle = '#b9bdc4';
          for (const [dx, dy] of [[6, 6], [T - 6, 6], [6, T - 6], [T - 6, T - 6]]) {
            ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
    // paint drips under painted tiles with open space below
    for (let r = 0; r < ROWS - 1; r++) {
      for (let c = 0; c < COLS; c++) {
        const col = lv.paint[r][c];
        if (!col || w.solid(c, r + 1)) continue;
        for (let k = 0; k < 2; k++) {
          const dx = 5 + hash(c + k * 31, r) * (T - 10);
          const len = 4 + hash(r + k * 17, c) * 10 + Math.sin(game.tick * 0.05 + c + k) * 1.2;
          drawDrip(c * T + dx, (r + 1) * T, len, COLOR_HEX[col]);
        }
      }
    }
    // spikes
    ctx.fillStyle = INK;
    for (const s of lv.spikes) {
      const x = s.c * T, y = s.r * T;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = k * T / 3, b = a + T / 3, m = (a + b) / 2;
        if (s.dir === 'up') { ctx.moveTo(x + a, y + T); ctx.lineTo(x + m, y + 8); ctx.lineTo(x + b, y + T); }
        if (s.dir === 'down') { ctx.moveTo(x + a, y); ctx.lineTo(x + m, y + T - 8); ctx.lineTo(x + b, y); }
        if (s.dir === 'right') { ctx.moveTo(x, y + a); ctx.lineTo(x + T - 8, y + m); ctx.lineTo(x, y + b); }
        if (s.dir === 'left') { ctx.moveTo(x + T, y + a); ctx.lineTo(x + 8, y + m); ctx.lineTo(x + T, y + b); }
      }
      ctx.fill();
    }
  }

  function drawPlatforms(w) {
    for (const pl of w.platforms) {
      // track
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pl.x0 + pl.w / 2, pl.y0 + pl.h / 2);
      ctx.lineTo(pl.x1 + pl.w / 2, pl.y1 + pl.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [ex, ey] of [[pl.x0, pl.y0], [pl.x1, pl.y1]]) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(ex + pl.w / 2, ey + pl.h / 2, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // body
      roundRect(pl.x, pl.y, pl.w, pl.h, 4);
      if (pl.color) {
        ctx.fillStyle = COLOR_HEX[pl.color];
        ctx.fill();
        for (let k = 0; k < 3; k++) {
          drawDrip(pl.x + 8 + k * (pl.w - 16) / 2, pl.y + pl.h - 1, 3 + hash(k, pl.x0) * 6 + Math.sin(game.tick * 0.06 + k) * 1.2, COLOR_HEX[pl.color]);
        }
      } else {
        ctx.fillStyle = INK;
        ctx.fill();
        hatch(pl.x + 2, pl.y + 2, pl.w - 4, pl.h - 4);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      roundRect(pl.x, pl.y, pl.w, pl.h, 4);
      ctx.stroke();
      // gear/bolt details so it reads as a machine
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (const bx of [pl.x + 6, pl.x + pl.w - 6]) {
        ctx.beginPath(); ctx.arc(bx, pl.y + pl.h / 2, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---- portals ----
  function drawPortals(w) {
    const active = w.portals.length === 2;
    w.portals.forEach((pt, i) => {
      const { c, r, face } = pt;
      const horizontal = face === 'top' || face === 'bottom';
      const cx = face === 'left' ? c * T : face === 'right' ? (c + 1) * T : c * T + T / 2;
      const cy = face === 'top' ? r * T : face === 'bottom' ? (r + 1) * T : r * T + T / 2;
      const rx = horizontal ? T / 2 + 2 : 7, ry = horizontal ? 7 : T / 2 + 2;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.55;
      ctx.fillStyle = COLOR_HEX[PURPLE];
      ctx.shadowColor = COLOR_HEX[PURPLE];
      ctx.shadowBlur = active ? 14 + Math.sin(game.tick * 0.15) * 5 : 0;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // swirl
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const a = game.tick * 0.12 + k * 2.1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * (0.35 + k * 0.2), ry * (0.35 + k * 0.2), 0, a, a + 1.6);
        ctx.stroke();
      }
      ctx.restore();
      text(String(i + 1), cx + (horizontal ? 0 : face === 'left' ? -14 : 14), cy + (horizontal ? (face === 'top' ? -14 : 14) : 0), 11, COLOR_HEX[PURPLE], 'center', 800);
    });
  }

  // ---- paint cans (stars) ----
  function drawCan(x, y, size, got, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = got ? 1 : 0.9;
    // handle
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * size;
    ctx.beginPath(); ctx.arc(0, -5 * size, 6 * size, Math.PI, 0); ctx.stroke();
    // bucket
    ctx.fillStyle = got === false ? '#cfcfd4' : '#b8bcc6';
    ctx.beginPath();
    ctx.moveTo(-7 * size, -5 * size); ctx.lineTo(7 * size, -5 * size);
    ctx.lineTo(5.5 * size, 8 * size); ctx.lineTo(-5.5 * size, 8 * size);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.stroke();
    // paint
    ctx.fillStyle = color;
    ctx.fillRect(-7 * size, -6 * size, 14 * size, 4 * size);
    ctx.beginPath(); ctx.arc(-3 * size, -2 * size, 1.8 * size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCans(w) {
    w.cans.forEach((can, i) => {
      if (can.got) return;
      const bob = Math.sin(game.tick * 0.08 + i * 2) * 3;
      const x = can.c * T + T / 2, y = can.r * T + T / 2 + bob;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(game.tick * 0.1 + i);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawCan(x, y, 1, true, COLOR_HEX[ALL_COLORS[(i + Math.floor(game.tick / 40)) % ALL_COLORS.length]]);
    });
  }

  // ---- monsters ----
  function drawMonsters(w) {
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const stunned = m.stun > 0;
      const warn = m.warning > 0;
      const shake = warn ? Math.sin(game.tick * 1.7) * 1.5 : 0;
      const step = stunned ? 0 : Math.sin(game.tick * 0.35 + m.x * 0.05);
      const x = m.x + shake, y = m.y, mw = m.w, mh = m.h;

      // feet
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(x + mw * 0.3, y + mh - 1 + (step > 0 ? -1.5 : 0), 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + mw * 0.7, y + mh - 1 + (step < 0 ? -1.5 : 0), 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      // body: a wobbly ink blob
      ctx.beginPath();
      const wob = Math.sin(game.tick * 0.2 + m.x) * 1.5;
      ctx.moveTo(x, y + mh - 3);
      ctx.quadraticCurveTo(x - 2, y + 2 + wob, x + mw / 2, y + wob * 0.5);
      ctx.quadraticCurveTo(x + mw + 2, y + 2 - wob, x + mw, y + mh - 3);
      ctx.closePath();
      ctx.fill();
      if (stunned) {
        ctx.fillStyle = paintHex(m.stunColor);
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.ellipse(x + mw / 2, y + mh * 0.45, mw * 0.42, mh * 0.32, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // eyes
      const ey = y + mh * 0.38, look = m.dir * 2;
      ctx.fillStyle = '#fff';
      for (const ex of [x + mw * 0.32, x + mw * 0.68]) {
        ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = INK;
      if (stunned) {
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        for (const ex of [x + mw * 0.32, x + mw * 0.68]) {
          ctx.beginPath(); ctx.moveTo(ex - 2.5, ey - 2.5); ctx.lineTo(ex + 2.5, ey + 2.5);
          ctx.moveTo(ex + 2.5, ey - 2.5); ctx.lineTo(ex - 2.5, ey + 2.5); ctx.stroke();
        }
      } else {
        for (const ex of [x + mw * 0.32, x + mw * 0.68]) {
          ctx.beginPath(); ctx.arc(ex + look, ey + 0.5, 2, 0, Math.PI * 2); ctx.fill();
        }
        // angry brows
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + mw * 0.2, ey - 7); ctx.lineTo(x + mw * 0.42, ey - 4.5);
        ctx.moveTo(x + mw * 0.8, ey - 7); ctx.lineTo(x + mw * 0.58, ey - 4.5);
        ctx.stroke();
      }

      if (m.type === 'hat') {
        const hatColor = paintHex(m.color);
        const lift = warn ? -3 - Math.abs(Math.sin(game.tick * 0.5)) * 3 : 0;
        const hx = x + mw / 2, hy = y + 2 + lift;
        ctx.fillStyle = hatColor; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        roundRect(hx - 15, hy - 3, 30, 5, 2); ctx.fill(); ctx.stroke();        // brim
        roundRect(hx - 9, hy - 19, 18, 17, 3); ctx.fill(); ctx.stroke();     // crown
        ctx.fillStyle = INK; ctx.fillRect(hx - 9, hy - 7, 18, 3);           // band
        if (warn) text('!', hx, hy - 30, 18, '#ff3b4e', 'center', 900);
      }

      if (stunned) {
        for (let k = 0; k < 3; k++) {
          const a = game.tick * 0.15 + k * 2.1;
          text('✦', x + mw / 2 + Math.cos(a) * 14, y - (m.type === 'hat' ? 26 : 6) + Math.sin(a) * 4, 10, '#ffd166', 'center', 900);
        }
      }
    }
  }

  function drawFlag(w) {
    const f = w.level.flag;
    const x = f.c * T + T / 2 - 6, base = f.r * T + T;
    ctx.fillStyle = INK;
    ctx.fillRect(x, base - 48, 3, 48);
    const wave = Math.sin(game.tick * 0.1);
    ALL_COLORS.forEach((c, i) => {
      ctx.fillStyle = COLOR_HEX[c];
      ctx.beginPath();
      const y0 = base - 48 + i * 5;
      ctx.moveTo(x + 3, y0);
      ctx.quadraticCurveTo(x + 13, y0 + wave * 3, x + 25, y0 + wave * 2);
      ctx.lineTo(x + 25, y0 + 5 + wave * 2);
      ctx.quadraticCurveTo(x + 13, y0 + 5 + wave * 3, x + 3, y0 + 5);
      ctx.fill();
    });
  }

  function drawPlayer(w) {
    const p = w.player;
    if (w.state === 'dead') return;
    const k = p.h / 40; // 1 when big, ~0.45 when small
    const cx = p.x + p.w / 2;

    // scarf trail in the current color
    scarf.unshift({ x: cx - p.face * 4 * k, y: p.y + 12 * k });
    if (scarf.length > 9) scarf.pop();
    ctx.strokeStyle = COLOR_HEX[game.color];
    ctx.lineWidth = Math.max(2.5, 6 * k);
    ctx.lineCap = 'round';
    ctx.beginPath();
    scarf.forEach((s, i) => {
      const sx = s.x - p.face * i * 1.5 * k, sy = s.y + Math.sin(game.tick * 0.3 + i) * 1.2;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    });
    ctx.stroke();

    // body with squash & stretch
    const sy = p.cling ? 1 : squash, sxs = 1 / sy;
    const bw = p.w * sxs, bh = p.h * sy;
    const by = p.cling === 2 ? p.y : p.y + p.h - bh;
    ctx.fillStyle = INK;
    roundRect(cx - bw / 2, by, bw, bh, Math.max(3, 8 * k));
    ctx.fill();

    // eyes
    const lookX = p.cling === -1 || p.cling === 1 ? p.cling : p.face;
    const ey = by + 9 * k + (p.cling === 2 ? 10 * k : 0);
    const ew = Math.max(2, 4 * k), eh = Math.max(3, 7 * k);
    const blink = (game.tick % 200) < 6 ? 0.2 : 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 6 * k + lookX * 3 * k, ey, ew, eh * blink);
    ctx.fillRect(cx + 2 * k + lookX * 3 * k, ey, ew, eh * blink);

    // paint-stained hand
    ctx.fillStyle = COLOR_HEX[game.color];
    ctx.beginPath(); ctx.arc(cx + p.face * (bw / 2), by + bh * 0.6, Math.max(2, 4 * k), 0, Math.PI * 2); ctx.fill();
  }

  function drawBlobs(w) {
    for (const b of w.blobs) {
      ctx.fillStyle = paintHex(b.color);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  const washing = () => mouse.right || held('ShiftLeft', 'ShiftRight');

  function drawAim(w) {
    const p = w.player;
    if (w.state !== 'play') return;
    // trajectory preview: same maths as the real blob
    let x = p.x + p.w / 2, y = p.y + p.h * 0.25;
    const dx = mouse.x - x, dy = mouse.y - y, d = Math.hypot(dx, dy) || 1;
    let vx = dx / d * BLOB_SPEED, vy = dy / d * BLOB_SPEED;
    ctx.fillStyle = washing() ? '#ffffff' : COLOR_HEX[game.color];
    for (let i = 0; i < 40; i++) {
      for (let s = 0; s < 3; s++) { vy += BLOB_G / 3; x += vx / 3; y += vy / 3; }
      const c = Math.floor(x / T), r = Math.floor(y / T);
      if (w.solid(c, r) || w.tile(c, r) === '^') break;
      if (w.platforms.some((pl) => x >= pl.x && x <= pl.x + pl.w && y >= pl.y && y <= pl.y + pl.h)) break;
      if (i % 2 === 0) {
        ctx.globalAlpha = 0.55 * (1 - i / 40);
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCursor() {
    const col = game.mode === 'play' ? (washing() ? '#ffffff' : COLOR_HEX[game.color]) : '#ffffff';
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2); ctx.fill();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(w) {
    const lv = w.level;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 30);
    text(`${game.levelIdx + 1} / ${LEVELS.length}   ${lv.name}`, 12, 15, 15, '#fff');
    w.cans.forEach((can, i) => drawCan(W / 2 - 22 + i * 22, 16, 0.75, can.got, can.got ? COLOR_HEX[ALL_COLORS[i]] : '#55555c'));
    text(`${(w.frame / 60).toFixed(1)}s`, W - 12, 15, 15, '#fff', 'right');
    text(`R restart · Esc menu · M music ${Sound.musicOn ? 'on' : 'off'} · F full screen`, W - 80, 15, 12, 'rgba(255,255,255,0.55)', 'right', 500);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 40, W, 40);
    let x = 12;
    ALL_COLORS.forEach((c, i) => {
      if (!lv.colors.includes(c)) return;
      const y = H - 32;
      if (game.color === c) { ctx.fillStyle = '#fff'; roundRect(x - 3, y - 3, 76, 30, 8); ctx.fill(); }
      ctx.fillStyle = COLOR_HEX[c];
      roundRect(x, y, 70, 24, 6); ctx.fill();
      const label = c === PURPLE ? `${i + 1} Portal ${'●'.repeat(w.portals.length)}${'○'.repeat(2 - w.portals.length)}` : `${i + 1} ${COLOR_NAME[c]}`;
      text(label, x + 35, y + 12, c === PURPLE ? 11 : 12, c === YELLOW ? INK : '#fff', 'center');
      x += 82;
    });
    text(lv.hint, (x + W) / 2, H - 20, 14, '#fff', 'center', 500);

    if (game.toast) {
      ctx.globalAlpha = Math.min(1, game.toast.t / 20);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(W / 2 - 90, 44, 180, 32, 10); ctx.fill();
      text(game.toast.str, W / 2, 60, 15, '#fff', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawWorld(w) {
    drawBackground();
    drawTiles(w);
    drawPlatforms(w);
    drawPortals(w);
    drawCans(w);
    drawFlag(w);
    drawMonsters(w);
    drawBlobs(w);
    drawPlayer(w);
    drawParticles();
    drawAim(w);
  }

  function splotch(x, y, r, color, seed) {
    const pts = [];
    for (let a = 0; a < 14; a++) {
      const ang = a / 14 * Math.PI * 2;
      const rr = r * (0.72 + 0.28 * hash(a, seed));
      pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr]);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      const mx = (px + nx) / 2, my = (py + ny) / 2;
      if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(px, py, mx, my);
    });
    const [fx, fy] = pts[0], [sx2, sy2] = pts[1];
    ctx.quadraticCurveTo(fx, fy, (fx + sx2) / 2, (fy + sy2) / 2);
    ctx.fill();
  }

  function drawTitle() {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const splots = [[150, 120, BLUE, 90], [820, 150, RED, 105], [480, 480, GREEN, 115], [90, 440, YELLOW, 70], [880, 450, BLUE, 65], [300, 40, YELLOW, 45]];
    for (const [x, y, c, r] of splots) splotch(x, y, r, COLOR_HEX[c], x);

    const bob = Math.sin(game.tick * 0.05) * 4;
    for (const [word, y] of [['PAINT', 175], ['RUNNER', 265]]) {
      for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2], [5, 6]]) {
        text(word, W / 2 + ox, y + bob + oy, 96, INK, 'center', 900);
      }
      text(word, W / 2, y + bob, 96, '#fff', 'center', 900);
    }
    text('Throw paint. Change the world.', W / 2, 330, 20, INK, 'center', 600);

    const lv = LEVELS[game.menuIdx];
    ctx.fillStyle = INK;
    roundRect(W / 2 - 210, 362, 420, 72, 14); ctx.fill();
    text(`◀  Level ${game.menuIdx + 1}: ${lv.name}  ▶`, W / 2, 384, 19, '#fff', 'center');
    // colors used in this level
    lv.colors.forEach((c, i) => {
      ctx.fillStyle = COLOR_HEX[c];
      ctx.beginPath(); ctx.arc(W / 2 - (lv.colors.length - 1) * 9 + i * 18 - 70, 412, 6, 0, Math.PI * 2); ctx.fill();
    });
    const best = game.best[lv.name];
    const st = game.stars[lv.name] || 0;
    text(best ? `${'★'.repeat(st)}${'☆'.repeat(3 - st)}   Best: ${best.toFixed(1)}s` : 'Not cleared yet', W / 2 + 40, 412, 13, best ? '#ffd166' : 'rgba(255,255,255,0.65)', 'center', 600);
    text(`★ ${totalStars()} / ${LEVELS.length * 3}`, W - 20, 24, 16, INK, 'right', 800);
    if (Math.floor(game.tick / 30) % 2 === 0) text('Press ENTER or click to play  ·  L for leaderboards', W / 2, 462, 16, INK, 'center', 700);

    text('A/D move · W/Space jump · Mouse aim · Click throw · Right-click wash · 1-5 colors · M music · F full screen', W / 2, H - 22, 12, INK, 'center', 500);
    if (game.toast) text(game.toast.str, W / 2, 30, 14, INK, 'center', 600);
  }

  function totalStars() {
    return LEVELS.reduce((n, l) => n + (game.stars[l.name] || 0), 0);
  }

  function drawPanel(lines) {
    ctx.fillStyle = 'rgba(15,15,18,0.82)';
    ctx.fillRect(0, 0, W, H);
    lines.forEach(([str, size, color, weight], i) => text(str, W / 2, 170 + i * 46, size, color, 'center', weight));
  }

  function render() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (game.mode === 'title') {
      drawTitle();
    } else {
      ctx.save();
      if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
      drawWorld(game.world);
      ctx.restore();
      if (game.mode === 'play') drawHUD(game.world);
      if (game.mode === 'complete') {
        const r = game.lastResult;
        drawPanel([
          ['Level complete!', 48, '#fff', 900],
          [`${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}${r.newStars ? '   new record!' : ''}`, 34, '#ffd166', 900],
          [`Time ${r.time.toFixed(1)}s${r.isBest ? '  ★ new best' : ''}`, 22, r.isBest ? '#ffd166' : '#fff', 600],
          [`Paint thrown: ${r.throws}   ·   Falls: ${r.deaths}`, 18, 'rgba(255,255,255,0.75)', 500],
          cloudLine(r),
          ['ENTER: next level   ·   R: retry   ·   Esc: menu', 16, 'rgba(255,255,255,0.6)', 500],
        ]);
      }
      if (game.mode === 'end') {
        drawPanel([
          ['You painted the world!', 48, '#fff', 900],
          ['All levels complete. Thanks for playing.', 20, '#fff', 500],
          [`Stars: ${totalStars()} / ${LEVELS.length * 3}`, 24, '#ffd166', 800],
          ['Try beating your best times from the menu.', 18, 'rgba(255,255,255,0.7)', 500],
          ['Press ENTER', 16, 'rgba(255,255,255,0.6)', 500],
        ]);
      }
    }
    drawCursor();
  }

  // Handy for poking at the game from the browser console.
  window.paintRunner = { game, startLevel };

  if (typeof UI !== 'undefined') {
    UI.init({
      toast: showToast,
      toggleFullscreen,
      currentLevel: () => (game.mode === 'title' ? game.menuIdx : game.levelIdx),
      localProgress,
      applyProgress,
    });
  }

  // Dev shortcut: index.html#level=3 jumps straight into a level.
  const hashLevel = /level=(\d+)/.exec(location.hash);
  if (hashLevel) startLevel(Math.max(0, Math.min(LEVELS.length - 1, Number(hashLevel[1]) - 1)));

  // ---------- main loop ----------
  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    if (typeof UI !== 'undefined') UI.setMode(game.mode);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
