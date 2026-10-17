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
  // Touch button size (see #touchpad in style.css): follows the screen height.
  function touchButtonSize() {
    const tb = Math.round(Math.max(56, Math.min(84, window.innerHeight * 0.2)));
    document.documentElement.style.setProperty('--tb', tb + 'px');
  }
  let scale = 1, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    touchButtonSize();
    // as big as fits the visible screen, same shape (phones: the visible area, not the "full" height
    // that includes space under the address bar)
    const vv = window.visualViewport, vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
    document.body.style.height = vh + 'px';
    scale = Math.min(vw / W, vh / H);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.floor(W * scale * dpr);
    canvas.height = Math.floor(H * scale * dpr);
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
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
  if (embedded) window.addEventListener('resize', grabFocus);   // the page around us made us full screen (or back)
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
  const uiBusy = () => (typeof UI !== 'undefined' && UI.modalOpen) || (typeof Story !== 'undefined' && Story.playing);
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
    if (typeof UI !== 'undefined' && UI.swallowPress) return;   // that press just closed the account menu
    toGame(e); Sound.init();
    // preventDefault below would stop the click from giving us the keyboard, so take it ourselves.
    // A click that only brings the keyboard back doesn't throw paint (it would cost a throw).
    const hadFocus = hasFocus;
    grabFocus();
    e.preventDefault();
    if (embedded && !hadFocus && game.mode === 'play') return;
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

  // ---------- touch controls (phones and tablets; add #touch to the address to try them on a computer) ----------
  // ◀ ▶ at the far left and JUMP at the far right edge of the screen, see-through so the level shows
  // behind them. Starting a level goes full screen (where the browser allows). Touch the level to throw paint toward your
  // finger; hold to keep throwing. Tap a color chip to switch colors, the 🧽 chip to wash.
  // Menu and Restart are in the top bar.
  const touchMode = DEVICE !== 'computer' || /[#?&]touch/.test(location.href);
  document.body.classList.toggle('touch', touchMode);
  const pad = document.createElement('div');
  pad.id = 'touchpad';
  pad.innerHTML = '<div class="tbtn" data-k="ArrowLeft">◀</div><div class="tbtn" data-k="ArrowRight">▶</div>' +
    '<div class="tbtn small" data-k="ArrowUp">▲</div><div class="tbtn small" data-k="ArrowDown">▼</div>' +   // climb green walls, drop from ceilings
    // Menu and Restart live down here, not in the top bar: on itch.io's mobile page its own toolbar covers the top edge
    '<div class="tbtn mini" data-k="Escape" aria-label="Menu">☰</div><div class="tbtn mini" data-k="KeyR" aria-label="Restart">↺</div>' +
    '<div class="joy" aria-hidden="true"><i class="joy-knob"></i></div>' +
    '<div class="joy joy-r" aria-hidden="true"><i class="joy-knob"></i></div>' +   // Twin Tap / Twin Stick: aiming
    '<div class="tbtn jump" data-k="Space">▲<small>JUMP</small></div>' +
    '<div class="palette"><div class="pal-btn" aria-label="Choose a color"></div></div>';
  if (touchMode) document.body.appendChild(pad);
  const padBtn = (k) => pad.querySelector(`[data-k="${k}"]`);
  // Three control schemes, chosen in ⚙️ Settings on the menu (saved on this device):
  //   classic   - joystick moves, JUMP button, touch the level to throw (hold to keep throwing)
  //   twintap   - left stick moves (tap it to throw, hold to keep throwing); right stick aims (tap it to jump)
  //   twinstick - left stick moves; right stick aims and throws while pushed; JUMP button beside it
  // In every scheme, touching the level still throws at that spot.
  // Classic can use four direction buttons instead of the stick: add #dpad to the address.
  const SCHEMES = ['classic', 'twintap', 'twinstick'];
  let scheme = (() => { try { const s = localStorage.getItem('paintRunner.controls'); return SCHEMES.includes(s) ? s : 'classic'; } catch (e) { return 'classic'; } })();
  const dpadWanted = /[#&?]dpad/.test(location.href);
  const twin = () => scheme !== 'classic';
  const stickMode = () => twin() || !dpadWanted;
  function applyScheme() {
    pad.dataset.scheme = scheme;
    pad.classList.toggle('joystick', stickMode());
  }
  const joy = pad.querySelector('.joy:not(.joy-r)'), knob = joy.querySelector('.joy-knob');
  const joyR = pad.querySelector('.joy-r'), knobR = joyR.querySelector('.joy-knob');
  applyScheme();
  function setScheme(s) {
    if (!SCHEMES.includes(s)) return;
    scheme = s;
    try { localStorage.setItem('paintRunner.controls', s); } catch (e) { /* ignore */ }
    touches.clear(); stickFiring = false; tapFire = 0; mouse.down = mouse.right = false;
    applyScheme(); syncTouchKeys();
  }
  const touches = new Map();          // touch id -> { role, sx, sy (screen), x, y (game) }
  const touchKeys = new Set();        // keys currently held down by touch buttons
  let touchWash = false;              // the 🧽 chip: throws wash paint off instead of painting
  let aimAngle = null;                // the right stick's aim (radians); null = forward and a bit up
  let jumpTapUntil = 0;               // Twin Tap: hold JUMP this long after a tap on the right stick
  let stickFiring = false;            // a stick is throwing paint right now (Twin Tap hold / Twin Stick push)
  const touchAim = () => [...touches.values()].some((t) => t.role === 'aim' || (t.role === 'raim' && t.moved)) || stickFiring;
  const toGamePt = (t) => { const r = canvas.getBoundingClientRect(); return { x: (t.clientX - r.left) / r.width * W, y: (t.clientY - r.top) / r.height * H }; };
  const onCanvas = (t) => { const r = canvas.getBoundingClientRect(); return t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom; };
  // Forgiving touch zones around the buttons: anything from the screen's left edge to a bit past ▶,
  // from a bit above the buttons down to the bottom, moves; the same at the right edge jumps.
  const DIRS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  function inMoveZone(t) {
    if (stickMode()) {        // anywhere in the bottom-left corner grabs the stick
      const j = joy.getBoundingClientRect();
      return t.clientX <= j.right + 30 && t.clientY >= j.top - 30;
    }
    const r = padBtn('ArrowRight').getBoundingClientRect(), u = padBtn('ArrowUp').getBoundingClientRect();
    return t.clientX <= r.right + 20 && t.clientY >= u.top - u.height * 0.5;
  }
  // The joystick: where the thumb is, relative to the middle of the ring, gives the directions.
  // Up/down need a firmer push than left/right, so running never presses "down" by accident
  // (down stops blue bounces).
  // the right stick's corner (Twin Tap / Twin Stick)
  function inAimZone(t) {
    const j = joyR.getBoundingClientRect();
    return twin() && t.clientX >= j.left - 30 && t.clientY >= j.top - 30;
  }
  // How far a stick is pushed: Classic measures from the middle of the ring; the twin schemes from
  // where the thumb landed (so a tap is always a clean tap).
  function stickOffset(t, ring) {
    if (twin()) return [t.sx - t.ox, t.sy - t.oy];
    const j = ring.getBoundingClientRect();
    return [t.sx - (j.left + j.width / 2), t.sy - (j.top + j.height / 2)];
  }
  function showKnob(k, ring, dx, dy) {
    const R = ring.getBoundingClientRect().width / 2, d = Math.hypot(dx, dy) || 1, m = Math.min(1, R * 0.62 / d);   // the knob stays inside the ring
    k.style.transform = `translate(${(dx * m).toFixed(1)}px, ${(dy * m).toFixed(1)}px)`;
  }
  function joyDirs(t, want) {
    const j = joy.getBoundingClientRect(), R = j.width / 2;
    const [dx, dy] = stickOffset(t, joy), d = Math.hypot(dx, dy) || 1;
    if (d > R * 0.28) t.moved = true;                          // (Twin Tap: a push, not a tap)
    const k = Math.min(1, R * 0.62 / d);                       // the knob stays inside the ring
    knob.style.transform = `translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)`;
    if (dx < -R * 0.28) want.add('ArrowLeft');
    if (dx > R * 0.28) want.add('ArrowRight');
    if (dy < -R * 0.5) want.add('ArrowUp');
    if (dy > R * 0.5) want.add('ArrowDown');
  }
  // which direction button a finger in the move zone means: the nearest one
  function dirAt(t) {
    let best = null, bd = Infinity;
    for (const k of DIRS) {
      const b = padBtn(k).getBoundingClientRect(), d = Math.hypot(t.sx - (b.left + b.width / 2), t.sy - (b.top + b.height / 2));
      if (d < bd) { best = k; bd = d; }
    }
    return best;
  }
  function inJumpZone(t) {
    const j = padBtn('Space').getBoundingClientRect();
    return t.clientX >= j.left - 24 && t.clientY >= j.top - j.height * 0.6;
  }
  const inRect = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y - 4 && p.y <= b.y + b.h + 6;
  // the color chips in the bottom bar (and the wash chip after them), as drawn by drawHud
  // level hints that talk about keys or the mouse, in touch words
  const TOUCH_HINTS = {
    'Up and Up': 'Hold ▼ to land on blue without bouncing. And stay out of the lava!',
    'Hat Check': 'This hat shoots blue at your feet. Bouncing into spikes hurts - 🧽 Wash in the palette cleans paint off.',
    'Two Colors': 'Switch colors with the palette button above JUMP.',
    'Sticky Situation': 'Green is sticky. Grab the wall, climb with ▲ / ▼, JUMP to wall-jump.',
    'Ceiling Walk': 'Paint the ceiling green, jump up, and hang on. ▼ to let go.',
  };
  // where the color chips start: in touch mode, just right of the ▶ button so it never covers one
  function chipStartX() {
    if (!touchMode || !pad.classList.contains('show')) return 12;
    const b = (stickMode() ? joy : padBtn('ArrowRight')).getBoundingClientRect(), r = canvas.getBoundingClientRect();
    return Math.max(12, Math.ceil((b.right + 28 - r.left) / r.width * W));   // past the ▶ touch zone
  }
  function chipAt(p) {
    if (touchMode || !game.world || p.y < H - 40) return null;   // (touch uses the palette)
    let x = chipStartX();
    for (const c of ALL_COLORS) {
      if (!game.world.level.colors.includes(c)) continue;
      if (p.x >= x - 4 && p.x <= x + 74) return c;
      x += 82;
    }
    return null;
  }
  function syncTouchKeys() {
    const want = new Set();
    for (const t of touches.values()) {
      if (t.role === 'move' && !t.firing) { if (stickMode()) joyDirs(t, want); else want.add(dirAt(t)); }   // stick, or slide between the buttons
      if (t.role === 'jump') want.add('Space');
      if (t.role === 'raim') {                                 // right stick: set the aim
        const [dx, dy] = stickOffset(t, joyR), R = joyR.getBoundingClientRect().width / 2;
        showKnob(knobR, joyR, dx, dy);
        if (Math.hypot(dx, dy) > R * 0.25) { t.moved = true; aimAngle = Math.atan2(dy, dx); }
      }
    }
    if (performance.now() < jumpTapUntil) want.add('Space');   // Twin Tap: a tap on the right stick jumps
    for (const k of want) if (!touchKeys.has(k)) { touchKeys.add(k); if (!keys.has(k)) pressed.add(k); keys.add(k); }
    for (const k of [...touchKeys]) if (!want.has(k)) { touchKeys.delete(k); keys.delete(k); }
    for (const el of pad.children) el.classList.toggle('on', touchKeys.has(el.dataset.k));
    if (stickMode() && ![...touches.values()].some((t) => t.role === 'move')) knob.style.transform = '';   // let go: back to the middle
    if (![...touches.values()].some((t) => t.role === 'raim')) knobR.style.transform = '';
    joy.classList.toggle('on', [...touches.values()].some((t) => t.role === 'move'));
    joyR.classList.toggle('on', [...touches.values()].some((t) => t.role === 'raim'));
  }
  const tapMouse = (prop) => { mouse[prop] = true; setTimeout(() => { mouse[prop] = false; }, 60); };
  // touching the level works like holding the mouse button: paint (or wash, with 🧽) keeps flying
  // toward your finger until you lift it
  function holdFire(on) {
    mouse.down = on && !touchWash;
    mouse.right = on && touchWash;
  }
  // Twin schemes: throwing from the sticks, along the right stick's aim (or forward, if never aimed).
  // Twin Tap: tap the left stick for one throw, hold it still to keep throwing. Twin Stick: push the
  // right stick to aim and throw.
  let tapFire = 0;
  function stickFire(w) {
    if (!twin()) return;
    for (const t of touches.values()) {
      if (scheme === 'twintap' && t.role === 'move' && !t.moved && !t.firing && game.tick - t.tick >= 15) t.firing = true;
    }
    const firing = tapFire > 0 || [...touches.values()].some((t) => (scheme === 'twintap' && t.role === 'move' && t.firing) || (scheme === 'twinstick' && t.role === 'raim' && t.moved));
    const aiming = firing || [...touches.values()].some((t) => t.role === 'raim' && t.moved);
    if (aiming) {
      const p = w.player, a = aimAngle !== null ? aimAngle : (p.face > 0 ? -0.35 : Math.PI + 0.35);
      [mouse.x, mouse.y] = toScreen(p.x + p.w / 2 + Math.cos(a) * 300, p.y + p.h * 0.25 + Math.sin(a) * 300);
    }
    if (firing) holdFire(true);
    else if (stickFiring && ![...touches.values()].some((t) => t.role === 'aim')) holdFire(false);
    stickFiring = firing;
    if (tapFire > 0) tapFire--;
  }

  // ---- the color palette (touch only): tap it and the level's colors fan out; tap one, or press the
  //      palette, slide onto a color and let go ----
  const palette = pad.querySelector('.palette'), palBtn = pad.querySelector('.pal-btn');
  let palOpen = false, palKey = '';
  const within = (t, el, m = 8) => { const r = el.getBoundingClientRect(); return t.clientX >= r.left - m && t.clientX <= r.right + m && t.clientY >= r.top - m && t.clientY <= r.bottom + m; };
  const palOptions = () => [...palette.querySelectorAll('.pal-opt')];
  function palOptionAt(t) {
    if (!palOpen) return null;
    // the nearest option within reach (forgiving for thumbs), measured where the options end up -
    // not where they are mid-animation
    const b = palette.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;   // (the button itself shrinks when open)
    const tb = b.width / 0.82, reach = tb * 0.54 * 1.0;
    let best = null, bd = Infinity;
    for (const el of palOptions()) {
      const d = Math.hypot(t.clientX - (cx + el.dataset.fx * tb), t.clientY - (cy + el.dataset.fy * tb));
      if (d < reach && d < bd) { best = el; bd = d; }
    }
    return best;
  }
  function setPalOpen(on) { palOpen = on; palette.classList.toggle('open', on); if (!on) palOptions().forEach((el) => el.classList.remove('hover')); }
  function choosePal(el) {
    const c = el.dataset.c;
    if (c === 'wash') touchWash = true; else { game.color = Number(c); touchWash = false; }
    sfx.select();
    setPalOpen(false);
  }
  // (re)builds the fan for this level's colors and shows the current one on the button
  function updatePalette() {
    if (!game.world) return;
    const cols = game.world.level.colors;
    const portals = game.color === PURPLE && !touchWash ? '●'.repeat(game.world.portals.length) + '○'.repeat(2 - game.world.portals.length) : '';
    const key = cols.join() + '|' + game.color + '|' + touchWash + '|' + portals;
    if (key === palKey) return;
    const rebuild = !palKey.startsWith(cols.join() + '|');
    palKey = key;
    const ring = cols.map((c) => COLOR_HEX[c]);
    palBtn.style.setProperty('--cur', touchWash ? '#e8e4da' : COLOR_HEX[game.color]);
    // the ring: one clear segment per color this level has (small gaps between), so it shows what's available
    const gap = ring.length > 1 ? 4 : 0, seg = 360 / ring.length;
    const stops = ring.map((c, i) => `${c} ${i * seg + gap / 2}deg ${(i + 1) * seg - gap / 2}deg, rgba(0,0,0,0) ${(i + 1) * seg - gap / 2}deg ${(i + 1) * seg + gap / 2}deg`);
    palBtn.style.setProperty('--ring', `conic-gradient(from -90deg, rgba(0,0,0,0) 0deg ${gap / 2}deg, ${stops.join(', ')})`);
    palBtn.textContent = touchWash ? '🧽' : portals;   // purple: how many portals are placed
    if (rebuild) {
      palOptions().forEach((el) => el.remove());
      const items = [...cols.map((c) => ({ c, hex: COLOR_HEX[c], label: c === PURPLE ? 'Portal' : COLOR_NAME[c] })), { c: 'wash', hex: '#e8e4da', label: 'Wash' }];
      // a fan from straight up, sweeping left and down toward the screen
      const step = Math.min(30, 140 / Math.max(1, items.length - 1));
      items.forEach((it, i) => {
        const a = (266 - i * step) * Math.PI / 180;
        const el = document.createElement('div');
        el.className = 'pal-opt' + (it.c === 'wash' ? ' wash' : '');
        el.dataset.c = it.c;
        el.dataset.fx = (Math.cos(a) * 1.9).toFixed(3); el.dataset.fy = (Math.sin(a) * 1.9).toFixed(3);   // final offset, in button sizes
        el.style.setProperty('--hex', it.hex);
        el.style.setProperty('--dx', `calc(var(--tb) * ${(Math.cos(a) * 1.9).toFixed(3)})`);
        el.style.setProperty('--dy', `calc(var(--tb) * ${(Math.sin(a) * 1.9).toFixed(3)})`);
        el.style.transitionDelay = `${i * 22}ms`;
        el.innerHTML = it.c === 'wash' ? '🧽' : '';
        el.title = it.label;
        palette.appendChild(el);
      });
    }
    palOptions().forEach((el) => el.classList.toggle('current', el.dataset.c === (touchWash ? 'wash' : String(game.color))));
  }
  // touches on the menu buttons and windows (store, leaderboards...) are left to the page
  const forPage = (e) => e.target.closest && e.target.closest('#overlay, .modal-back, #splash');
  if (touchMode) {
    document.addEventListener('touchstart', (e) => {
      if (forPage(e)) return;
      e.preventDefault(); Sound.init(); grabFocus();
      for (const t of e.changedTouches) {
        const sp = { sx: t.clientX, sy: t.clientY }, p = toGamePt(t);
        if (game.mode !== 'play') {
          if (!onCanvas(t) || (typeof UI !== 'undefined' && UI.swallowPress)) continue;
          if (game.mode === 'title' && p.y > 362 && p.y < 434 && (p.x < 420 || p.x > 540)) { pressed.add(p.x < 420 ? 'ArrowLeft' : 'ArrowRight'); continue; }   // ◀ ▶ around the level name
          const pb = game.mode === 'complete' && panelButtons.find((b) => inRect(p, b));
          if (pb) { pressed.add(pb.key); continue; }                                         // Menu / Retry / Next on the level-complete screen
          mouse.x = p.x; mouse.y = p.y; tapMouse('down');                                   // menus: a tap is a click
          if (!(document.fullscreenElement || document.webkitFullscreenElement)) toggleFullscreen();   // phones: play full screen
          continue;
        }
        let role = 'none';
        if (palOpen) {                                     // open fan: pick a color, or close it
          const opt = palOptionAt(t);
          if (opt) choosePal(opt); else setPalOpen(false);
          touches.set(t.identifier, { role: 'none', ...sp, ...p });
          continue;
        }
        if (within(t, palBtn, 10)) {                       // open the fan (you can slide straight onto a color)
          setPalOpen(true);
          touches.set(t.identifier, { role: 'palette', ...sp, ...p });
          continue;
        }
        if (within(t, padBtn('Escape'), 6)) pressed.add('Escape');         // ☰ menu
        else if (within(t, padBtn('KeyR'), 6)) pressed.add('KeyR');        // ↺ restart
        else if (scheme === 'twinstick' && within(t, padBtn('Space'), 10)) role = 'jump';
        else if (inMoveZone(t)) role = 'move';
        else if (inAimZone(t)) role = 'raim';
        else if (scheme === 'classic' && inJumpZone(t)) role = 'jump';
        else if (onCanvas(t)) {
          if (chipAt(p) !== null) { game.color = chipAt(p); touchWash = false; sfx.select(); }
          else if (p.y >= 30 && p.y <= H - 40) role = 'aim';                              // not on the HUD bars
        }
        touches.set(t.identifier, { role, ...sp, ...p, tick: game.tick, ox: t.clientX, oy: t.clientY, moved: false, firing: false });
        if (role === 'aim') { mouse.x = p.x; mouse.y = p.y; holdFire(true); }   // fire now, and keep firing while held
      }
      syncTouchKeys();
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (forPage(e)) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        const o = touches.get(t.identifier); if (!o) continue;
        Object.assign(o, { sx: t.clientX, sy: t.clientY }, toGamePt(t));
        if (o.role === 'aim') { mouse.x = o.x; mouse.y = o.y; }
        if (o.role === 'palette') { const opt = palOptionAt(t); palOptions().forEach((el) => el.classList.toggle('hover', el === opt)); }
      }
      syncTouchKeys();
    }, { passive: false });
    const end = (e) => {
      let mine = false;
      for (const t of e.changedTouches) {
        const o = touches.get(t.identifier); if (!o) continue;
        mine = true;
        touches.delete(t.identifier);
        if (o.role === 'aim') {
          mouse.x = o.x; mouse.y = o.y;
          // a very quick tap still throws once: keep the button down until the game has seen it
          if (game.tick - o.tick < 2) setTimeout(() => { if (!touchAim()) holdFire(false); }, 40);
          else if (!touchAim()) holdFire(false);
        }
        const quick = game.tick - o.tick < 15;           // a tap, not a hold (about a quarter second)
        if (scheme === 'twintap' && o.role === 'move' && !o.moved && !o.firing && quick && game.mode === 'play') {
          tapFire = 3;                                   // tap on the left stick: throw once
        }
        if (scheme === 'twintap' && o.role === 'raim' && !o.moved && quick && game.mode === 'play') {
          jumpTapUntil = performance.now() + 300;        // tap on the right stick: a full jump
          setTimeout(syncTouchKeys, 320);
        }
        if (o.role === 'palette') {                     // slid onto a color: pick it; let go on the button: stay open for a tap
          const last = { clientX: o.sx, clientY: o.sy };  // where the finger last was
          const opt = palOptionAt(last);
          if (opt) choosePal(opt); else if (!within(last, palBtn, 14)) setPalOpen(false);
        }
      }
      if (mine) { e.preventDefault(); syncTouchKeys(); }
    };
    document.addEventListener('touchend', end, { passive: false });
    document.addEventListener('touchcancel', end, { passive: false });
  }
  // the buttons only show while playing (and not behind a window or the "turn sideways" screen)
  function showTouchpad() {
    const on = touchMode && game.mode === 'play' && !(typeof UI !== 'undefined' && UI.modalOpen) && innerWidth > innerHeight;
    if (pad.classList.contains('show') !== on) pad.classList.toggle('show', on);
    if (!on && palOpen) setPalOpen(false);
    if (on) updatePalette();
  }


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
  // The level picker opens up to your first unbeaten level - or past the furthest level you've
  // beaten, so levels added along the way (the boss chases) never lock away what you'd reached.
  function refreshUnlocked() {
    const first = LEVELS.findIndex((l) => game.best[l.name] === undefined);
    let last = -1;
    LEVELS.forEach((l, i) => { if (game.best[l.name] !== undefined) last = i; });
    game.unlocked = Math.min(LEVELS.length - 1, Math.max(first < 0 ? LEVELS.length - 1 : first, last + 1));
  }
  refreshUnlocked();
  game.menuIdx = game.unlocked;

  let particles = [];
  let squash = 1;
  let runPhase = 0;   // where the feet are in their step cycle
  let heroTrail = SHOP.makeTrail(), splatMarks = [], pops = [], stains = [];
  let prevJumpHeld = false;

  function startLevel(i) {
    levelColors = new Set(); ceilingFrames = 0;
    if (new Date().getHours() === 18) Achievements.unlock('dinner-time');   // 6 to 7 pm
    Achievements.playedToday();
    game.levelIdx = i;
    game.world = new World(LEVELS[i]);
    game.mode = 'play';
    Ghost.resetRecording(); Ghost.record(game.world);
    ART.resetLevel(game.world.level.w, game.world.level.h);
    if (eraserPreset && game.world.level.chase) showToast(`Eraser: ${eraserPreset.name}`, 2000);
    stepCamera(game.world, true);
    loadGhost(i);
    game.color = LEVELS[i].colors[0];
    game.runStomps = 0;
    heroTrail = SHOP.makeTrail();
    splatMarks = [];
    stains = [];
    pops = [];
    particles = [];
    squash = 1;
    resetHero();
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
    achEvents(world);
    for (const ev of world.events) {
      switch (ev.type) {
        case 'jump': sfx.jump(); squash = 1.25; puff(ev.x, ev.y, 3, 0.7); break;
        case 'bounce': sfx.bounce(); squash = 1.4; burst(ev.x, ev.y, COLOR_HEX[BLUE], 10, 3, 3); ART.poke(ev.x, ev.y, 1.2); cam.punch = Math.max(cam.punch, 0.05); break;
        case 'throw': sfx.throw(); hero.recoil = 1; break;
        case 'splat':
          if (ev.color && !ev.quiet) {                     // paint splatter stays on the paper for the whole level
            stains.push(ART.makeStain(ev.x, ev.y, COLOR_HEX[ev.color]));
            if (stains.length > 60) stains.shift();
            if (ev.painted) ART.bloom(ev.x, ev.y, COLOR_HEX[ev.color], surfaceAlong(world, ev.x, ev.y));   // the color soaks into the paper around it
          }
          if (ev.painted && look().splat) splatMarks.push({ x: ev.x, y: ev.y, col: ev.color ? COLOR_HEX[ev.color] : '#f4f1ea', life: 1.4, seed: Math.random() * 6 });
          if (ev.quiet) { /* yellow shot hit the player; grow/shrink plays instead */ }
          else if (ev.painted) sfx.splat(); else sfx.clank();
          burst(ev.x, ev.y, ev.color ? COLOR_HEX[ev.color] : '#f4f1ea', ev.painted ? 14 : 6, 3.5, 4);
          break;
        case 'stick': sfx.stick(); break;
        case 'land': {
          // the harder the fall, the flatter the squash and the bigger the dust; a really big drop leaves you seeing stars
          sfx.land();
          const k = Math.min(1, (ev.v - 4) / 9);
          squash = 0.82 - k * 0.22;
          puff(ev.x, ev.y, 3 + Math.round(k * 6), 0.8 + k * 0.8);
          ART.poke(ev.x, ev.y, 0.5 + k);
          if (ev.v >= MAX_FALL - 0.5) hero.dizzy = 1.2;
          break;
        }
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
        case 'stomp': game.runStomps++; sfx.stomp(); squash = 1.3; game.shake = 4; burst(ev.x, ev.y, INK, 18, 5, 4); game.hitstop = 5; break;
        case 'monsterDie':
          if (ev.cause === 'lava') { sfx.sizzle(); burst(ev.x, ev.y, '#ff8c1a', 16, 4, 4); }
          else { sfx.stomp(); burst(ev.x, ev.y, INK, 14, 4, 4); }
          break;
        case 'stun': sfx.stun(); burst(ev.x, ev.y, paintHex(ev.color), 12, 3, 3); break;
        case 'deflect': sfx.clank(); burst(ev.x, ev.y, paintHex(ev.color), 6, 3, 2); showToast('Same color as its hat - no effect!'); break;
        case 'warn': sfx.warn(); break;
        case 'shoot': sfx.shoot(); break;
        case 'can': sfx.can(); burst(ev.x, ev.y, '#ffd166', 18, 4, 3); break;
        case 'portal': sfx.portal(); burst(ev.x, ev.y, COLOR_HEX[PURPLE], 14, 3, 3); ART.bloom(ev.x, ev.y, COLOR_HEX[PURPLE], surfaceAlong(world, ev.x, ev.y)); break;
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
    if (w.deaths === 0 && LEVELS[game.levelIdx].world >= 3) Achievements.unlock('flawless');   // World 4 (yellow) or later, no falls
    if (w.throws === 1) Achievements.unlock('minimalist');
    if (w.deaths === 0) Achievements.add('cleanRuns');
    achCheck();
    // the run's recording: your own best ghost here, and in your account once it's on the leaderboard
    const ghost = Ghost.finished(time, { char: currentCharacter().id, hat: look().hat, skin: look().skin });
    if (ghost) Ghost.keepMine(key, ghost);
    postResult(game.lastResult, true, ghost);
    game.mode = 'complete';
    // the first level you clear: would you like to race the #1 ghost?
    if (!Ghost.chosen() && typeof UI !== 'undefined') {
      // once the result has sunk in and any achievement cards have gone
      const ask = () => {
        if (game.mode !== 'complete' || Ghost.chosen()) return;
        if (UI.modalOpen || achShowing || achQueue.length) return setTimeout(ask, 500);
        UI.openGhostIntro();
      };
      setTimeout(ask, 1800);
    }
  }

  // ---------- online (leaderboards + stats) ----------
  const online = () => typeof Cloud !== 'undefined' && Cloud.available;

  function postResult(result, completed, ghost) {
    if (!online() || LEVELS[game.levelIdx].test) { result.cloud = null; return; }   // (test levels stay off the boards)
    const lv = LEVELS[game.levelIdx];
    const run = { level: lv.name, levelIdx: game.levelIdx, completed, time: result.time, stars: result.stars, throws: result.throws, deaths: result.deaths, played: game.world ? game.world.playFrames / 60 : result.time };
    Cloud.logRun(run).catch((e) => console.warn('logRun', e.code || e));   // guests too, for the stats
    if (!Cloud.user) { result.cloud = 'signin'; return; }
    if (!completed) return;
    result.cloud = 'saving';
    // keep the star ranking up to date too (total stars, levels cleared)
    Cloud.saveProfile(localProgress(), LEVELS).catch((e) => console.warn('saveProfile', e.code || e));
    Cloud.submitScore(run)
      .then((ranks) => {
        result.cloud = ranks;
        if (ranks && [ranks.fastest, ranks.perfect, ranks.efficient].includes(1)) Achievements.unlock('top-board');
        // now that the time is on the leaderboard, this run can be your ghost for everyone else
        if (ghost) uploadGhost(lv.name, ghost);
      })
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
    if (!online()) return;
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
    return { progress, unlocked: game.unlocked, wallet: game.wallet, ach: Achievements.state() };
  }

  function applyProgress(m) {
    if (m.ach) Achievements.apply(m.ach);
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
    if (achReady) achCheck();
  }

  // Signing out leaves this browser as a fresh guest. The account keeps everything,
  // and signing in again brings it back.
  function resetProgress() {
    Achievements.reset();
    for (const k of ['bestByName', 'starsByName', 'best3ByName', 'fewestByName', 'unlocked', 'wallet', 'character']) {
      try { localStorage.removeItem('paintRunner.' + k); } catch (e) { /* ignore */ }
    }
    Object.assign(game, {
      best: {}, stars: {}, best3: {}, fewest: {}, character: 'blob', lastResult: null,
      wallet: { earned: 0, spent: 0, owned: [], equipped: {}, equippedAt: 0, clears: {}, daily: '' },
    });
    refreshUnlocked();
    game.menuIdx = 0;
    game.mode = 'title';
  }

  // Anyone can play; signing in (optional) saves progress to the account and adds the leaderboards.
  function play(i) { startLevel(i); }

  // ---------- ghosts (recording and playback: ghost.js) ----------
  // The ghost for a level: the fastest recorded run ('top'), or your own best ('mine').
  // Fastest runs are looked up once every few minutes per level; your own come from this device
  // (or your account, if you set them on another one).
  const topGhosts = {};
  let ghostReq = 0;
  function loadGhost(i) {
    const name = LEVELS[i].name, req = ++ghostReq;
    Ghost.use(null);
    const mine = () => {
      const g = Ghost.loadMine(name);
      if (g) { Ghost.use(g, 'Your best'); return true; }
      return false;
    };
    if (Ghost.mode === 'off') return;
    if (Ghost.mode === 'mine' || !online()) {
      if (mine() || Ghost.mode !== 'mine') return;
      if (online() && Cloud.user) {
        Cloud.myGhost(name).then((g) => {
          if (!g || req !== ghostReq) return;
          Ghost.keepMine(name, g);
          Ghost.use(g, 'Your best');
        }).catch(() => { });
      }
      return;
    }
    const show = (r) => {
      if (req !== ghostReq || game.mode !== 'play') return;
      const g = r.ghost;
      if (g) {
        const who = Cloud.user && g.uid === Cloud.user.uid ? 'You' : g.name;
        const isRecord = r.recordTime === null || g.time <= r.recordTime + 0.0005;
        Ghost.use(g, isRecord ? `#1 ${who}` : `Fastest ghost · ${who}`);
      } else if (mine()) {
        showToast('👻 No record ghost here yet - racing your best run', 2200);
      } else {
        showToast('👻 No ghost on this level yet. Set the first one!', 2200);
      }
    };
    const c = topGhosts[name];
    if (c && Date.now() - c.at < 5 * 60000) return show(c);
    Cloud.fastestGhost(name)
      .then((r) => { topGhosts[name] = { ...r, at: Date.now() }; show(r); })
      .catch((e) => { console.warn('ghost', e.code || e); if (req === ghostReq) mine(); });
  }
  // your run becomes your ghost in your account (if it's your fastest there)
  function uploadGhost(name, g) {
    return Cloud.saveGhost(name, g)
      .then((saved) => { Ghost.markUploaded(name, g); if (saved) delete topGhosts[name]; })
      .catch((e) => console.warn('ghost', e.code || e));
  }
  // catch up on runs recorded but never uploaded, once per sign-in, one at a time
  let ghostsSyncedFor = null;
  async function uploadPendingGhosts() {
    if (!online() || !Cloud.user || ghostsSyncedFor === Cloud.user.uid) return;
    ghostsSyncedFor = Cloud.user.uid;
    for (const [name, g] of Ghost.pending(LEVELS.map((l) => l.name))) {
      if (!Cloud.user) return;
      await uploadGhost(name, g);
    }
  }
  if (online()) Cloud.onChange((u) => { if (u) setTimeout(uploadPendingGhosts, 4000); });   // after the progress sync

  function setGhostMode(m) {
    Ghost.setMode(m);
    if (game.mode === 'play') loadGhost(game.levelIdx);
  }

  // a see-through runner in the ghost's own character and hat, with a name tag
  function drawGhost(w) {
    const g = Ghost.current;
    const s = g && Ghost.at(w.frame);
    if (!s) return;
    const small = s.fl & Ghost.SMALL, sz = SIZES[small ? 'small' : 'big'], k = sz.h / 40;
    const cling = (s.fl >> 4) & 3;   // 1 right wall, 2 left wall, 3 ceiling
    const ch = CHARACTERS.find((c) => c.id === g.char) || CHARACTERS[0];
    const fade = s.done ? 0.5 : 1;
    const o = {
      s: k, col: '#e9e6df', t: game.tick / 60, run: (game.tick / 14) % 1, moving: s.fl & Ghost.MOVING ? 1 : 0,
      air: !!(s.fl & Ghost.AIR), face: cling === 1 ? 1 : cling === 2 ? -1 : s.fl & Ghost.LEFT ? -1 : 1, squash: 1,
    };
    ctx.save();
    ctx.globalAlpha = 0.38 * fade;
    if (cling === 3) { ctx.translate(s.x + sz.w / 2, s.y); ctx.scale(1, -1); } else ctx.translate(s.x + sz.w / 2, s.y + sz.h);
    SHOP.drawHero(ctx, ch, o, { hat: g.hat, skin: g.skin });
    ctx.restore();
    // name tag
    const tag = s.done ? `👻 ${g.time.toFixed(3)}s` : `👻 ${g.label}`;
    ctx.save();
    ctx.globalAlpha = 0.75 * fade;
    ctx.font = '700 11px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
    const tw = ctx.measureText(tag).width + 12, tx = s.x + sz.w / 2, ty = (cling === 3 ? s.y + sz.h + 14 : s.y - 16);
    ctx.fillStyle = 'rgba(20,20,24,0.75)';
    roundRect(tx - tw / 2, ty - 8, tw, 16, 8); ctx.fill();
    text(tag, tx, ty + 0.5, 11, '#fff', 'center', 700);
    ctx.restore();
  }

  // ---------- achievements (list and saving: achievements.js) ----------
  let levelColors = new Set(), lastBounceTick = -999, ceilingFrames = 0;
  function achContext() {
    const names = LEVELS.map((l) => l.name), cleared = (n) => game.best[n] !== undefined;
    return {
      cleared: names.filter(cleared).length,
      stars: totalStars(),
      perfectLevels: names.filter((n) => (game.stars[n] || 0) >= 3).length,
      worldFirsts: [0, 1, 2, 3, 4, 5].map((k) => LEVELS.find((l) => l.world === k && !l.boss)).filter((l) => l && cleared(l.name)).length,
      fastLevels: names.filter((n) => cleared(n) && game.best[n] < 10).length,
      spent: game.wallet.spent || 0,
      drops: drops(),
      outfit: ['hat', 'trail', 'skin', 'splat', 'flag'].filter((c) => game.wallet.equipped[c]).length,
      owned: game.wallet.owned.filter((id) => id !== 'trophy').length,
      finalePerfect: LEVELS.filter((l) => l.world === 5).filter((l) => (game.stars[l.name] || 0) >= 3).length,
      charsUnlocked: CHARACTERS.filter((c) => totalStars() >= c.stars).length,
    };
  }
  // everything that can be worked out from progress (also catches up on things done before achievements existed)
  function achCheck() {
    if (LEVELS[0] && game.best[LEVELS[0].name] !== undefined) Achievements.unlock('off-we-go');
    if (game.wallet.owned.some((id) => id !== 'trophy')) Achievements.unlock('window-shopper');
    Achievements.check(achContext());
  }
  function achEvents(w) {
    for (const ev of w.events) {
      switch (ev.type) {
        case 'throw':
          if (ev.color === NONE) Achievements.add('washes');
          else {
            Achievements.unlock('first-splash');
            levelColors.add(ev.color);
            if (levelColors.size >= 5) Achievements.unlock('rainbow-hands');
          }
          Achievements.max('mostThrows', w.throws);
          break;
        case 'respawn': levelColors = new Set(); break;
        case 'can': Achievements.unlock('can-collector'); Achievements.add('cans'); break;
        case 'stomp': Achievements.unlock('stomp'); Achievements.add('stomps'); break;
        case 'stun': Achievements.unlock('paintball'); break;
        case 'jump': Achievements.add('jumps'); break;
        case 'bounce': Achievements.add('bounces'); lastBounceTick = game.tick; break;
        case 'teleport': if (ev.who === 'monster') Achievements.unlock('monster-taxi'); else { Achievements.unlock('now-you-see-me'); Achievements.add('teleports'); } break;
        case 'shrink': if (ev.who === 'monster') Achievements.unlock('shrink-inky'); break;
        case 'monsterDie': if (ev.cause === 'lava' && ev.afterPortal) Achievements.unlock('lava-taxi'); break;
        case 'die': {
          Achievements.add('deaths');
          if (ev.cause === 'lava') Achievements.add('lavaDeaths');
          if (ev.cause === 'squashed') Achievements.unlock('pancake');
          if (ev.cause === 'spikes' && game.tick - lastBounceTick < 90) Achievements.unlock('bounce-danger');
          const f = w.level.flag;
          if (Math.hypot(ev.x - (f.c * T + T / 2), ev.y - (f.r * T)) <= 2.5 * T) Achievements.unlock('so-close');
          break;
        }
      }
    }
  }
  // unlocking: Paint Drops, a trophy card on screen, saved to the account; all of them = the Golden Trophy hat + 1,500 Drops
  let achSaveTimer = 0;
  Achievements.onUnlock = (a, reward, all) => {
    game.wallet.earned += reward;
    if (typeof UI !== 'undefined' && UI.refresh) setTimeout(() => UI.refresh(), 0);   // the 🏅 count on the menu
    if (all && !game.wallet.owned.includes('trophy')) { game.wallet.owned.push('trophy'); game.wallet.earned += Achievements.ALL_BONUS; }
    saveWallet();
    showAchievement(a, reward, all);
    clearTimeout(achSaveTimer);
    achSaveTimer = setTimeout(() => { if (online() && Cloud.user) Cloud.saveProfile(localProgress(), LEVELS).catch(() => { }); }, 1500);
  };
  // trophy cards slide in at the top; several at once stack, and a big batch becomes one summary card
  let achQueue = [], achShowing = 0;
  const achBox = document.createElement('div');
  achBox.id = 'ach-toasts';
  document.body.appendChild(achBox);
  function showAchievement(a, reward, all) {
    achQueue.push({ a, reward, all });
    if (achQueue.length === 1) setTimeout(flushAchievements, 30);
  }
  function flushAchievements() {
    const batch = achQueue; achQueue = [];
    if (!batch.length) return;
    sfx.can(); setTimeout(() => sfx.select(), 120);
    const cards = batch.length > 3
      ? [{ icon: '🏆', title: `${batch.length} achievements unlocked!`, sub: `+${batch.reduce((n, b) => n + b.reward, 0)} Paint Drops · see them all in 🏅 Achievements` }]
      : batch.map((b) => ({ icon: b.a.icon, title: b.a.name, sub: `${b.a.desc} · +${b.reward} 💧`, tier: b.a.tier }));
    if (batch.some((b) => b.all)) cards.push({ icon: '🏆', title: 'Every achievement!', sub: `+${Achievements.ALL_BONUS.toLocaleString()} 💧 and the Golden Trophy hat. Find it in the store.`, tier: 'hard' });
    for (const c of cards) {
      const el = document.createElement('div');
      el.className = 'ach-toast' + (c.tier ? ' t-' + c.tier : '');
      el.innerHTML = `<span class="ach-icon">${c.icon}</span><span><small>Achievement unlocked</small><b></b><em></em></span>`;
      el.querySelector('b').textContent = c.title; el.querySelector('em').textContent = c.sub;
      achBox.appendChild(el);
      achShowing++;
      setTimeout(() => el.classList.add('out'), 3400);
      setTimeout(() => { el.remove(); achShowing--; }, 3900);
    }
  }

  // ---------- fixed-step update ----------
  let achReady = false;
  function update() {
    game.tick++;
    // catch up on achievements earned before they existed, once the splash is gone
    if (!achReady && !document.getElementById('splash') && !(typeof Story !== 'undefined' && Story.playing)) { achReady = true; achCheck(); }
    if (game.shake > 0) game.shake--;
    if (game.toast && --game.toast.t <= 0) game.toast = null;

    if (tapped('KeyM')) showToast(Sound.toggleMusic() ? '♪ Music on' : '♪ Music off');
    if (tapped('KeyF')) toggleFullscreen();
    if (tapped('KeyG')) {
      const next = Ghost.MODES[(Ghost.MODES.indexOf(Ghost.mode) + 1) % Ghost.MODES.length];
      setGhostMode(next);
      showToast({ top: '👻 Ghost: #1 record', mine: '👻 Ghost: your best run', off: '👻 Ghost off' }[next], 1800);
    }
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
      if (tapped('Enter', 'Space') || mouse.down) { mouse.down = false; play(game.menuIdx); }
    } else if (game.mode === 'complete') {
      if (tapped('Enter', 'Space') || mouse.down) {
        mouse.down = false;
        if (game.levelIdx + 1 < LEVELS.length) play(game.levelIdx + 1);
        else {
          game.mode = 'end';
          // the first time through the last level: the Chapter 2 teaser
          if (typeof Story !== 'undefined' && !store.get('seenEnding', false)) { store.set('seenEnding', true); playStory('ending'); }
        }
      }
      if (tapped('KeyR')) play(game.levelIdx);
      if (tapped('Escape')) { game.mode = 'title'; game.menuIdx = game.levelIdx; } // back to the level you just finished
    } else if (game.mode === 'end') {
      if (tapped('Enter', 'Space', 'Escape') || mouse.down) { mouse.down = false; game.mode = 'title'; game.menuIdx = game.unlocked; }
    } else if (game.mode === 'play') {
      const w = game.world;
      // phone turned upright mid-level: everything waits (timer, monsters, platforms, paint in
      // flight) until it's turned back; fingers on the buttons are let go
      if (touchMode && innerHeight > innerWidth) {
        touches.clear(); syncTouchKeys(); keys.clear(); pressed.clear(); mouse.down = mouse.right = false;
        return;
      }
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

      if (touchMode) stickFire(w);
      const wash = mouse.right || (mouse.down && held('ShiftLeft', 'ShiftRight'));
      if (mouse.down || mouse.right) { const [ax, ay] = toWorld(mouse.x, mouse.y); w.throwPaint(ax, ay, wash ? NONE : game.color); }

      // a stomp freezes the action for a split second (hit-stop)
      if (game.hitstop > 0) { game.hitstop--; pressed.clear(); return; }
      w.step(inp);
      if (w.level.chase && w.state === 'play') {           // the countdown ticks, then the Eraser comes
        const left = (w.level.chase.delay || 120) - w.frame;
        if (left > 0 && left % 60 === 0) sfx.warn();
        if (left === 0) { sfx.stomp(); game.shake = 8; }
      }
      stepCamera(w);
      Ghost.record(w);
      if (w.state === 'play' && w.player.cling === 2) { if (++ceilingFrames >= 300) Achievements.unlock('spider-painter'); } else ceilingFrames = 0;
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
      stepHero(w);
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

  // which way a painted surface runs at a splat: along a floor/ceiling ('h') or up a wall ('v')
  function surfaceAlong(w, x, y) {
    const at = (dx, dy) => w.solid(Math.floor((x + dx) / T), Math.floor((y + dy) / T));
    return at(0, 10) || at(0, -10) ? 'h' : at(10, 0) || at(-10, 0) ? 'v' : 'h';
  }

  function drawBackground() {
    if (game.world && ART.layered()) {
      const p = game.world.player, [sx, sy] = toScreen(p.x + p.w / 2, p.y + p.h / 2);
      ART.setCamera(sx, sy);
      ART.drawScene(ctx, LEVELS[game.levelIdx].name, game.levelIdx, game.tick / 60, cam.on ? cam.x : 0, game.world.level.w);
    } else ctx.drawImage(game.world ? ART.paper(LEVELS[game.levelIdx].name, game.levelIdx) : ART.plainPaper(), 0, 0);
  }

  // ---------- the camera ----------
  // One-screen levels sit still; wider levels (the boss chases) follow you, looking a
  // little ahead in the direction you run, and punch in a touch on big bounces.
  const cam = { x: 0, y: 0, z: 1, cx: W / 2, cy: H / 2, punch: 0, on: false };
  function stepCamera(w, snap) {
    const lv = w.level, big = lv.w > W || lv.h > H;
    cam.on = big;
    if (!cam.on) { cam.x = 0; cam.y = 0; cam.z = 1; return; }
    const p = w.player;
    cam.punch *= 0.9;
    cam.z = 1.08 + cam.punch;
    const ahead = Math.max(-1, Math.min(1, p.vx / RUN)) * 80 + p.face * 24;
    const tx = p.x + p.w / 2 + ahead, ty = p.y + p.h / 2 - 16;
    if (snap) { cam.cx = tx; cam.cy = ty; } else { cam.cx += (tx - cam.cx) * 0.08; cam.cy += (ty - cam.cy) * 0.07; }
    const vw = W / cam.z, vh = H / cam.z;
    cam.x = Math.max(0, Math.min(lv.w - vw, cam.cx - vw / 2));
    cam.y = Math.max(0, Math.min(lv.h - vh, cam.cy - vh / 2));
  }
  const toWorld = (sx, sy) => (cam.on ? [sx / cam.z + cam.x, sy / cam.z + cam.y] : [sx, sy]);
  const toScreen = (wx, wy) => (cam.on ? [(wx - cam.x) * cam.z, (wy - cam.y) * cam.z] : [wx, wy]);

  // The Eraser chase: everything behind him is rubbed out to blank paper.
  function drawChase(w) {
    if (!w.level.chase) return;
    const ex = w.chaseX(), t = game.tick / 60;
    if (ex < -T) return;
    const top = cam.on ? cam.y : 0, bottom = top + H / cam.z;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-10, top - 10);
    for (let y = top - 10; y <= bottom + 10; y += 14) ctx.lineTo(ex + Math.sin(y * 0.07 + t * 5) * 7, y);
    ctx.lineTo(-10, bottom + 10); ctx.closePath();
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.clip();
    ctx.drawImage(ART.plainPaper(), Math.floor(ex / W) * W, top); ctx.drawImage(ART.plainPaper(), Math.floor(ex / W) * W - W, top);
    ctx.fillStyle = 'rgba(150,140,140,0.35)';
    for (let i = 0; i < 26; i++) {                       // crumbs and gray smears left behind
      const cx = ex - 20 - hash(i, Math.floor(ex / 40)) * 260, cy = top + hash(i, 9) * (bottom - top);
      ctx.beginPath(); ctx.ellipse(cx, cy, 2 + hash(i, 3) * 3, 1.5, hash(i, 4) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // the Eraser himself, rubbing away at the edge
    if (typeof Story !== 'undefined' && Story.drawEraser) {
      const ey = Math.max(top + 90, Math.min(bottom - 80, w.player.y + 10)) + Math.sin(t * 9) * 14;
      Story.drawEraser(ctx, ex - 20, ey, 1.05, t, 'grumpy');
    }
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


  // ---------- the hero's body language (works for every character) ----------
  // leaning into runs, stretching in the air, breathing when still, a kick back when throwing,
  // dust, speed streaks on red, looking around and then dozing off when left alone, dizzy stars
  const hero = { idle: 0, lean: 0, recoil: 0, dizzy: 0, prevVx: 0, dustT: 0 };
  let puffs = [];
  function resetHero() { Object.assign(hero, { idle: 0, lean: 0, recoil: 0, dizzy: 0, prevVx: 0, dustT: 0 }); puffs = []; }
  // soft pencil-gray dust clouds at the feet
  function puff(x, y, n, size = 1, dir = 0) {
    for (let i = 0; i < n; i++) {
      const side = dir || (i % 2 ? 1 : -1);
      puffs.push({ x: x + (Math.random() - 0.5) * 8, y: y - 2, vx: side * (0.6 + Math.random() * 1.6) * size, vy: -(0.2 + Math.random() * 0.6) * size,
        r: (2.5 + Math.random() * 2.5) * size, life: 1, fade: 0.025 + Math.random() * 0.02 });
    }
  }
  function stepHero(w) {
    const p = w.player, still = p.grounded && !p.cling && Math.abs(p.vx) < 0.2 && w.state === 'play';
    hero.idle = still ? hero.idle + 1 / 60 : 0;
    // lean: into the run on the ground, with the motion in the air
    const target = p.cling ? 0 : p.grounded ? Math.max(-0.16, Math.min(0.16, p.vx * 0.022)) : Math.max(-0.12, Math.min(0.12, p.vx * 0.015));
    hero.lean += (target - hero.lean) * 0.18;
    hero.recoil *= 0.84;
    hero.dizzy = Math.max(0, hero.dizzy - 1 / 60);
    // running dust, and a skid when you turn around fast
    if (p.grounded && !p.cling) {
      const fast = Math.abs(p.vx) > RUN * 0.9;
      if (fast && ++hero.dustT % (Math.abs(p.vx) > RUN * 1.5 ? 4 : 9) === 0) puff(p.x + p.w / 2 - Math.sign(p.vx) * p.w * 0.4, p.y + p.h, 1, 0.6, -Math.sign(p.vx));
      if (Math.sign(p.vx) !== Math.sign(hero.prevVx) && Math.abs(hero.prevVx) > RUN * 0.8) puff(p.x + p.w / 2, p.y + p.h, 4, 0.8, Math.sign(hero.prevVx));
    }
    hero.prevVx = p.vx;
    for (const d of puffs) { d.x += d.vx; d.y += d.vy; d.vx *= 0.92; d.vy *= 0.92; d.r += 0.12; d.life -= d.fade; }
    puffs = puffs.filter((d) => d.life > 0);
  }
  function drawPuffs() {
    for (const d of puffs) {
      ctx.fillStyle = `rgba(90,84,76,${0.28 * d.life})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayer(w) {
    const p = w.player;
    if (w.state === 'dead') return;
    const k = p.h / 40;                       // 1 when big, ~0.45 when small
    const wall = p.cling === 1 || p.cling === -1;
    const moving = p.cling ? (Math.abs(p.vx) + Math.abs(p.vy) > 0.3 ? 1 : 0)
      : p.grounded ? Math.min(1, Math.abs(p.vx) / RUN) : 0;
    const t = game.tick / 60;
    // left alone: look around after a few seconds, then nod off (eyes shut, z z z)
    const asleep = hero.idle > 9, lookAround = hero.idle > 3.5 && !asleep && Math.floor((hero.idle - 3.5) / 1.3) % 2 === 1;
    // stretch going up, round at the top, a little long again falling; slow breathing when still
    let stretch = 1;
    if (!p.grounded && !p.cling) stretch = p.vy < -1.5 ? 1 + Math.min(0.12, -p.vy * 0.012) : p.vy > 4 ? 1 + Math.min(0.07, (p.vy - 4) * 0.01) : 0.96;
    if (p.grounded && !p.cling && hero.idle > 0.4) stretch *= 1 + Math.sin(t * (asleep ? 1.6 : 2.6)) * (asleep ? 0.04 : 0.022);
    const o = {
      s: k, col: COLOR_HEX[game.color], t: asleep ? 0.05 : t, run: runPhase, moving,
      air: !p.grounded && p.cling !== 2, face: wall ? p.cling : lookAround ? -p.face : p.face,
      squash: p.cling ? 1 : squash * stretch * (1 - hero.recoil * 0.06),
    };
    if (p.grounded && !p.cling) ART.shadow(ctx, p.x + p.w / 2, p.y + p.h, p.w * 0.6 * (2 - stretch));
    // speed streaks behind you on red paint
    if (p.grounded && Math.abs(p.vx) > RUN * 1.4) {
      const dir = Math.sign(p.vx), a = Math.min(1, (Math.abs(p.vx) - RUN * 1.4) / (RED_RUN - RUN * 1.4));
      ctx.strokeStyle = `rgba(28,28,31,${0.35 * a})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const y = p.y + p.h * (0.3 + i * 0.22), x0 = p.x + p.w / 2 - dir * (p.w * 0.7 + i * 3), len = 14 + ((game.tick * 3 + i * 7) % 12);
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 - dir * len, y); ctx.stroke();
      }
    }
    ctx.save();
    if (p.cling === 2) {                      // hanging from a green ceiling: upside down, feet on the ceiling
      ctx.translate(p.x + p.w / 2, p.y);
      ctx.scale(1, -1);
    } else {
      ctx.translate(p.x + p.w / 2, p.y + p.h);
      ctx.rotate(hero.lean - p.face * hero.recoil * 0.12);   // pivots at the feet
    }
    SHOP.drawHero(ctx, currentCharacter(), o, look());
    ctx.restore();
    const top = p.cling === 2 ? p.y + p.h + 10 : p.y - 8;
    if (asleep) {                              // z z z
      for (let i = 0; i < 3; i++) {
        const ph = ((t * 0.5 + i / 3) % 1);
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
        text('z', p.x + p.w / 2 + p.face * (6 + ph * 14), top - ph * 22, 9 + ph * 7, INK, 'center', 800);
      }
      ctx.globalAlpha = 1;
    }
    if (hero.dizzy > 0) {                      // stars circling the head
      ctx.globalAlpha = Math.min(1, hero.dizzy * 2);
      for (let i = 0; i < 3; i++) {
        const a = t * 7 + i * 2.1, x = p.x + p.w / 2 + Math.cos(a) * p.w * 0.75, y = top + 2 + Math.sin(a) * 3.5;
        text('★', x, y, 9, Math.sin(a) > 0 ? '#ffc93c' : '#c9a227', 'center', 800);
      }
      ctx.globalAlpha = 1;
    }
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
    const [mx, my] = toWorld(mouse.x, mouse.y), dx = mx - x, dy = my - y, d = Math.hypot(dx, dy) || 1;
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

  // a boss chase: the countdown until the Eraser comes (it starts with the level, moving or not)
  function drawCountdown(w) {
    const ch = w.level.chase;
    if (!ch || w.state === 'won') return;
    const left = (ch.delay || 120) - w.frame;
    if (left <= -60) return;
    const n = Math.ceil(left / 60), k = left > 0 ? 1 - (left % 60) / 60 : -left / 60;   // 0..1 within the second
    const str = left > 0 ? String(n) : 'ERASER!';
    const size = left > 0 ? 70 + k * 30 : 64, a = left > 0 ? 1 - k * 0.6 : 1 - k;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) text(str, W / 2 + ox, 120 + oy, size, INK, 'center', 900);
    text(str, W / 2, 120, size, left > 0 ? '#fff' : '#ff3b4e', 'center', 900);
    if (left > 0 && n === Math.ceil(ch.delay / 60)) text('The Eraser is coming...', W / 2, 180, 20, INK, 'center', 800);
    ctx.restore();
  }

  function drawHUD(w) {
    const lv = w.level;
    drawCountdown(w);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 30);
    text(`${game.levelIdx + 1} / ${LEVELS.length}   ${lv.name}`, 12, 15, 15, '#fff');
    w.cans.forEach((can, i) => drawCan(W / 2 - 22 + i * 22, 16, 0.75, can.got, can.got ? COLOR_HEX[ALL_COLORS[i]] : '#55555c'));
    text(`${(w.state === 'won' && w.finishTime !== null ? w.finishTime : w.frame / 60).toFixed(3)}s`, W - 12, 15, 15, '#fff', 'right');
    if (!touchMode) text(`R restart · Esc menu · M music ${Sound.musicOn ? 'on' : 'off'} · F full screen`, W - 80, 15, 12, 'rgba(255,255,255,0.55)', 'right', 500);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 40, W, 40);
    let x = chipStartX();
    ALL_COLORS.forEach((c, i) => {
      if (!lv.colors.includes(c) || touchMode) return;     // phones and tablets use the palette instead
      const y = H - 32;
      if (game.color === c && !(touchMode && touchWash)) { ctx.fillStyle = '#fff'; roundRect(x - 3, y - 3, 76, 30, 8); ctx.fill(); }
      ctx.fillStyle = COLOR_HEX[c];
      roundRect(x, y, 70, 24, 6); ctx.fill();
      const label = c === PURPLE ? `${i + 1} Portal ${'●'.repeat(w.portals.length)}${'○'.repeat(2 - w.portals.length)}` : `${i + 1} ${COLOR_NAME[c]}`;
      text(label, x + 35, y + 12, c === PURPLE ? 11 : 12, c === YELLOW ? INK : '#fff', 'center');
      x += 82;
    });
    if (!touchMode) text(lv.hint, (x + W) / 2, H - 20, 14, '#fff', 'center', 500);
    else {
      // between the chips and the JUMP button: shrink the hint to fit, or leave it out
      const hint = TOUCH_HINTS[lv.name] || lv.hint.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap');
      const r = canvas.getBoundingClientRect();
      const lefts = [padBtn('Space'), joyR].map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0).map((b) => b.left);
      const right = pad.classList.contains('show') && lefts.length ? Math.min(W, (Math.min(...lefts) - r.left) / r.width * W - 8) : W - 8;
      for (const size of [14, 12, 11]) {
        ctx.font = `500 ${size}px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`;
        if (ctx.measureText(hint).width <= right - x - 4) { text(hint, (x + right) / 2, H - 20, size, '#fff', 'center', 500); break; }
      }
    }

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
    ctx.save();
    if (cam.on) { ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); }
    ART.drawBleed(ctx);
    ART.drawStains(ctx, stains);
    drawTiles(w);
    drawLava(w);
    drawPlatforms(w);
    drawPortals(w);
    drawCans(w);
    drawFlag(w);
    drawMonsters(w);
    drawCosmetics(w);
    drawBlobs(w);
    drawGhost(w);
    drawPuffs();
    drawPlayer(w);
    SHOP.drawBurst(ctx, pops, look().pop);
    drawParticles();
    drawChase(w);
    if (!touchMode || touchAim()) drawAim(w);
    ctx.restore();
    ART.vignette(ctx);
    if (w.level.chase) drawChaseWarning(w);
  }
  // when the Eraser is off screen: a pulsing warning at the left edge, with how close he is
  function drawChaseWarning(w) {
    const ex = w.chaseX(), gap = (w.player.x - ex) / T;
    const [sx] = toScreen(ex, 0);
    if (sx > 0 || w.state !== 'play') return;
    const a = 0.55 + 0.35 * Math.sin(game.tick * (gap < 12 ? 0.35 : 0.15));
    const g = ctx.createLinearGradient(0, 0, 70, 0);
    g.addColorStop(0, `rgba(255,59,78,${0.45 * a})`); g.addColorStop(1, 'rgba(255,59,78,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 30, 70, H - 60);
    text(`◀ Eraser ${Math.max(0, Math.round(gap))}`, 12, H / 2, 15, `rgba(255,255,255,${0.6 + 0.4 * a})`, 'left', 900);
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

  // the controls line at the bottom of the menu, fitted between the 💛 / 🏅 buttons and the right edge
  function drawHelpLine(str) {
    let x0 = 12;
    const bl = document.querySelector('#overlay .corner.bottom');
    if (bl && !document.getElementById('overlay').hidden) {
      const b = bl.getBoundingClientRect(), r = canvas.getBoundingClientRect();
      if (b.width) x0 = Math.max(12, (b.right - r.left) / r.width * W + 10);
    }
    for (const size of [12, 11, 10]) {
      ctx.font = `500 ${size}px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`;
      if (ctx.measureText(str).width <= W - 12 - x0) { text(str, (x0 + W - 12) / 2, H - 22, size, INK, 'center', 500); return; }
    }
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
    text(`◀  ${lv.boss ? '⚠ Boss chase' : 'Level'} ${game.menuIdx + 1}: ${lv.name}  ▶`, W / 2, 384, 19, lv.boss ? '#ff8a96' : '#fff', 'center');
    // colors used in this level
    lv.colors.forEach((c, i) => {
      ctx.fillStyle = COLOR_HEX[c];
      ctx.beginPath(); ctx.arc(W / 2 - (lv.colors.length - 1) * 9 + i * 18 - 70, 412, 6, 0, Math.PI * 2); ctx.fill();
    });
    const best = game.best[lv.name];
    const st = game.stars[lv.name] || 0;
    text(best ? `${'★'.repeat(st)}${'☆'.repeat(3 - st)}   Best: ${best.toFixed(3)}s` : 'Not cleared yet', W / 2 + 40, 412, 13, best ? '#ffd166' : 'rgba(255,255,255,0.65)', 'center', 600);

    if (Math.floor(game.tick / 30) % 2 === 0) text(touchMode ? 'Tap to play' : `Press ENTER or click to play  ·  L leaderboards  ·  C characters  ·  S store`, W / 2, 462, 16, INK, 'center', 700);

    text(`★ ${totalStars()} / ${LEVELS.length * 3} stars        ${drops().toLocaleString()} Paint Drops`, W / 2, 492, 15, INK, 'center', 800);
    ctx.font = '800 15px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
    const dropsW = ctx.measureText(`${drops().toLocaleString()} Paint Drops`).width;
    const fullW = ctx.measureText(`★ ${totalStars()} / ${LEVELS.length * 3} stars        ${drops().toLocaleString()} Paint Drops`).width;
    SHOP.drawDrop(ctx, W / 2 + fullW / 2 - dropsW - 12, 493, 6);
    drawHelpLine(touchMode ? 'Choose your controls in ⚙️ Settings  ·  🏅 Achievements earn Paint Drops' : 'A/D move · W/Space jump · Mouse aim · Click throw · Right-click wash · 1-5 colors · G ghost · M music · F full screen');
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
    if (!it || it.exclusive || game.wallet.owned.includes(id) || drops() < it.price.drops) return false;
    game.wallet.spent += it.price.drops;
    game.wallet.owned.push(id);
    equipItem(id);
    sfx.can();
    Achievements.unlock('window-shopper');
    achCheck();
    return true;
  }
  function equipItem(id, on = true) {
    const it = SHOP.byId[id];
    if (!it || !game.wallet.owned.includes(id)) return false;
    if (on) game.wallet.equipped[it.cat] = id; else delete game.wallet.equipped[it.cat];
    game.wallet.equippedAt = Date.now();
    saveWallet();
    achCheck();
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
  // tappable buttons on the level-complete screen (touch only); `key` is what pressing one does
  let panelButtons = [];
  function drawPanelButtons(list, y) {
    const w = 130, h = 38, gap = 16, x0 = W / 2 - (list.length * w + (list.length - 1) * gap) / 2;
    panelButtons = list.map(([label, key], i) => ({ x: x0 + i * (w + gap), y: y - h / 2, w, h, key }));
    panelButtons.forEach((b, i) => {
      const main = i === list.length - 1;
      ctx.fillStyle = main ? '#ffd166' : 'rgba(255,255,255,0.14)';
      roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
      ctx.strokeStyle = main ? '#ffd166' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      text(list[i][0], b.x + b.w / 2, b.y + b.h / 2 + 1, 17, main ? INK : '#fff', 'center', 800);
    });
  }
  function drawPanel(lines, step = 42) {
    panelButtons = [];
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
            ? [`New character unlocked: ${r.unlockedNow.map((c) => c.name).join(' & ')}!  ${touchMode ? 'Try it from the menu' : 'Press C to try it'}`, 16, '#7cf29c', 800]
            : ['', 14, '#fff', 500],
          touchMode ? ['', 15, '#fff', 500] : ['ENTER: next level   ·   R: retry   ·   S: store   ·   Esc: menu', 15, 'rgba(255,255,255,0.6)', 500],
        ], 40);
        if (touchMode) drawPanelButtons([['☰ Menu', 'Escape'], ['↺ Retry', 'KeyR'], ['Next ▶', 'Enter']], y0 + 10 * 40);
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
          ['Enjoyed it? The 💛 Support button lets you tip what you like.', 16, '#ffd166', 600],
          [touchMode ? 'Tap to go to the menu' : 'Press ENTER', 16, 'rgba(255,255,255,0.6)', 500],
        ]);
      }
    }
    if (embedded && !hasFocus && game.mode === 'play') {
      ctx.globalAlpha = 0.9 + Math.sin(game.tick * 0.08) * 0.1;
      ctx.fillStyle = 'rgba(28,28,31,0.88)';
      roundRect(W / 2 - 170, H / 2 - 26, 340, 52, 14); ctx.fill();
      text('Click the game to use the keyboard', W / 2, H / 2, 18, '#fff', 'center', 800);
      ctx.globalAlpha = 1;
    }
    if (touchMode && innerHeight > innerWidth) {          // phone held upright: the levels are wide
      ctx.fillStyle = 'rgba(15,15,18,0.92)'; ctx.fillRect(0, 0, W, H);
      text('↻', W / 2, H / 2 - 50, 90, '#fff', 'center', 900);
      if (game.mode === 'play') {
        text('Paused', W / 2, H / 2 + 34, 44, '#ffd166', 'center', 900);
        text('Turn your phone sideways to continue', W / 2, H / 2 + 84, 26, '#fff', 'center', 800);
      } else text('Turn your phone sideways to play', W / 2, H / 2 + 40, 30, '#fff', 'center', 800);
    }
    if (!touchMode || touchAim()) drawCursor();
    showTouchpad();
  }

  // Handy for poking at the game from the browser console.
  // debug/tools: advance(n) runs n fixed steps and draws once (used for trailers and screenshots)
  window.paintRunner = { game, startLevel, resetProgress, advance(n = 1) { for (let k = 0; k < n; k++) update(); render(); } };

  // ---------- trying Eraser speeds: index.html#eraser=a / b / c ----------
  const eraserTry = /eraser=([abc])/.exec(location.hash);
  const eraserPreset = eraserTry ? useEraserPreset(eraserTry[1]) : null;

  // ---------- the story ----------
  // The opening comic plays once for every player, right after the "tap to start" screen.
  // (index.html#story / #ending play a scene on demand; links straight to a level skip it.)
  function playStory(which) {
    keys.clear(); pressed.clear(); mouse.down = mouse.right = false;
    if (which === 'intro') store.set('seenIntro', true);
    Story.play(which, () => { keys.clear(); pressed.clear(); mouse.down = false; });
  }
  const storyHash = /ending/.test(location.hash) ? 'ending' : /story/.test(location.hash) ? 'intro' : null;
  if (storyHash || (!store.get('seenIntro', false) && !/level=|nosplash/.test(location.hash))) {
    const wait = setInterval(() => {
      if (typeof Story === 'undefined' || document.getElementById('splash')) return;
      clearInterval(wait);
      if (game.mode === 'title') playStory(storyHash || 'intro');
    }, 150);
  }

  // every visit reaches the stats dashboard; signed-out players play as anonymous guests
  if (online()) Cloud.trackVisits();

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
      resetProgress,
      achievements: () => { achCheck(); return Achievements.list(); },
      achCount: () => Achievements.count(),
      touchControls: () => touchMode,
      controls: () => scheme,
      setControls: (s) => setScheme(s),
      setGhostMode,
      look,
      playStory,
      endingUnlocked: () => store.get('seenEnding', false) || (LEVELS.length > 0 && game.best[LEVELS[LEVELS.length - 1].name] !== undefined),
    });
  }

  // Dev shortcut: index.html#level=3 jumps straight into a level.
  const hashLevel = /level=(\d+)/.exec(location.hash);
  if (hashLevel) play(Math.max(0, Math.min(LEVELS.length - 1, Number(hashLevel[1]) - 1)));

  // ---------- music without waiting for a tap (where the browser allows) ----------
  // On a phone held upright the game asks you to turn it, so the music waits until it's sideways.
  // A tap while upright still unlocks audio, so the music starts the moment the phone is turned.
  const upright = () => touchMode && innerHeight > innerWidth;
  function musicForOrientation() {
    Sound.hold(upright());
    if (!upright()) Sound.tryAutoplay();
  }
  musicForOrientation();
  addEventListener('resize', musicForOrientation);
  addEventListener('orientationchange', () => setTimeout(musicForOrientation, 200));
  // where autoplay is blocked, the very first touch, click or key anywhere on the page starts it
  // (a touch only counts as interacting when the finger lifts, so touchend / pointerup are in the list)
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']) document.addEventListener(ev, () => Sound.init(), { capture: true, passive: true });

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
