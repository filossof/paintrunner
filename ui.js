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
  const fmtTime = (t) => (t === undefined || t === null ? '—' : `${t.toFixed(2)}s`);
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
    const right = u
      ? `<span class="chip" title="${esc(u.email || '')}">${avatar(u.photoURL)}<span>${esc((u.displayName || 'Painter').split(' ')[0])}</span><button class="out" data-act="signout">Sign out</button></span>`
      : `<button class="btn" data-act="signin">${GOOGLE_G}<span>Sign in with Google</span></button>`;
    const left = `<button class="btn" data-act="boards">🏆 Leaderboards <small>(L)</small></button>` +
      `<button class="btn" data-act="full" title="Full screen (F)">⛶ Full screen <small>(F)</small></button>` +
      (Cloud.isAdmin ? `<a class="btn small" href="stats.html" target="_blank" rel="noopener">📊 Stats</a>` : '');
    overlay.innerHTML = `<div class="corner left">${left}</div><div class="corner">${right}</div>`;
  }

  overlay.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'signin') signIn();
    if (act === 'signout') { await Cloud.signOut(); api.toast('Signed out'); }
    if (act === 'boards') openLeaderboard(api.currentLevel());
    if (act === 'full') api.toggleFullscreen();
  });
  // keep clicks on the overlay from also hitting the game underneath
  overlay.addEventListener('mousedown', (e) => e.stopPropagation());

  async function signIn() {
    try {
      await Cloud.signIn();
    } catch (e) {
      console.error(e);
      api.toast('Sign-in failed');
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
    if (modal) modal.remove();
    modal = null;
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
      Cloud.onChange((u) => { render(); if (u) sync(); });
      render();
    },
    setMode(m) { if (m !== mode) { mode = m; render(); } },
    openLeaderboard,
    get modalOpen() { return !!modal; },
  };
})();
