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

  // Keyboard focus. Inside another page's frame (itch.io), that page's own buttons - like its full
  // screen button - take the keyboard away from us. Clicking the game takes it back, and while we
  // don't have it we say so.
  const embedded = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
  let hasFocus = document.hasFocus();
  window.addEventListener('focus', () => { hasFocus = true; });
  window.addEventListener('blur', () => { hasFocus = false; keys.clear(); });
  const grabFocus = () => { try { window.focus(); } catch (e) { /* not allowed: the next click will do it */ } };
  document.addEventListener('fullscreenchange', grabFocus);
  document.addEventListener('webkitfullscreenchange', grabFocus);

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
    // preventDefault below would stop the click from giving us the keyboard, so take it ourselves.
    // A click that only brings the keyboard back doesn't throw paint (it would cost a throw).
    const hadFocus = hasFocus;
    grabFocus();
    e.preventDefault();
    if (embedded && !hadFocus) return;
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.right = true;
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
    unlocked: 0,                                // set by refreshUnlocked() from cleared levels
    best: store.get('bestByName', {}),
    stars: store.get('starsByName', {}),
    character: store.get('character', 'blob'),  // which hero you play as (see characters.js)
    // Paint Drops + store: earned/spent only ever go up, so two devices merge by taking the max.
    wallet: Object.assign({ earned: 0, spent: 0, owned: [], equipped: {}, equippedAt: 0, clears: {}, daily: '' }, store.get('wallet', {})),
    runStomps: 0,
    best3: store.get('best3ByName', {}),        // fastest time with all 3 cans
    fewest: store.get('fewestByName', {}),      // fewest paint throws
    menuIdx: 0,
    shake: 0,
    tick: 0,
    lastResult: null,
    toast: null,
  };
  // You can play every level up to and including the first one you haven't cleared.
  // (Based on level names, so reordering or adding levels never skips anything.)
  function refreshUnlocked() {
    const i = LEVELS.findIndex((l) => game.best[l.name] === undefined);
    game.unlocked = i < 0 ? LEVELS.length - 1 : i;
  }
  refreshUnlocked();
  game.menuIdx = game.unlocked;

  let particles = [];
  let squash = 1;
  let runPhase = 0;   // where the feet are in their step cycle
  let heroTrail = SHOP.makeTrail(), splatMarks = [], pops = [], stains = [];
  let prevJumpHeld = false;

  function startLevel(i) {
    game.levelIdx = i;
    game.world = new World(LEVELS[i]);
    game.mode = 'play';
    game.color = LEVELS[i].colors[0];
    game.runStomps = 0;
    heroTrail = SHOP.makeTrail();
    splatMarks = [];
    stains = [];
    pops = [];
    particles = [];
    squash = 1;
  }

  function cycleColor(d) {
    const cols = game.world.level.colors;
    const i = cols.indexOf(game.color);
    game.color = cols[(i + d + cols.length) % cols.length];
    sfx.select();
  }

  function showToast(str, ms = 1500) { game.toast = { str, t: Math.round(ms / 1000 * 60) }; }

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
          if (ev.color && !ev.quiet) {                     // paint splatter stays on the paper for the whole level
            stains.push(ART.makeStain(ev.x, ev.y, COLOR_HEX[ev.color]));
            if (stains.length > 60) stains.shift();
          }
          if (ev.painted && look().splat) splatMarks.push({ x: ev.x, y: ev.y, col: ev.color ? COLOR_HEX[ev.color] : '#f4f1ea', life: 1.4, seed: Math.random() * 6 });
          if (ev.quiet) { /* yellow shot hit the player; grow/shrink plays instead */ }
          else if (ev.painted) sfx.splat(); else sfx.clank();
          burst(ev.x, ev.y, ev.color ? COLOR_HEX[ev.color] : '#f4f1ea', ev.painted ? 14 : 6, 3.5, 4);
          break;
        case 'stick': sfx.stick(); break;
        case 'land': sfx.land(); squash = 0.7; break;
        case 'shrink': sfx.shrink(); squash = 0.6; burst(ev.x, ev.y, COLOR_HEX[YELLOW], 16, 3, 3); break;
        case 'grow': sfx.grow(); squash = 1.4; burst(ev.x, ev.y, COLOR_HEX[YELLOW], 16, 4, 4); break;
        case 'die':
          if (look().pop) SHOP.burst(pops, look().pop, ev.x, ev.y);
          if (ev.cause === 'lava') {
            sfx.burn(); game.shake = 14;
            burst(ev.x, ev.y, '#ff8c1a', 26, 6, 5); burst(ev.x, ev.y, '#ffd23f', 14, 5, 4); burst(ev.x, ev.y - 10, '#555', 12, 3, 6);
          } else { sfx.die(); game.shake = 12; burst(ev.x, ev.y, '#111', 30, 6, 5); }
          break;
        case 'sizzle': sfx.sizzle(); burst(ev.x, ev.y, '#bbb', 8, 2, 4); burst(ev.x, ev.y, '#ff8c1a', 5, 2.5, 2); break;
        case 'respawn': sfx.respawn(); break;
        case 'stomp': game.runStomps++; sfx.stomp(); squash = 1.3; game.shake = 4; burst(ev.x, ev.y, INK, 18, 5, 4); break;
        case 'monsterDie':
          if (ev.cause === 'lava') { sfx.sizzle(); burst(ev.x, ev.y, '#ff8c1a', 16, 4, 4); }
          else { sfx.stomp(); burst(ev.x, ev.y, INK, 14, 4, 4); }
          break;
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
    const time = Math.round((w.finishTime ?? w.frame / 60) * 1000) / 1000;
    const key = LEVELS[game.levelIdx].name;
    const prev = game.best[key];
    const isBest = !prev || time < prev;
    if (isBest) { game.best[key] = time; store.set('bestByName', game.best); }
    const stars = w.cansCollected;
    const starsBefore = totalStars();
    const earned = earnDrops(key, {
      firstClear: prev === undefined,
      newCans: Math.max(0, stars - (game.stars[key] || 0)),
      isBest,
      stomps: Math.min(game.runStomps, w.monsters.length),
    });
    const newStars = stars > (game.stars[key] || 0);
    if (newStars) { game.stars[key] = stars; store.set('starsByName', game.stars); }
    if (stars === 3 && !(game.best3[key] <= time)) { game.best3[key] = time; store.set('best3ByName', game.best3); }
    if (!(game.fewest[key] <= w.throws)) { game.fewest[key] = w.throws; store.set('fewestByName', game.fewest); }
    const starsAfter = totalStars();
    const unlockedNow = CHARACTERS.filter((c) => c.stars > starsBefore && c.stars <= starsAfter);
    game.lastResult = { time, throws: w.throws, deaths: w.deaths, isBest, stars, newStars, cloud: null, unlockedNow, earned, at: game.tick };
    if (unlockedNow.length) setTimeout(() => sfx.grow(), 400);
    refreshUnlocked();
    store.set('unlocked', game.unlocked);
    postResult(game.lastResult, true);
    game.mode = 'complete';
  }

  // ---------- online (leaderboards + stats) ----------
  const online = () => typeof Cloud !== 'undefined' && Cloud.available;

  function postResult(result, completed) {
    if (!online() || !Cloud.user) { result.cloud = online() ? 'signin' : null; return; }
    const lv = LEVELS[game.levelIdx];
    const run = { level: lv.name, levelIdx: game.levelIdx, completed, time: result.time, stars: result.stars, throws: result.throws, deaths: result.deaths, played: game.world ? game.world.playFrames / 60 : result.time };
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

  // ---- play time (for the owner's stats): time in a level with the tab visible ----
  const playLog = { seconds: 0, levels: new Set(), lastLevel: '' };
  function savePlayTime() {
    if (!online() || !Cloud.user) return;
    Cloud.saveSession({ seconds: playLog.seconds, levels: playLog.levels.size, lastLevel: playLog.lastLevel });
  }
  setInterval(savePlayTime, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePlayTime(); });
  window.addEventListener('pagehide', savePlayTime);

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
    return { progress, unlocked: game.unlocked, wallet: game.wallet };
  }

  function applyProgress(m) {
    for (const [name, p] of Object.entries(m.progress)) {
      if (p.t !== undefined) game.best[name] = p.t;
      game.stars[name] = Math.max(game.stars[name] || 0, p.s || 0);
      if (p.t3 !== undefined) game.best3[name] = p.t3;
      if (p.th !== undefined) game.fewest[name] = p.th;
    }
    if (m.wallet) { game.wallet = m.wallet; saveWallet(); }
    const wasAtUnlocked = game.menuIdx === game.unlocked;
    refreshUnlocked();
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
    if (tapped('KeyS') && (game.mode === 'title' || game.mode === 'complete') && typeof UI !== 'undefined') {
      UI.openStore();
      pressed.clear(); keys.clear(); mouse.down = false;
      return;
    }
    if (tapped('KeyC') && (game.mode === 'title' || game.mode === 'complete') && typeof UI !== 'undefined') {
      UI.openCharacters();
      pressed.clear(); keys.clear(); mouse.down = false;
      return;
    }
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
      if (tapped('Escape')) { game.mode = 'title'; game.menuIdx = game.levelIdx; } // back to the level you just finished
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
      if (!document.hidden) {
        playLog.seconds += 1 / 60;
        playLog.levels.add(LEVELS[game.levelIdx].name);
        playLog.lastLevel = LEVELS[game.levelIdx].name;
      }
      const pl = w.player;
      const trailId = look().trail;
      if (trailId) {
        const k = pl.h / 40, moving = w.state === 'play' && (Math.abs(pl.vx) > 0.6 || Math.abs(pl.vy) > 0.6);
        SHOP.stepTrail(heroTrail, trailId, pl.x + pl.w / 2 - pl.face * 9 * k, pl.y + pl.h * 0.45, 1 / 60, k, 0, moving);
      }
      for (const sm of splatMarks) sm.life -= 1 / 60;
      splatMarks = splatMarks.filter((sm) => sm.life > 0);
      pops = SHOP.stepBurst(pops, 1 / 60);
      const dist = pl.cling === 1 || pl.cling === -1 ? Math.abs(pl.vy) : Math.abs(pl.vx);
      runPhase = (runPhase + dist / (24 * pl.h / 40)) % 1;
      handleEvents(w);
      if (w.state === 'won' && w.timer > 70) completeLevel();
    }
    pressed.clear();

    for (const p of particles) {
      if (p.ember) { p.vy *= 0.99; p.x += p.vx + Math.sin((p.life + p.y) * 0.1) * 0.3; p.y += p.vy; p.life--; continue; }
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

  function drawDrip(x, y, len, color, r = 2.5) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r, y + len);
    ctx.arc(x, y + len, r, Math.PI, 0, true);
    ctx.lineTo(x + r, y);
    ctx.fill();
  }

  function drawBackground() {
    ctx.drawImage(game.world ? ART.paper(LEVELS[game.levelIdx].name, game.levelIdx) : ART.plainPaper(), 0, 0);
    ART.drawStains(ctx, stains);
  }
  const drawTiles = (w) => ART.drawTiles(ctx, w, game.tick / 60, COLOR_HEX);
  const drawLava = (w) => ART.drawLava(ctx, w, game.tick / 60);

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
        ctx.fillStyle = ART.inkPattern(ctx);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      const t = game.tick / 60, sd = Math.round(pl.x0 + pl.y0);
      ART.inkLine(ctx, pl.x - 1, pl.y, pl.x + pl.w + 1, pl.y, sd, 0.65, 2.4, t);
      ART.inkLine(ctx, pl.x - 1, pl.y + pl.h, pl.x + pl.w + 1, pl.y + pl.h, sd + 1, 0.65, 2.4, t);
      ART.inkLine(ctx, pl.x, pl.y, pl.x, pl.y + pl.h, sd + 2, 0.65, 2.4, t);
      ART.inkLine(ctx, pl.x + pl.w, pl.y, pl.x + pl.w, pl.y + pl.h, sd + 3, 0.65, 2.4, t);
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
  // The collectible paint can: a tin pail with a wire handle, wooden grip, paint on top and a
  // drip down the side. got === false draws the grey "still to find" version (top bar).
  function drawCan(x, y, size, got, color) {
    const s = size * 1.15, t = game.tick / 60;
    ctx.save();
    ctx.translate(x, y + 1.2 * s);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = INK;
    // wire handle + grip
    ctx.beginPath(); ctx.arc(0, -6 * s, 8.5 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    if (got) { ctx.fillStyle = '#b07a43'; roundRect(-2.6 * s, -16.2 * s, 5.2 * s, 2.4 * s, 1.1 * s); ctx.fill(); ctx.stroke(); }
    // body (brushed metal)
    const metal = ctx.createLinearGradient(-8 * s, 0, 8 * s, 0);
    metal.addColorStop(0, got ? '#aeb3bc' : '#5c5c63');
    metal.addColorStop(0.35, got ? '#eef0f3' : '#6e6e76');
    metal.addColorStop(1, got ? '#8d939d' : '#4a4a50');
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -6 * s); ctx.lineTo(8 * s, -6 * s); ctx.lineTo(6.2 * s, 9 * s);
    ctx.quadraticCurveTo(0, 10.4 * s, -6.2 * s, 9 * s); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // ribs
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = s;
    for (const ry of [-1, 4]) {
      const inset = (ry + 6) * 0.12 * s;
      ctx.beginPath(); ctx.moveTo(-7.4 * s + inset, ry * s); ctx.lineTo(7.4 * s - inset, ry * s); ctx.stroke();
    }
    // rim
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * s;
    ctx.fillStyle = got ? '#f2f3f5' : '#77777f';
    ctx.beginPath(); ctx.ellipse(0, -6 * s, 8.4 * s, 2.7 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (got) {
      // paint surface + shine, and a drip that stretches and shrinks
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, -5.8 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(-2.6 * s, -6.3 * s, 2 * s, 0.6 * s, -0.1, 0, Math.PI * 2); ctx.fill();
      drawDrip(5.2 * s, -5 * s, (5 + Math.sin(t * 2 + x * 0.01) * 1.2) * s, color, 1.1 * s);
    }
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
      // tiny monsters (yellow) are drawn at full size, then scaled down around their feet
      const big = MONSTERS[m.type], k = m.w / big.w;
      ctx.save();
      if (k !== 1) { ctx.translate(m.x + m.w / 2, m.y + m.h); ctx.scale(k, k); ctx.translate(-(m.x + m.w / 2), -(m.y + m.h)); }
      const x = m.x + m.w / 2 - big.w / 2 + shake, y = m.y + m.h - big.h, mw = big.w, mh = big.h;

      ART.shadow(ctx, x + mw / 2, y + mh, mw * 0.55);
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
      ctx.fillStyle = ART.inkPattern(ctx);
      ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
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
      ctx.restore();
    }
  }

  function drawFlag(w) {
    const f = w.level.flag;
    SHOP.drawFlag(ctx, look().flag, f.c * T + T / 2 - 6, f.r * T + T, 0.92, game.tick / 60);
  }


  function drawPlayer(w) {
    const p = w.player;
    if (w.state === 'dead') return;
    const k = p.h / 40;                       // 1 when big, ~0.45 when small
    const wall = p.cling === 1 || p.cling === -1;
    const moving = p.cling ? (Math.abs(p.vx) + Math.abs(p.vy) > 0.3 ? 1 : 0)
      : p.grounded ? Math.min(1, Math.abs(p.vx) / RUN) : 0;
    const o = {
      s: k, col: COLOR_HEX[game.color], t: game.tick / 60, run: runPhase, moving,
      air: !p.grounded && p.cling !== 2, face: wall ? p.cling : p.face, squash: p.cling ? 1 : squash,
    };
    if (p.grounded && !p.cling) ART.shadow(ctx, p.x + p.w / 2, p.y + p.h, p.w * 0.6);
    ctx.save();
    if (p.cling === 2) {                      // hanging from a green ceiling: upside down, feet on the ceiling
      ctx.translate(p.x + p.w / 2, p.y);
      ctx.scale(1, -1);
    } else {
      ctx.translate(p.x + p.w / 2, p.y + p.h);
    }
    SHOP.drawHero(ctx, currentCharacter(), o, look());
    ctx.restore();
  }

  function drawCosmetics(w) {
    SHOP.drawTrail(ctx, heroTrail, look().trail, w.player.h / 40, game.tick / 60);
    for (const sm of splatMarks) {
      ctx.globalAlpha = Math.min(1, sm.life);
      SHOP.drawSplat(ctx, look().splat, sm.x, sm.y, 7, sm.col, sm.seed);
    }
    ctx.globalAlpha = 1;
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
      if (w.solid(c, r) || w.tile(c, r) === '^' || w.tile(c, r) === 'L') break;
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
    text(`${(w.state === 'won' && w.finishTime !== null ? w.finishTime : w.frame / 60).toFixed(3)}s`, W - 12, 15, 15, '#fff', 'right');
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
      const tw = Math.max(180, game.toast.str.length * 8 + 30);
      roundRect(W / 2 - tw / 2, 44, tw, 32, 10); ctx.fill();
      text(game.toast.str, W / 2, 60, 15, '#fff', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawWorld(w) {
    drawBackground();
    drawTiles(w);
    drawLava(w);
    drawPlatforms(w);
    drawPortals(w);
    drawCans(w);
    drawFlag(w);
    drawMonsters(w);
    drawCosmetics(w);
    drawBlobs(w);
    drawPlayer(w);
    SHOP.drawBurst(ctx, pops, look().pop);
    drawParticles();
    ART.vignette(ctx);
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
    ctx.drawImage(ART.plainPaper(), 0, 0);
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
    // your hero, standing next to the level picker
    ctx.save();
    ctx.translate(W / 2 - 280, 418);
    currentCharacter().draw(ctx, { s: 1.5, col: COLOR_HEX[ALL_COLORS[Math.floor(game.tick / 90) % ALL_COLORS.length]], t: game.tick / 60, run: 0, moving: 0, air: false, face: 1, squash: 1 + Math.sin(game.tick * 0.05) * 0.02 });
    ctx.restore();
    text(currentCharacter().name, W / 2 - 280, 434, 12, INK, 'center', 700);

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
    text(best ? `${'★'.repeat(st)}${'☆'.repeat(3 - st)}   Best: ${best.toFixed(3)}s` : 'Not cleared yet', W / 2 + 40, 412, 13, best ? '#ffd166' : 'rgba(255,255,255,0.65)', 'center', 600);

    if (Math.floor(game.tick / 30) % 2 === 0) text('Press ENTER or click to play  ·  L leaderboards  ·  C characters  ·  S store', W / 2, 462, 16, INK, 'center', 700);

    text(`★ ${totalStars()} / ${LEVELS.length * 3} stars        ${drops().toLocaleString()} Paint Drops`, W / 2, 492, 15, INK, 'center', 800);
    ctx.font = '800 15px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
    const dropsW = ctx.measureText(`${drops().toLocaleString()} Paint Drops`).width;
    const fullW = ctx.measureText(`★ ${totalStars()} / ${LEVELS.length * 3} stars        ${drops().toLocaleString()} Paint Drops`).width;
    SHOP.drawDrop(ctx, W / 2 + fullW / 2 - dropsW - 12, 493, 6);
    text('A/D move · W/Space jump · Mouse aim · Click throw · Right-click wash · 1-5 colors · M music · F full screen', W / 2, H - 22, 12, INK, 'center', 500);
    if (game.toast) text(game.toast.str, W / 2, 30, 14, INK, 'center', 600);
  }

  function totalStars() {
    return LEVELS.reduce((n, l) => n + (game.stars[l.name] || 0), 0);
  }

  // ---- Paint Drops ----
  const drops = () => game.wallet.earned - game.wallet.spent;
  const saveWallet = () => store.set('wallet', game.wallet);
  const look = () => game.wallet.equipped;
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // What finishing a level earns. Called before the level's bests are updated.
  function earnDrops(key, { firstClear, newCans, isBest, stomps }) {
    const rows = [];
    const wl = game.wallet;
    const clears = wl.clears[key] || 0;
    if (firstClear) rows.push(['First clear', 50]);
    else rows.push(['Cleared again', [10, 5, 2][Math.min(clears - 1, 2)] ?? 2]);
    if (newCans > 0) rows.push([`New can${newCans > 1 ? 's' : ''} × ${newCans}`, 25 * newCans]);
    if (isBest && !firstClear) rows.push(['New best time', 15]);
    if (wl.daily !== todayKey()) { rows.push(['First level today', 30]); wl.daily = todayKey(); }
    if (stomps > 0) rows.push([`Stomps × ${stomps}`, stomps]);
    wl.clears[key] = clears + 1;
    const total = rows.reduce((n, r) => n + r[1], 0);
    wl.earned += total;
    saveWallet();
    return { rows, total };
  }

  function buyItem(id) {
    const it = SHOP.byId[id];
    if (!it || game.wallet.owned.includes(id) || drops() < it.price.drops) return false;
    game.wallet.spent += it.price.drops;
    game.wallet.owned.push(id);
    equipItem(id);
    sfx.can();
    return true;
  }
  function equipItem(id, on = true) {
    const it = SHOP.byId[id];
    if (!it || !game.wallet.owned.includes(id)) return false;
    if (on) game.wallet.equipped[it.cat] = id; else delete game.wallet.equipped[it.cat];
    game.wallet.equippedAt = Date.now();
    saveWallet();
    if (online() && Cloud.user) Cloud.saveProfile(localProgress(), LEVELS).catch(() => { });
    return true;
  }

  // ---- characters ----
  const isUnlocked = (c) => totalStars() >= c.stars;
  function currentCharacter() {
    const c = CHARACTERS.find((x) => x.id === game.character);
    return c && isUnlocked(c) ? c : CHARACTERS[0];
  }
  function setCharacter(id) {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c || !isUnlocked(c)) return false;
    game.character = id;
    store.set('character', id);
    return true;
  }

  // Dark overlay with centered lines of text. Returns the y of the first line.
  function drawPanel(lines, step = 42) {
    ctx.fillStyle = 'rgba(15,15,18,0.82)';
    ctx.fillRect(0, 0, W, H);
    const y0 = H / 2 - ((lines.length - 1) * step) / 2;
    lines.forEach(([str, size, color, weight], i) => text(str, W / 2, y0 + i * step, size, color, 'center', weight));
    return y0;
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
        const e = r.earned || { rows: [], total: 0 };
        const k = Math.min(1, (game.tick - (r.at || 0) - 30) / 60);          // the Drops count up after half a second
        const shown = Math.round(e.total * Math.max(0, k));
        if (k > 0 && k < 1 && game.tick % 4 === 0) sfx.select();
        const y0 = drawPanel([
          ['Level complete!', 46, '#fff', 900],
          ['', 34, '#ffd166', 900],   // the three paint cans are drawn across these two rows, below
          ['', 34, '#ffd166', 900],
          [`Time ${r.time.toFixed(3)}s${r.isBest ? '  ★ new best' : ''}`, 21, r.isBest ? '#ffd166' : '#fff', 600],
          [`Paint thrown: ${r.throws}   ·   Falls: ${r.deaths}`, 16, 'rgba(255,255,255,0.75)', 500],
          [`+${shown}  Paint Drops`, 26, '#7cc4ff', 900],
          [e.rows.map(([label, n]) => `${label} +${n}`).join('   ·   '), 13, 'rgba(255,255,255,0.65)', 600],
          cloudLine(r),
          r.unlockedNow && r.unlockedNow.length
            ? [`New character unlocked: ${r.unlockedNow.map((c) => c.name).join(' & ')}!  Press C to try it`, 16, '#7cf29c', 800]
            : ['', 14, '#fff', 500],
          ['ENTER: next level   ·   R: retry   ·   S: store   ·   Esc: menu', 15, 'rgba(255,255,255,0.6)', 500],
        ], 40);
        [0, 1, 2].forEach((i) => drawCan(W / 2 - 56 + i * 56, y0 + 62, 1.6, i < r.stars, COLOR_HEX[ALL_COLORS[i]]));
        if (r.newStars) text('new record!', W / 2 + 96, y0 + 62, 16, '#ffd166', 'left', 800);
        // a drop next to the total
        ctx.font = '900 26px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
        const tw = ctx.measureText(`+${shown}  Paint Drops`).width;
        SHOP.drawDrop(ctx, W / 2 - tw / 2 - 20, y0 + 5 * 40 + 2, 8);
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
    if (embedded && !hasFocus) {
      ctx.globalAlpha = 0.9 + Math.sin(game.tick * 0.08) * 0.1;
      ctx.fillStyle = 'rgba(28,28,31,0.88)';
      roundRect(W / 2 - 170, H / 2 - 26, 340, 52, 14); ctx.fill();
      text('Click the game to use the keyboard', W / 2, H / 2, 18, '#fff', 'center', 800);
      ctx.globalAlpha = 1;
    }
    drawCursor();
  }

  // Handy for poking at the game from the browser console.
  // debug/tools: advance(n) runs n fixed steps and draws once (used for trailers and screenshots)
  window.paintRunner = { game, startLevel, advance(n = 1) { for (let k = 0; k < n; k++) update(); render(); } };

  if (typeof UI !== 'undefined') {
    UI.init({
      toast: showToast,
      toggleFullscreen,
      characters: () => CHARACTERS.map((c) => ({ ...c, unlocked: isUnlocked(c), selected: c === currentCharacter() })),
      setCharacter,
      totalStars,
      currentCharacter: () => currentCharacter(),
      wallet: () => ({ drops: drops(), owned: [...game.wallet.owned], equipped: { ...game.wallet.equipped } }),
      buyItem,
      equipItem,
      paintColors: () => ALL_COLORS.map((c) => COLOR_HEX[c]),
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
    Sound.setTrack(game.mode === 'play' || game.mode === 'complete' ? 'level' : 'theme');
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
