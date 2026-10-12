'use strict';

/* Owner-only stats dashboard. The database rules only let ADMIN_EMAIL read players' emails
   and the run log, so this page shows nothing useful to anyone else. */

(function () {
  const app = document.getElementById('app');
  const who = document.getElementById('who');
  const tip = document.getElementById('tip');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const avatar = (url) => (url ? `<img class="avatar" src="${esc(url)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '<span class="avatar"></span>');
  const fmtTime = (t) => (t === undefined || t === null || Number.isNaN(t) ? '—' : `${t.toFixed(1)}s`);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const ago = (ms) => {
    if (!ms) return '—';
    const s = (Date.now() - ms) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
    return new Date(ms).toLocaleDateString();
  };
  const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  function signInScreen(msg) {
    app.innerHTML = `<p class="msg">${msg}</p><p class="msg"><button class="btn" id="signin">Sign in with Google</button></p>`;
    document.getElementById('signin').onclick = () => Cloud.signIn().catch((e) => alert(e.message));
  }

  Cloud.onChange(async (u) => {
    who.innerHTML = u
      ? `<span class="chip">${avatar(u.photoURL)} ${esc(u.displayName || u.email)} <button class="btn" id="out">Sign out</button></span>`
      : '';
    if (u) document.getElementById('out').onclick = () => Cloud.signOut();
    if (!Cloud.available) { app.innerHTML = '<p class="msg">Firebase could not be loaded.</p>'; return; }
    if (!u) return signInScreen('Sign in with the owner account to see the stats.');
    if (!Cloud.isAdmin) return signInScreen(`Only ${esc(ADMIN_EMAIL)} can see the stats.`);
    app.innerHTML = '<p class="msg">Loading…</p>';
    try {
      render(await Cloud.adminData());
    } catch (e) {
      console.error(e);
      app.innerHTML = `<p class="msg">${e.code === 'permission-denied'
        ? 'The database refused the request. Publish firestore.rules in the Firebase console first.'
        : esc(e.message)}</p>`;
    }
  });

  function render({ players, runs }) {
    const now = Date.now(), week = 7 * 86400 * 1000;
    const done = runs.filter((r) => r.completed);
    const quits = runs.filter((r) => !r.completed);
    const active = players.filter((p) => now - (p.lastSeen || 0) < week).length;
    const totalStars = players.reduce((n, p) => n + (p.totalStars || 0), 0);

    // ---- per level ----
    const perLevel = LEVELS.map((l, i) => {
      const lr = runs.filter((r) => r.level === l.name);
      const c = lr.filter((r) => r.completed);
      const q = lr.filter((r) => !r.completed);
      const clearedBy = new Set(c.map((r) => r.uid));
      const triedBy = new Set(lr.map((r) => r.uid));
      return {
        i, name: l.name, cleared: clearedBy.size, tried: triedBy.size, completions: c.length, quits: q.length,
        medianTime: median(c.map((r) => r.time)), bestTime: c.length ? Math.min(...c.map((r) => r.time)) : null,
        avgDeaths: c.length ? c.reduce((n, r) => n + r.deaths, 0) / c.length : null,
        perfect: c.filter((r) => r.stars === 3).length,
      };
    });
    const maxCleared = Math.max(1, ...perLevel.map((l) => l.cleared));

    // ---- per player ----
    const runsBy = {};
    runs.forEach((r) => { (runsBy[r.uid] = runsBy[r.uid] || []).push(r); });
    const rows = players
      .map((p) => ({ ...p, runs: (runsBy[p.uid] || []).length }))
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    app.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="v">${players.length}</div><div class="l">Players signed in</div></div>
        <div class="kpi"><div class="v">${active}</div><div class="l">Active in the last 7 days</div></div>
        <div class="kpi"><div class="v">${done.length}</div><div class="l">Levels completed</div></div>
        <div class="kpi"><div class="v">${quits.length}</div><div class="l">Attempts given up</div></div>
        <div class="kpi"><div class="v"><span class="stars">★</span> ${totalStars}</div><div class="l">Stars collected</div></div>
      </div>

      <section class="card">
        <h2>Players who cleared each level</h2>
        <p class="sub">Where players drop off. Hover a bar for details.</p>
        <div class="funnel">
          ${perLevel.map((l) => `<div class="row" data-tip="${esc(`${l.i + 1}. ${l.name}: ${l.cleared} cleared · ${l.tried} tried · ${l.quits} give-ups`)}">
              <div class="name">${l.i + 1}. ${esc(l.name)}</div>
              <div class="track"><div class="bar" style="width:${(l.cleared / maxCleared) * 100}%"></div>
                <span class="val" style="left:${(l.cleared / maxCleared) * 100}%">${l.cleared}</span></div>
            </div>`).join('')}
        </div>
      </section>

      <section class="card">
        <h2>Level difficulty</h2>
        <p class="sub">Completion rate = completions ÷ (completions + give-ups). Low rate or many deaths = hard level.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Level</th><th class="num">Tried</th><th class="num">Cleared</th><th class="num">Completion rate</th>
            <th class="num">Avg deaths</th><th class="num">Median time</th><th class="num">Record</th><th class="num">★★★ runs</th></tr></thead>
          <tbody>${perLevel.map((l) => `<tr>
            <td>${l.i + 1}. ${esc(l.name)}</td><td class="num">${l.tried}</td><td class="num">${l.cleared}</td>
            <td class="num">${pct(l.completions, l.completions + l.quits)}</td>
            <td class="num">${l.avgDeaths === null ? '—' : l.avgDeaths.toFixed(1)}</td>
            <td class="num">${fmtTime(l.medianTime)}</td><td class="num">${fmtTime(l.bestTime)}</td>
            <td class="num">${l.perfect}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>

      <section class="card">
        <h2>Players</h2>
        <p class="sub">Most recently active first.</p>
        ${rows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Player</th><th>Email</th><th>Joined</th><th>Last seen</th><th class="num">Levels</th><th class="num">Stars</th><th class="num">Runs</th></tr></thead>
          <tbody>${rows.map((p) => `<tr>
            <td>${avatar(p.photo)} ${esc(p.fullName || p.name || '—')}</td>
            <td class="muted">${esc(p.email || '—')}</td>
            <td>${p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : '—'}</td>
            <td>${ago(p.lastSeen)}</td>
            <td class="num">${p.levelsCleared || 0}</td>
            <td class="num"><span class="stars">★</span> ${p.totalStars || 0}</td>
            <td class="num">${p.runs}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="empty">Nobody has signed in yet.</p>'}
      </section>

      <section class="card">
        <h2>Recent activity</h2>
        <p class="sub">The latest ${Math.min(runs.length, RECENT_MAX)} attempts, newest first.</p>
        <div id="recent"></div>
      </section>`;

    recent = runs.slice(0, RECENT_MAX);
    recentPage = 0;
    renderRecent();
  }

  // ---- recent activity: up to 200 attempts, 50 per page ----
  const RECENT_MAX = 200, PAGE_SIZE = 50;
  let recent = [], recentPage = 0;

  function renderRecent() {
    const box = document.getElementById('recent');
    if (!box) return;
    if (!recent.length) { box.innerHTML = '<p class="empty">No games played yet.</p>'; return; }
    const pages = Math.ceil(recent.length / PAGE_SIZE);
    const start = recentPage * PAGE_SIZE;
    const rows = recent.slice(start, start + PAGE_SIZE);
    const pager = pages > 1 ? `<div class="pager">
        <button class="btn" data-page="prev" ${recentPage === 0 ? 'disabled' : ''}>◀ Newer</button>
        <span>${start + 1}–${start + rows.length} of ${recent.length} · page ${recentPage + 1} / ${pages}</span>
        <button class="btn" data-page="next" ${recentPage >= pages - 1 ? 'disabled' : ''}>Older ▶</button>
      </div>` : '';
    box.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>When</th><th>Player</th><th>Level</th><th>Result</th><th class="num">Time</th><th class="num">Stars</th><th class="num">Deaths</th><th class="num">Throws</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td title="${esc(new Date(r.at).toLocaleString())}">${ago(r.at)}</td><td>${esc(r.name)}</td><td>${r.levelIdx + 1}. ${esc(r.level)}</td>
          <td>${r.completed ? '✅ cleared' : '🏳️ gave up'}</td>
          <td class="num">${fmtTime(r.time)}</td><td class="num stars">${'★'.repeat(r.stars || 0)}</td>
          <td class="num">${r.deaths}</td><td class="num">${r.throws}</td></tr>`).join('')}</tbody>
      </table></div>${pager}`;
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    recentPage += b.dataset.page === 'next' ? 1 : -1;
    renderRecent();
    document.getElementById('recent').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  // hover tooltip for the funnel
  document.addEventListener('mousemove', (e) => {
    const row = e.target.closest && e.target.closest('[data-tip]');
    if (!row) { tip.style.opacity = 0; return; }
    tip.textContent = row.dataset.tip;
    tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${e.clientY + 14}px`;
    tip.style.opacity = 1;
  });
})();
