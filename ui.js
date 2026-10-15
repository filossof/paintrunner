'use strict';

/* ============================================================
   UI: the HTML bits on top of the canvas - Google sign-in chip,
   leaderboard window, stats button for the admin.
   ============================================================ */

const UI = (() => {
  const overlay = document.getElementById('overlay');
  let modal = null, mode = 'title', api = null;

  const GOOGLE_G = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2.2 1.5-5.1 2.4-8.7 2.4-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtTime = (t) => (t === undefined || t === null ? '—' : `${t.toFixed(3)}s`);
  const starsText = (n) => '★'.repeat(n || 0) + '☆'.repeat(3 - (n || 0));
  const avatar = (url) => url
    ? `<img class="avatar" src="${esc(url)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
    : '<span class="avatar"></span>';
  const friendlyError = (e) => (e && e.code === 'permission-denied')
    ? 'Online leaderboards are not switched on yet (the database rules still need to be published).'
    : 'Could not reach the leaderboards. Check your connection and try again.';

  // ---------- corner buttons ----------
  function render() {
    overlay.hidden = mode === 'play' || !Cloud.available;
    if (overlay.hidden) return;
    const u = Cloud.user;
    // signed in: just your picture; tapping it opens a small menu with Sign out
    const right = u
      ? `<div class="account">
          <button class="avatar-btn" data-act="account" aria-haspopup="true" aria-expanded="false" aria-label="${esc(u.displayName || 'Account')}" title="${esc(u.displayName || '')}">${u.photoURL ? avatar(u.photoURL) : `<span class="initial">${esc((u.displayName || u.email || '?')[0].toUpperCase())}</span>`}</button>
          <div class="account-menu" hidden>
            <div class="who"><strong>${esc(u.displayName || 'Painter')}</strong><small>${esc(u.email || '')}</small></div>
            <button class="btn small" data-act="signout">Sign out</button>
          </div>
        </div>`
      : `<button class="btn" data-act="signin">${GOOGLE_G}<span>Sign in with Google</span></button>`;
    const left = `<button class="btn" data-act="boards">🏆 Leaderboards <small>(L)</small></button>` +
      `<button class="btn" data-act="chars">🎭 Characters <small>(C)</small></button>` +
      `<button class="btn" data-act="store">🛍️ Store <small>(S)</small></button>` +
      `<button class="btn" data-act="controls">🎮 Controls</button>` +
      `<button class="btn" data-act="full" title="Full screen (F)">⛶ Full screen <small>(F)</small></button>` +
      (Cloud.isAdmin ? `<a class="btn small" href="${Cloud.HOME_URL}stats.html" target="_blank" rel="noopener">📊 Stats</a>` : '');
    // tips go through itch.io's own payment window, opened in a new tab
    const support = `<a class="btn support" href="${SUPPORT_URL}" target="_blank" rel="noopener" title="Enjoying the game? Tip what you like">💛 Support</a>`;
    const ach = `<button class="btn" data-act="ach">🏅 Achievements <small>${api.achCount ? api.achCount() : 0}/${Achievements.LIST.length}</small></button>`;
    overlay.innerHTML = `<div class="corner left">${left}</div><div class="corner">${right}</div><div class="corner left bottom">${support}${ach}</div>`;
  }

  overlay.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]'), act = btn?.dataset.act;
    // after a mouse click, don't leave the keyboard on the button: Enter or Space (jump!) would press
    // it again, e.g. leaving full screen. Blurring keeps the keyboard inside the game.
    if (btn && e.detail > 0) btn.blur();
    if (act === 'signin') signIn();
    if (act === 'account') { setAccountMenu(overlay.querySelector('.account-menu').hidden); return; }
    if (act === 'signout') {
      setAccountMenu(false);
      await Cloud.flush().catch(() => { });     // finish saving to the account first
      await Cloud.signOut();
      api.resetProgress();
      api.toast('Signed out. Your progress is saved in your account.', 3000);
    }
    if (act === 'boards') openLeaderboard(api.currentLevel());
    if (act === 'full') api.toggleFullscreen();
    if (act === 'chars') openCharacters();
    if (act === 'store') openStore();
    if (act === 'controls') openControls();
    if (act === 'ach') openAchievements();
  });
  // the little account menu under your picture: closes on any press outside it
  function setAccountMenu(open) {
    const m = overlay.querySelector('.account-menu'), b = overlay.querySelector('.avatar-btn');
    if (!m) return;
    m.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
  }
  // a press outside closes it - and only closes it (it doesn't also start a level)
  let closedAt = 0;
  document.addEventListener('pointerdown', (e) => {
    const m = overlay.querySelector('.account-menu');
    if (m && !m.hidden && !e.target.closest('.account')) { setAccountMenu(false); closedAt = performance.now(); }
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setAccountMenu(false); });
  // keep clicks on the overlay from also hitting the game underneath
  overlay.addEventListener('mousedown', (e) => e.stopPropagation());

  async function signIn() {
    try {
      await Cloud.signIn();
    } catch (e) {
      console.error(e);
      if (e.code === 'embedded') api.toast('Sign-in is blocked on this page. Play at filossof.github.io/paintrunner to sign in.', 6000);
      else api.toast('Sign-in failed');
    }
  }

  // Progress follows you between computers once you sign in.
  async function sync() {
    try {
      const merged = await Cloud.syncProgress(api.localProgress(), LEVELS);
      if (merged) { api.applyProgress(merged); api.toast('☁ Progress synced'); }
    } catch (e) {
      console.warn('sync failed', e);
      if (e && e.code === 'permission-denied') api.toast('Online saving is not switched on yet');
    }
  }

  // ---------- leaderboard window ----------
  let view = 'level', levelIdx = 0;

  function openLeaderboard(idx = 0) {
    levelIdx = idx;
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.className = 'modal-back';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="lb-title">
        <div class="modal-head">
          <h2 id="lb-title">🏆 Leaderboards</h2>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          <div class="tabs" role="tablist">
            <button class="tab" role="tab" data-view="level">Per level</button>
            <button class="tab" role="tab" data-view="stars">🌍 Star collectors</button>
            <div class="level-pick">
              <button class="btn small" data-act="prev" aria-label="Previous level">◀</button>
              <select aria-label="Level">${LEVELS.map((l, i) => `<option value="${i}">${i + 1}. ${esc(l.name)}</option>`).join('')}</select>
              <button class="btn small" data-act="next" aria-label="Next level">▶</button>
            </div>
          </div>
          <div class="content"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) return close();
      const t = e.target.closest('[data-act],[data-view]');
      if (!t) return;
      if (t.dataset.view) { view = t.dataset.view; load(); }
      if (t.dataset.act === 'close') close();
      if (t.dataset.act === 'prev') { levelIdx = (levelIdx + LEVELS.length - 1) % LEVELS.length; load(); }
      if (t.dataset.act === 'next') { levelIdx = (levelIdx + 1) % LEVELS.length; load(); }
      if (t.dataset.act === 'signin') signIn();
    });
    modal.querySelector('select').addEventListener('change', (e) => { levelIdx = Number(e.target.value); load(); });
    modal.querySelector('.close').focus();
    load();
  }

  function close() {
    gateThen = null;
    if (modal) modal.remove();
    modal = null;
    cancelAnimationFrame(charAnim);
  }

  // ---------- achievements ----------
  function openAchievements() {
    if (modal) close();
    const list = api.achievements();
    const done = list.filter((a) => a.done).length;
    const earned = list.filter((a) => a.done).reduce((n, a) => n + a.reward, 0) + (done === list.length ? Achievements.ALL_BONUS : 0);
    modal = document.createElement('div');
    modal.className = 'modal-back';
    const tiers = Object.entries(Achievements.TIERS);
    const card = (a) => {
      const pct = a.goal && a.progress !== null ? Math.round(a.progress / a.goal * 100) : null;
      return `<div class="ach${a.done ? ' done' : ''}" style="--tier:${a.tierColor}">
        <span class="ach-badge">${a.icon}</span>
        <span class="ach-text">
          <b>${esc(a.name)}</b>
          <small>${esc(a.desc)}</small>
          ${!a.done && pct !== null ? `<span class="ach-bar"><i style="width:${pct}%"></i></span><small class="ach-num">${a.progress.toLocaleString()} / ${a.goal.toLocaleString()}</small>` : ''}
        </span>
        <span class="ach-reward">${a.done ? '✓' : `+${a.reward} 💧`}</span>
      </div>`;
    };
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ach-title" style="max-width:860px">
        <div class="modal-head">
          <h2 id="ach-title">🏅 Achievements</h2>
          <span class="ach-total"><b>${done}</b> / ${list.length} · ${earned.toLocaleString()} 💧 earned</span>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          <div class="ach-progress"><i style="width:${Math.round(done / list.length * 100)}%"></i></div>
          <p class="note">Unlock all ${list.length} to win <b>+${Achievements.ALL_BONUS.toLocaleString()} 💧</b> and the <b>🏆 Golden Trophy</b> hat - it can't be bought.</p>
          ${tiers.map(([k, t]) => `<h3 class="ach-tier" style="--tier:${t.color}">${t.name} <small>+${t.reward} 💧 each</small></h3>
            <div class="ach-grid">${list.filter((a) => a.tier === k).map(card).join('')}</div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-act="close"]')) close(); });
    modal.querySelector('.close').focus();
  }

  // ---------- touch controls: pick one of three schemes ----------
  const CONTROL_SCHEMES = [
    { id: 'classic', name: 'Classic', pic: '<i class="stick l"></i><i class="btn-j" style="right:6px">JUMP</i><span class="tap">👆</span>',
      text: 'Joystick to move, JUMP button to jump. Touch the level to throw paint there; hold to keep throwing.' },
    { id: 'twintap', name: 'Twin Tap', pic: '<i class="stick l" style="font-size:15px">🎨</i><i class="stick r" style="font-size:15px">⤴</i><span class="tap">👆</span>',
      text: 'Left stick moves; tap it to throw, hold it still to keep throwing. Right stick aims; tap it to jump. Touching the level still throws.' },
    { id: 'twinstick', name: 'Twin Stick', pic: '<i class="stick l"></i><i class="stick r">🎯</i><i class="btn-j" style="right:42px">J</i><span class="tap">👆</span>',
      text: 'Left stick moves. Right stick aims and throws while you push it. JUMP button beside it. Touching the level still throws.' },
  ];
  function openControls() {
    if (modal) close();
    modal = document.createElement('div');
    modal.className = 'modal-back';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ctl-title" style="max-width:620px">
        <div class="modal-head">
          <h2 id="ctl-title">🎮 Controls</h2>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body"><div class="ctl-list" role="radiogroup" aria-label="Touch controls"></div>
          <p class="note">Your choice is saved on this device. Try each one on a level or two.</p></div>
      </div>`;
    document.body.appendChild(modal);
    const render = () => {
      const cur = api.controls();
      modal.querySelector('.ctl-list').innerHTML = CONTROL_SCHEMES.map((c) => `
        <button class="ctl" role="radio" aria-checked="${c.id === cur}" data-scheme="${c.id}">
          <span class="ctl-pic" aria-hidden="true">${c.pic}</span>
          <span><h3>${c.name} ${c.id === cur ? '<span class="chk">✓ in use</span>' : ''}</h3><p>${c.text}</p></span>
        </button>`).join('');
    };
    render();
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-act="close"]')) return close();
      const b = e.target.closest('[data-scheme]');
      if (b) { api.setControls(b.dataset.scheme); render(); api.toast(`Controls: ${CONTROL_SCHEMES.find((c) => c.id === b.dataset.scheme).name}`); }
    });
    modal.querySelector('.close').focus();
  }

  // ---------- sign in to play ----------
  // Playing needs a Google account. Shown when a signed-out player tries to start a level;
  // once they sign in it closes and `then` starts the level they picked.
  let gateThen = null;
  function openSignInGate(then) {
    if (modal) close();
    gateThen = then;
    modal = document.createElement('div');
    modal.className = 'modal-back';
    const offline = !Cloud.available;
    modal.innerHTML = `
      <div class="modal gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" style="max-width:460px">
        <div class="modal-head">
          <h2 id="gate-title">🎨 Sign in to play</h2>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body" style="text-align:center;display:grid;gap:14px;padding-bottom:22px">
          <p style="margin:0">Paint Runner saves your progress, stars and Paint Drops to your Google account, so they follow you to any computer, and your best times go on the leaderboards.</p>
          ${offline
            ? '<p class="error" style="margin:0">Can\'t reach the sign-in service right now. Check your internet connection and refresh the page.</p>'
            : `<button class="btn big" data-act="gate-signin" style="justify-self:center;font-size:17px;padding:12px 22px">${GOOGLE_G} Sign in with Google</button>`}
          <p class="gate-msg note" style="margin:0" hidden></p>
          ${Cloud.embedded ? `<p class="note" style="margin:0">Sign-in not working here? <a href="${Cloud.HOME_URL}" target="_blank" rel="noopener">Open the game in a new tab</a></p>` : ''}
          <p class="note" style="margin:0">We only show your first name and last initial on leaderboards.</p>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', async (e) => {
      if (e.target === modal) return close();
      const t = e.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'close') close();
      if (t.dataset.act === 'gate-signin') {
        const msg = modal.querySelector('.gate-msg');
        try {
          await Cloud.signIn();
        } catch (err) {
          console.error(err);
          msg.hidden = false;
          msg.innerHTML = err.code === 'embedded'
            ? `Your browser blocked sign-in on this page. <a href="${Cloud.HOME_URL}" target="_blank" rel="noopener">Play in a new tab</a> instead.`
            : 'Sign-in didn\'t work. Please try again.';
        }
      }
    });
    (modal.querySelector('[data-act=gate-signin]') || modal.querySelector('.close')).focus();
  }

  // ---------- store ----------
  const fmtN = (n) => n.toLocaleString();
  let storeTab = 'hat', trying = null;
  function openStore() {
    if (modal) close();
    trying = null;
    modal = document.createElement('div');
    modal.className = 'modal-back';
    modal.innerHTML = `
      <div class="modal store" role="dialog" aria-modal="true" aria-labelledby="st-title">
        <div class="modal-head">
          <h2 id="st-title">🛍️ Store</h2>
          <span class="balance" aria-live="polite"><canvas class="drop-icon" aria-hidden="true"></canvas><b class="bal"></b> Paint Drops</span>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="sheet-back" data-act="untry" hidden></div>
        <div class="store-body">
          <div class="store-stage">
            <canvas class="stage" aria-label="Your character wearing the selected items"></canvas>
            <div class="trying" hidden></div>
            <div class="sheet-info"></div>
            <p class="note">Click an item to try it on. Earn Paint Drops by clearing levels, collecting new cans, beating your best times and playing every day.</p>
          </div>
          <div class="store-shop">
            <div class="tabs" role="tablist"></div>
            <div class="items"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) return close();
      const t = e.target;
      if (t.closest('[data-act="close"]')) return close();
      // phones: the try-on preview is a pop-up; a tap outside it (or on Close) closes it
      if (t.closest('[data-act="untry"]') || (touchStore() && trying && !t.closest('.store-stage') && !t.closest('[data-try]'))) { trying = null; renderStore(); return; }
      const tb = t.closest('[data-tab]'); if (tb) { storeTab = tb.dataset.tab; trying = null; renderStore(); return; }
      const by = t.closest('[data-buy]');
      if (by) { if (api.buyItem(by.dataset.buy)) { trying = null; api.toast('Bought and equipped!'); } renderStore(); return; }
      const eq = t.closest('[data-equip]'); if (eq) { api.equipItem(eq.dataset.equip, true); trying = null; renderStore(); return; }
      const off = t.closest('[data-unequip]'); if (off) { api.equipItem(off.dataset.unequip, false); renderStore(); return; }
      const tr = t.closest('[data-try]');
      if (tr) { const id = tr.dataset.try; trying = trying === id ? null : id; renderStore(); }
    });
    modal.addEventListener('keydown', (e) => {
      const it = e.target.closest && e.target.closest('[data-try]');
      if (it && (e.key === 'Enter' || e.key === ' ') && e.target === it) { e.preventDefault(); it.click(); }
    });
    renderStore();
    modal.querySelector('.close').focus();
    startStoreAnim();
  }

  function storeLook() {
    const l = { ...api.wallet().equipped };
    if (trying) l[SHOP.byId[trying].cat] = trying;
    return l;
  }

  function renderStore() {
    if (!modal) return;
    const wl = api.wallet();
    modal.querySelector('.bal').textContent = fmtN(wl.drops);
    modal.querySelector('.tabs').innerHTML = SHOP.CATS.map(([k, label]) =>
      `<button class="tab" role="tab" aria-selected="${k === storeTab}" data-tab="${k}">${label}</button>`).join('');
    const btn = (it) => {
      if (wl.equipped[it.cat] === it.id) return `<span class="buy equipped" data-unequip="${it.id}">✓ Equipped · take off</span>`;
      if (wl.owned.includes(it.id)) return `<span class="buy owned" data-equip="${it.id}">Equip</span>`;
      if (it.exclusive) return `<span class="buy poor">🏅 Unlock every achievement</span>`;
      if (wl.drops < it.price.drops) return `<span class="buy poor">💧 ${fmtN(it.price.drops)} · need ${fmtN(it.price.drops - wl.drops)} more</span>`;
      return `<span class="buy" data-buy="${it.id}">💧 ${fmtN(it.price.drops)} · Buy</span>`;
    };
    modal.querySelector('.items').innerHTML = SHOP.ITEMS.filter((i) => i.cat === storeTab).sort((a, b) => (a.exclusive ? 1e9 : a.price.drops) - (b.exclusive ? 1e9 : b.price.drops)).map((i) => `
      <div class="item${trying === i.id ? ' trying-on' : ''}${wl.equipped[i.cat] === i.id ? ' is-equipped' : ''}" role="button" tabindex="0" data-try="${i.id}" aria-label="Try on ${esc(i.name)}">
        <canvas data-item="${i.id}" aria-hidden="true"></canvas>
        <span class="rarity r-${i.rarity}">${SHOP.RARITY[i.rarity]}</span>
        <span class="item-name">${esc(i.name)}</span>
        ${btn(i)}
      </div>`).join('');
    const tr = modal.querySelector('.trying');
    tr.hidden = !trying;
    if (trying) tr.textContent = `Trying on: ${SHOP.byId[trying].name}`;
    // phones: the preview opens as a pop-up for the tapped item, with its buttons
    const stage = modal.querySelector('.store-stage');
    stage.classList.toggle('open', touchStore() && !!trying);
    modal.querySelector('.sheet-back').hidden = !(touchStore() && trying);
    const it = trying && SHOP.byId[trying];
    modal.querySelector('.sheet-info').innerHTML = it
      ? `<span class="rarity r-${it.rarity}">${SHOP.RARITY[it.rarity]}</span><h3>${esc(it.name)}</h3>${btn(it)}<button class="btn small" data-act="untry">Close</button>`
      : '';
  }
  // the store on phones and tablets: just the items; tapping one opens its preview as a pop-up
  const touchStore = () => document.body.classList.contains('touch');

  // the try-on stage and item previews, animated while the store is open
  function startStoreAnim() {
    const sim = { trail: SHOP.makeTrail(), splats: [], blobs: [], burst: [], popT: 0, popping: 0, nextThrow: 0.6, floorX: 0, cards: {} };
    let last = performance.now();
    const fit = (c) => {
      const dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [ctx, r.width, r.height];
    };
    const paper = (ctx, w, h) => {
      ctx.fillStyle = '#efece4'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 12) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    };
    const floor = (ctx, w, y, size, off, h) => {
      for (let x = -size - (off % size); x < w + size; x += size) {
        ctx.fillStyle = '#1c1c1f'; ctx.fillRect(x, y, size + 1, h - y);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, h - y); ctx.clip();
        ctx.strokeStyle = '#2c2c31'; ctx.lineWidth = 1;
        for (let k = -h; k < size; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, h); ctx.lineTo(x + k + h, y); ctx.stroke(); }
        ctx.restore();
      }
    };
    const loop = (now) => {
      if (!modal || !modal.querySelector('.store-stage')) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000, colors = api.paintColors(), col = colors[Math.floor(t / 2.2) % colors.length];
      const ch = api.currentCharacter(), l = storeLook();
      // stage
      const [ctx, w, h] = fit(modal.querySelector('.stage'));
      paper(ctx, w, h);
      const s = Math.min(w / 190, h / 150), groundY = h * 0.78, heroX = w * 0.36, SCROLL = 70 * s;
      sim.floorX += SCROLL * dt;
      for (const sp of sim.splats) sp.x -= SCROLL * dt;
      sim.splats = sim.splats.filter((sp) => sp.x > -60);
      if ((sim.nextThrow -= dt) <= 0 && !sim.popping) { sim.nextThrow = 1.5; sim.blobs.push({ x: heroX + 14 * s, y: groundY - 24 * s, vx: (70 + Math.random() * 40) * s, vy: -120 * s, col }); }
      for (const b of sim.blobs) { b.vy += 300 * s * dt; b.x += b.vx * dt - SCROLL * dt; b.y += b.vy * dt; }
      sim.blobs = sim.blobs.filter((b) => { if (b.y >= groundY) { sim.splats.push({ x: b.x, col: b.col, seed: Math.random() * 6 }); return false; } return true; });
      for (const b of sim.blobs) { ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, 4 * s, 0, Math.PI * 2); ctx.fill(); }
      floor(ctx, w, groundY + 3 * s, 30 * s, sim.floorX, h);
      for (const sp of sim.splats) SHOP.drawSplat(ctx, l.splat, sp.x, groundY + 3 * s, 7 * s, sp.col, sp.seed);
      SHOP.drawFlag(ctx, l.flag, w * 0.76, groundY + 3 * s, s * 1.2, t);
      SHOP.stepTrail(sim.trail, sim.popping ? null : l.trail, heroX - 8 * s, groundY - 22 * s, dt, s, SCROLL * 1.4);
      SHOP.drawTrail(ctx, sim.trail, l.trail, s, t);
      if (l.pop) {
        sim.popT += dt;
        if (!sim.popping && sim.popT > 2.6) { sim.popping = 0.9; sim.popT = 0; SHOP.burst(sim.burst, l.pop, heroX, groundY - 20 * s, s); }
      } else sim.popping = 0;
      if (sim.popping) sim.popping = Math.max(0, sim.popping - dt);
      sim.burst = SHOP.stepBurst(sim.burst, dt, s);
      if (!sim.popping) {
        ctx.save(); ctx.translate(heroX, groundY + 3 * s);
        SHOP.drawHero(ctx, ch, { s: s * 1.3, col, t, run: (t * 2.4) % 1, moving: 1, air: false, face: 1, squash: 1 }, l);
        ctx.restore();
      }
      SHOP.drawBurst(ctx, sim.burst, l.pop);
      // item cards
      modal.querySelectorAll('canvas[data-item]').forEach((c) => {
        const it = SHOP.byId[c.dataset.item];
        const [cx, cw, chh] = fit(c);
        paper(cx, cw, chh);
        const k = chh / 60, gy = chh * 0.86;
        const cs = sim.cards[it.id] = sim.cards[it.id] || { trail: SHOP.makeTrail(), burst: [], k: Math.random() * 2 };
        if (it.cat === 'hat') { cx.save(); cx.translate(cw / 2, gy + 26 * k); SHOP.drawHero(cx, ch, { s: k * 1.12, col: colors[0], t, run: 0, moving: 0, air: false, face: 1, squash: 1 }, { hat: it.id }); cx.restore(); }
        else if (it.cat === 'trail') {
          SHOP.stepTrail(cs.trail, it.id, cw * 0.62 - 6 * k, gy - 16 * k, dt, k * 0.8, 40 * k);
          SHOP.drawTrail(cx, cs.trail, it.id, k * 0.8, t);
          cx.save(); cx.translate(cw * 0.62, gy); SHOP.drawHero(cx, ch, { s: k * 0.9, col: colors[1], t, run: (t * 2.4) % 1, moving: 1, air: false, face: 1, squash: 1 }, {}); cx.restore();
        } else if (it.cat === 'skin') { cx.save(); cx.translate(cw / 2, gy); SHOP.drawHero(cx, ch, { s: k * 1.05, col: colors[2], t, run: 0, moving: 0, air: false, face: 1, squash: 1 }, { skin: it.id }); cx.restore(); }
        else if (it.cat === 'splat') colors.slice(0, 3).forEach((p, i) => SHOP.drawSplat(cx, it.id, cw * (0.25 + i * 0.25), chh * (0.45 + (i % 2) * 0.18), 8 * k, p, i * 1.7 + 1));
        else if (it.cat === 'flag') SHOP.drawFlag(cx, it.id, cw * 0.42, gy, k * 0.95, t);
        else if (it.cat === 'pop') {
          cs.k += dt;
          if (cs.k > 1.8) { cs.k = 0; SHOP.burst(cs.burst, it.id, cw / 2, chh * 0.55, k * 0.45); }
          cs.burst = SHOP.stepBurst(cs.burst, dt * 0.9, k * 0.45);
          SHOP.drawBurst(cx, cs.burst, it.id);
        }
      });
      const di = modal.querySelector('.drop-icon');
      if (di) { const [dc, dw, dh] = fit(di); dc.clearRect(0, 0, dw, dh); SHOP.drawDrop(dc, dw / 2, dh * 0.62, Math.min(dw, dh) * 0.32); }
      charAnim = requestAnimationFrame(loop);
    };
    charAnim = requestAnimationFrame(loop);
  }

  // ---------- character picker ----------
  let charAnim = 0;
  function openCharacters() {
    if (modal) close();
    modal = document.createElement('div');
    modal.className = 'modal-back';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ch-title">
        <div class="modal-head">
          <h2 id="ch-title">🎭 Characters</h2>
          <span class="star-count"></span>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body"><div class="chars"></div>
          <p class="note">Collect paint cans to earn stars. More stars unlock more characters.</p></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) return close();
      const t = e.target.closest('[data-act],[data-char]');
      if (!t) return;
      if (t.dataset.act === 'close') return close();
      if (t.dataset.char && api.setCharacter(t.dataset.char)) { renderChars(); api.toast('Character selected'); }
    });
    renderChars();
    modal.querySelector('.close').focus();
    const colors = api.paintColors();
    const loop = (now) => {
      if (!modal) return;
      const t = now / 1000;
      modal.querySelectorAll('canvas[data-id]').forEach((c, i) => {
        const ch = CHARACTERS.find((x) => x.id === c.dataset.id);
        const dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
        if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, r.width, r.height);
        const locked = c.dataset.locked === '1';
        ctx.globalAlpha = locked ? 0.35 : 1;
        ctx.save(); ctx.translate(r.width / 2, r.height - 12);
        ch.draw(ctx, {
          s: r.height / 62, col: locked ? '#8a8a92' : colors[(Math.floor(t / 1.6) + i) % colors.length], t,
          run: (t * 2) % 1, moving: locked ? 0 : 1, air: false, face: 1, squash: 1,
        });
        ctx.restore();
        ctx.globalAlpha = 1;
      });
      charAnim = requestAnimationFrame(loop);
    };
    charAnim = requestAnimationFrame(loop);
  }

  function renderChars() {
    const stars = api.totalStars();
    modal.querySelector('.star-count').innerHTML = `<span class="stars">★</span> ${stars} stars`;
    modal.querySelector('.chars').innerHTML = api.characters().map((c) => `
      <button class="char${c.selected ? ' selected' : ''}${c.unlocked ? '' : ' locked'}" data-char="${c.unlocked ? esc(c.id) : ''}"
        ${c.unlocked ? '' : 'aria-disabled="true"'} aria-pressed="${c.selected}">
        <canvas data-id="${esc(c.id)}" data-locked="${c.unlocked ? 0 : 1}" aria-hidden="true"></canvas>
        <span class="char-name">${esc(c.name)}</span>
        <span class="char-sub">${c.selected ? '✓ Playing as' : c.unlocked ? esc(c.blurb) : `🔒 ${c.stars} ★ needed · ${c.stars - stars} to go`}</span>
      </button>`).join('');
  }

  document.addEventListener('keydown', (e) => {
    if (!modal) return;
    if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') { e.preventDefault(); close(); }
    if (view === 'level' && e.key === 'ArrowLeft') { levelIdx = (levelIdx + LEVELS.length - 1) % LEVELS.length; load(); }
    if (view === 'level' && e.key === 'ArrowRight') { levelIdx = (levelIdx + 1) % LEVELS.length; load(); }
  });

  function board(title, swatch, subtitle, rows, value, mine, mineValue) {
    const uid = Cloud.user && Cloud.user.uid;
    const items = rows.length
      ? `<ol>${rows.map((r, i) => `<li class="${r.uid === uid ? 'me' : ''}">
            <span class="rank${r.rank === 1 ? ' first' : ''}">${r.rank}</span>${avatar(r.photo)}<span class="who">${esc(r.name)}</span><span class="val">${value(r)}</span>
          </li>`).join('')}</ol>`
      : '<div class="empty">No one yet. Be the first!</div>';
    const showMine = mine && mineValue(mine) !== null && !rows.some((r) => r.uid === uid);
    return `<section class="board">
      <h3><span class="swatch" style="background:${swatch}"></span>${title}<small>${subtitle}</small></h3>
      ${items}
      ${showMine ? `<div class="mine">Your best: <b>${mineValue(mine)}</b></div>` : ''}
    </section>`;
  }

  async function load() {
    if (!modal) return;
    const content = modal.querySelector('.content');
    modal.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    modal.querySelector('.level-pick').style.visibility = view === 'level' ? 'visible' : 'hidden';
    modal.querySelector('select').value = String(levelIdx);
    content.innerHTML = '<p class="note">Loading…</p>';
    const signInNote = Cloud.user ? '' :
      `<p class="note">Want your name up here? <button class="btn small" data-act="signin">${GOOGLE_G} Sign in with Google</button></p>`;
    const requested = `${view}:${levelIdx}`;
    try {
      if (view === 'level') {
        const lv = LEVELS[levelIdx];
        const lb = await Cloud.leaderboard(lv.name);
        if (`${view}:${levelIdx}` !== requested || !modal) return;
        content.innerHTML = `<div class="boards">
            ${board('⚡ Fastest', 'var(--red)', 'any stars', lb.fastest, (r) => `${fmtTime(r.bestTime)} <span class="stars">${starsText(r.bestStars)}</span>`, lb.me, (m) => fmtTime(m.bestTime))}
            ${board('★★★ Perfect run', 'var(--yellow)', 'all 3 cans', lb.perfect, (r) => fmtTime(r.best3Time), lb.me, (m) => (m.best3Time === undefined ? null : fmtTime(m.best3Time)))}
            ${board('🎨 Fewest throws', 'var(--blue)', 'paint used', lb.efficient, (r) => `${r.fewestThrows} 🖌`, lb.me, (m) => (m.fewestThrows === undefined ? null : `${m.fewestThrows} 🖌`))}
          </div>${signInNote}`;
      } else {
        const rows = await Cloud.starBoard(25);
        if (`${view}:${levelIdx}` !== requested || !modal) return;
        const uid = Cloud.user && Cloud.user.uid;
        content.innerHTML = `<section class="board" style="max-width:560px;margin:0 auto">
            <h3><span class="swatch" style="background:var(--yellow)"></span>Most stars collected<small>${LEVELS.length * 3} possible</small></h3>
            ${rows.length ? `<ol>${rows.map((r, i) => `<li class="${r.uid === uid ? 'me' : ''}">
              <span class="rank${r.rank === 1 ? ' first' : ''}">${r.rank}</span>${avatar(r.photo)}<span class="who">${esc(r.name)} <small style="color:var(--ink-2)">· ${r.levelsCleared || 0} levels</small></span>
              <span class="val"><span class="stars">★</span> ${r.totalStars || 0}</span></li>`).join('')}</ol>` : '<div class="empty">No one yet. Be the first!</div>'}
          </section>${signInNote}`;
      }
    } catch (e) {
      console.warn(e);
      if (modal) content.innerHTML = `<div class="error">${esc(friendlyError(e))}</div>`;
    }
  }

  return {
    init(gameApi) {
      api = gameApi;
      Cloud.onChange((u) => {
        render();
        if (u) sync();
        if (u && gateThen) { const then = gateThen; close(); then(); }   // signed in from the gate: go play
      });
      render();
    },
    setMode(m) { if (m !== mode) { mode = m; render(); } },
    openLeaderboard,
    openCharacters,
    openStore,
    openSignInGate,
    openControls,
    openAchievements,
    refresh: () => render(),
    get modalOpen() { return !!modal; },
    // true right after a press that only closed the account menu: the game ignores that press
    get swallowPress() { return performance.now() - closedAt < 400; },
  };
})();
