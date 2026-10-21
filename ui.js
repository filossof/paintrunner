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
      : `<button class="btn" data-act="signin">${GOOGLE_G}<span>Sign in with Google</span>${api.giftPending && api.giftPending() ? '<span class="gift-badge">🎁 +500</span>' : ''}</button>`;
    // the Daily: pulses with NEW until today's is done
    const dailyDone = api.daily && api.daily().flags & 1;
    const left = `<button class="btn daily${dailyDone ? '' : ' fresh'}" data-act="daily">📅 Daily${dailyDone ? ' ✓' : ' <b class="new-badge">NEW</b>'}</button>` +
      `<button class="btn" data-act="boards">🏆 Leaderboards <small>(L)</small></button>` +
      `<button class="btn" data-act="chars">🎭 Characters <small>(C)</small></button>` +
      `<button class="btn" data-act="store">🛍️ Store <small>(S)</small></button>` +
      `<button class="btn" data-act="settings">⚙️ Settings</button>` +
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
    if (act === 'settings') openSettings();
    if (act === 'ach') openAchievements();
    if (act === 'daily') openDaily();
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

  async function signIn(via) {
    try {
      await Cloud.signIn(typeof via === 'string' ? via : 'menu');
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
      if (merged && api.afterSignIn) api.afterSignIn();   // today's Daily time, and the sign-in gift
    } catch (e) {
      console.warn('sync failed', e);
      if (e && e.code === 'permission-denied') api.toast('Online saving is not switched on yet');
    }
  }

  // ---------- leaderboard window ----------
  let view = 'level', levelIdx = 0;

  function openLeaderboard(idx = 0) {
    if (idx < 0) return openDaily();   // just played the Daily: its board is today's board
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
    if (modal) modal.remove();
    modal = null;
    cancelAnimationFrame(charAnim);
  }

  // ---------- the Daily Chase ----------
  // today's level, your streak and its rewards, the time until the next one, and today's board
  const fmtLeft = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
  const STREAK_PRIZES = ['50', '75', '100', '🎁', '150', '200', '300'];
  function openDaily() {
    if (modal) close();
    const d = api.daily();
    modal = document.createElement('div');
    modal.className = 'modal-back';
    const done = d.flags & 1, cans3 = d.flags & 2, podium = d.flags & 4;
    const sc = d.streak, cycleDay = sc.count ? ((sc.count - 1) % 7) + 1 : 0;
    // the row of 7 days the streak is in (after a full week, tomorrow starts the next row)
    const weekStart = !sc.today && cycleDay === 7 ? sc.count : sc.count - cycleDay;
    const milestones = [[7, 'streakblaze'], [14, 'laurel'], [30, 'livingpaint'], [100, 'supernova']];
    const cell = (i) => {
      const n = weekStart + i + 1, got = n <= sc.count, isNext = !sc.today && n === sc.count + 1;
      const ms = milestones.find(([m]) => m === n), prize = ms ? '🔥' : STREAK_PRIZES[i];
      return `<div class="sd${got ? ' got' : ''}${isNext ? ' next' : ''}"><small>Day ${n}</small><b>${got ? '✓' : prize === '🎁' || prize === '🔥' ? prize : prize + ' 💧'}</b></div>`;
    };
    modal.innerHTML = `
      <div class="modal daily" role="dialog" aria-modal="true" aria-labelledby="daily-title" style="max-width:720px">
        <div class="modal-head">
          <h2 id="daily-title">📅 Daily Chase</h2>
          <span class="daily-left">New one in ${fmtLeft(d.msToNext)}</span>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          <div class="daily-card">
            <div>
              <h3>${esc(d.name)}</h3>
              <p class="daily-meta">${d.colors.map((c) => `<i style="background:${c}"></i>`).join('')} <span>${d.screens.toFixed(1)} screens · the same level for everyone today</span></p>
              <p class="daily-rewards">
                <span class="${done ? 'claimed' : ''}">${done ? '✓' : '+100 💧'} Finish it</span>
                <span class="${cans3 ? 'claimed' : ''}">${cans3 ? '✓' : '+50 💧'} All 3 cans</span>
                <span class="${podium ? 'claimed' : ''}">${podium ? '✓' : '🥇🥈🥉'} Top 3 today</span>
              </p>
              ${d.best !== null ? `<p class="daily-best">Your best today: <b>${d.best.toFixed(3)}s</b></p>` : ''}
            </div>
            <button class="btn big daily-play" data-act="play-daily">▶ ${done ? 'Play again' : 'Play'}</button>
          </div>
          <section class="streak">
            <h3>🔥 ${sc.count ? `${sc.count}-day streak` : 'Start a streak'} <small>${sc.today ? 'today counted ✓' : 'finish any level today to keep it going'} · best ${sc.best}</small></h3>
            <div class="streak-row">${[0, 1, 2, 3, 4, 5, 6].map(cell).join('')}</div>
            <p class="note">${sc.saver ? '🪣 Streak saver ready: one missed day a week is forgiven.' : '🪣 Streak saver used this week.'} Special rewards:
              ${milestones.map(([m, id]) => `<span class="ms${d.owned(id) ? ' own' : ''}">${m} days: ${esc(SHOP.byId[id].name)}${d.owned(id) ? ' ✓' : ''}</span>`).join(' ')}</p>
          </section>
          <section>
            <h3>🏁 Today's fastest</h3>
            <div class="daily-board"><p class="note">Loading…</p></div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-act="close"]')) return close();
      if (e.target.closest('[data-act="play-daily"]')) { close(); api.playDaily(); }
    });
    modal.querySelector('.daily-play').focus();
    // today's board
    const board = modal.querySelector('.daily-board'), uid = Cloud.user && Cloud.user.uid;
    if (!Cloud.available) { board.innerHTML = '<p class="note">The leaderboard is offline right now.</p>'; return; }
    Cloud.dailyTop(d.day, 10).then(({ rows, me }) => {
      if (!document.body.contains(board)) return;
      const medal = (rank) => ['🥇', '🥈', '🥉'][rank - 1] || `${rank}.`;
      board.innerHTML = rows.length ? `<ol>${rows.map((r) => `<li class="${r.uid === uid ? 'me' : ''}"><span class="rk">${medal(r.rank)}</span>${r.photo ? avatar(r.photo) : ''}<span class="nm">${esc(r.name)}</span><span class="tm">${r.time.toFixed(3)}s</span></li>`).join('')}</ol>`
        : '<p class="note">Nobody has finished today\'s chase yet. Be the first!</p>';
      if (!uid && d.best !== null) {
        // a guest's time, where it would be: grayed out, with a button to claim it
        const rank = 1 + rows.filter((x) => x.time < d.best).length;
        const li = `<li class="guest"><span class="rk">${rank}.</span><span class="nm">You <small>(guest)</small></span><span class="tm">${d.best.toFixed(3)}s</span><button class="btn small" data-act="signin">Sign in to claim</button></li>`;
        const ol = board.querySelector('ol');
        if (!ol) board.innerHTML = `<ol>${li}</ol>`;
        else if (rank <= rows.length) ol.children[rank - 1].insertAdjacentHTML('beforebegin', li);
        else ol.insertAdjacentHTML('beforeend', li);
      }
      if (!uid) board.insertAdjacentHTML('beforeend', `<p class="note">${d.best !== null ? 'Sign in and your time goes on today\'s board.' : 'Want your name up here?'} <button class="btn small" data-act="signin">${GOOGLE_G} Sign in with Google</button>${api.giftPending() ? ' <b>🎁 +500 Drops</b> for signing in' : ''}</p>`);
      else if (me && !rows.some((r) => r.uid === uid)) board.insertAdjacentHTML('beforeend', `<p class="note">Your best today: ${me.time.toFixed(3)}s</p>`);
    }).catch((e) => { if (document.body.contains(board)) board.innerHTML = `<p class="note">${friendlyError(e)}</p>`; });
    board.addEventListener('click', (e) => { if (e.target.closest('[data-act="signin"]')) { Cloud.note('claimClick'); signIn('daily'); } });
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
  // ---------- settings: the ghost, touch controls, sound, full screen ----------
  const GHOST_MODES = [
    { id: 'top', icon: '👻', name: '#1 record', text: 'Race the fastest run on each level' },
    { id: 'mine', icon: '🏃', name: 'My best', text: 'Race your own best run' },
    { id: 'off', icon: '🚫', name: 'Off', text: 'No ghost' },
  ];
  function openSettings() {
    if (modal) close();
    modal = document.createElement('div');
    modal.className = 'modal-back';
    const touch = api.touchControls();
    modal.innerHTML = `
      <div class="modal settings" role="dialog" aria-modal="true" aria-labelledby="set-title" style="max-width:640px">
        <div class="modal-head">
          <h2 id="set-title">⚙️ Settings</h2>
          <button class="close" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body"></div>
      </div>`;
    document.body.appendChild(modal);
    const body = modal.querySelector('.modal-body');
    const render = () => {
      const g = Ghost.chosen() ? Ghost.mode : null, cur = api.controls();
      const scheme = CONTROL_SCHEMES.find((c) => c.id === cur) || CONTROL_SCHEMES[0];
      body.innerHTML = `
        <section class="set-sec">
          <h3>👻 Ghost <small>a see-through runner to race${touch ? '' : ' · <kbd>G</kbd>'}</small></h3>
          <div class="set-opts" role="radiogroup" aria-label="Ghost">${GHOST_MODES.map((m) => `
            <button class="set-opt" role="radio" aria-checked="${m.id === g}" data-ghost="${m.id}">
              <span class="set-ico" aria-hidden="true">${m.icon}</span><b>${m.name}</b><small>${m.text}</small></button>`).join('')}</div>
          <p class="note">Record runs are saved from now on. Until a level's #1 player races it again, you race the fastest recorded run there.</p>
        </section>
        ${touch ? `<section class="set-sec">
          <h3>🎮 Controls</h3>
          <div class="set-opts" role="radiogroup" aria-label="Touch controls">${CONTROL_SCHEMES.map((c) => `
            <button class="set-opt" role="radio" aria-checked="${c.id === cur}" data-scheme="${c.id}">
              <span class="ctl-pic" aria-hidden="true">${c.pic}</span><b>${c.name}</b></button>`).join('')}</div>
          <p class="note">${scheme.text}</p>
        </section>` : ''}
        <section class="set-sec">
          <h3>📖 Story</h3>
          <div class="set-switches">
            <button class="btn small" data-story="intro">▶ The Great Fade</button>
            ${api.endingUnlocked() ? '<button class="btn small" data-story="ending">▶ Chapter 2 teaser</button>' : '<button class="btn small" disabled title="Finish level 45 to unlock">🔒 The ending</button>'}
          </div>
        </section>
        <section class="set-sec">
          <h3>🔊 Sound</h3>
          <div class="set-switches">
            <button class="switch" role="switch" aria-checked="${Sound.musicOn}" data-switch="music"><i></i>Music${touch ? '' : ' <kbd>M</kbd>'}</button>
            <button class="switch" role="switch" aria-checked="${Sound.sfxOn}" data-switch="sfx"><i></i>Sound effects</button>
          </div>
        </section>
        ${touch ? '' : `<section class="set-sec">
          <h3>🖥️ Screen</h3>
          <div class="set-switches"><button class="btn small" data-act="full">⛶ Full screen <kbd>F</kbd></button></div>
        </section>`}`;
    };
    render();
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-act="close"]')) return close();
      const st = e.target.closest('[data-story]');
      if (st) { close(); api.playStory(st.dataset.story); return; }
      const t = e.target.closest('[data-ghost], [data-scheme], [data-switch], [data-act="full"]');
      if (!t) return;
      if (t.dataset.ghost) api.setGhostMode(t.dataset.ghost);
      if (t.dataset.scheme) api.setControls(t.dataset.scheme);
      if (t.dataset.switch === 'music') Sound.toggleMusic();
      if (t.dataset.switch === 'sfx') Sound.setSfx(!Sound.sfxOn);
      if (t.dataset.act === 'full') { close(); api.toggleFullscreen(); return; }
      render();
      const again = body.querySelector(`[data-ghost="${t.dataset.ghost}"], [data-scheme="${t.dataset.scheme}"], [data-switch="${t.dataset.switch}"]`);
      if (again) again.focus();
    });
    (body.querySelector('[aria-checked="true"]') || modal.querySelector('.close')).focus({ preventScroll: true });
  }

  // ---------- after your first cleared level: race the #1 ghost? ----------
  function openGhostIntro() {
    if (modal) close();
    modal = document.createElement('div');
    modal.className = 'modal-back';
    modal.innerHTML = `
      <div class="modal ghost-intro" role="dialog" aria-modal="true" aria-labelledby="gi-title" style="max-width:440px">
        <div class="modal-body">
          <canvas class="gi-scene" width="400" height="110" aria-hidden="true"></canvas>
          <h2 id="gi-title">👻 Race the record holder?</h2>
          <p>See a ghost of the fastest run on each level while you play: the #1 record. Follow its path, find its shortcuts, and try to beat it.</p>
          <div class="gi-actions">
            <button class="btn big" data-gi="top">👻 Yes, show me the ghost</button>
            <button class="btn" data-gi="off">No thanks</button>
          </div>
          <p class="note">You can change this any time in ⚙️ Settings.</p>
        </div>
      </div>`;
    document.body.appendChild(modal);
    // a little race: the ghost a step ahead, you chasing
    const cv = modal.querySelector('.gi-scene'), cx = cv.getContext('2d');
    const ch = (api.characters().find((c) => c.selected) || api.characters()[0]);
    let raf = 0;
    const frame = (now) => {
      if (!document.body.contains(cv)) return;
      const t = now / 1000, w = cv.width, h = cv.height, floor = h - 18;
      cx.clearRect(0, 0, w, h);
      cx.fillStyle = '#1c1c1f'; cx.fillRect(0, floor, w, h - floor);
      const lap = (t * 0.22) % 1, x = -30 + lap * (w + 60);
      const hop = (ph) => Math.abs(Math.sin(t * 6 + ph)) * 6;
      const draw = (px, alpha, ph, look) => {
        cx.save(); cx.globalAlpha = alpha; cx.translate(px, floor - hop(ph));
        SHOP.drawHero(cx, ch, { s: 1, col: alpha < 1 ? '#e9e6df' : '#2f7bff', t, run: (t * 2.2 + ph) % 1, moving: 1, air: hop(ph) > 2, face: 1, squash: 1 }, look);
        cx.restore();
      };
      draw(x + 46, 0.38, 0.9, {});
      draw(x, 1, 0, api.look ? api.look() : {});
      cx.globalAlpha = 0.8; cx.fillStyle = '#fff'; cx.font = '700 11px ui-rounded, system-ui, sans-serif'; cx.textAlign = 'center';
      cx.fillText('👻 #1', x + 46, floor - 52); cx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const choose = (m) => {
      cancelAnimationFrame(raf);
      api.setGhostMode(m);
      close();
      api.toast(m === 'top' ? (api.touchControls() ? '👻 Ghost on! Tap Retry to race it' : '👻 Ghost on! Press R to race it') : 'No ghost. Turn it on any time in ⚙️ Settings', 2600);
    };
    modal.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gi]');
      if (b) return choose(b.dataset.gi);
      if (e.target === modal) choose('off');
    });
    modal.querySelector('[data-gi="top"]').focus();
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
      if (it.exclusive) return `<span class="buy poor">${it.how || '🏅 A special reward'}</span>`;
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
      `<p class="note">Want your name up here? <button class="btn small" data-act="signin">${GOOGLE_G} Sign in with Google</button>${api.giftPending() ? ' <b>🎁 +500 Drops</b> for signing in' : ''}</p>`;
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
      });
      render();
    },
    setMode(m) { if (m !== mode) { mode = m; render(); } },
    openLeaderboard,
    openCharacters,
    openStore,
    openSettings,
    openGhostIntro,
    openAchievements,
    openDaily,
    signIn,
    refresh: () => render(),
    get modalOpen() { return !!modal; },
    // true right after a press that only closed the account menu: the game ignores that press
    get swallowPress() { return performance.now() - closedAt < 400; },
  };
})();
