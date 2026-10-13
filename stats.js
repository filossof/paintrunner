'use strict';

/* Owner-only stats dashboard. The database rules only let ADMIN_EMAIL read players' emails,
   the run log and play sessions, so this page shows nothing useful to anyone else. */

(function () {
  const app = document.getElementById('app');
  const who = document.getElementById('who');
  const tip = document.getElementById('tip');
  const rangeEl = document.getElementById('range');
  const refreshBtn = document.getElementById('refresh');

  // ---------------- small helpers ----------------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const avatar = (url) => (url ? `<img class="avatar" src="${esc(url)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '<span class="avatar"></span>');
  const fmtTime = (t) => (t === undefined || t === null || Number.isNaN(t) ? '—' : `${t.toFixed(2)}s`);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const num = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));
  function dur(sec) {
    if (!sec) return '—';
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }
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
  const sum = (xs, f = (x) => x) => xs.reduce((n, x) => n + (f(x) || 0), 0);
  const DAY = 86400000;
  const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('prStats.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('prStats.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  // ---------------- time range ----------------
  const RANGES = [['today', 'Today'], ['week', '7 days'], ['month', '30 days'], ['all', 'All time']];
  let range = store.get('range', 'week');
  const rangeStart = () => {
    const today = startOfDay(Date.now());
    return { today, week: today - 6 * DAY, month: today - 29 * DAY, all: 0 }[range];
  };
  const rangeLabel = () => ({ today: 'today', week: 'in the last 7 days', month: 'in the last 30 days', all: 'all time' }[range]);
  function renderRange() {
    rangeEl.innerHTML = RANGES.map(([k, l]) => `<button data-range="${k}" aria-pressed="${k === range}">${l}</button>`).join('');
  }
  rangeEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    range = b.dataset.range; store.set('range', range);
    renderRange();
    if (data) render();
  });
  renderRange();

  // ---------------- loading + sign-in gate ----------------
  let data = null;
  function signInScreen(msg) {
    app.innerHTML = `<p class="msg">${msg}</p><p class="msg"><button class="btn" id="signin">Sign in with Google</button></p>`;
    document.getElementById('signin').onclick = () => Cloud.signIn().catch((e) => alert(e.message));
  }
  async function load() {
    refreshBtn.disabled = true;
    try {
      data = await Cloud.adminData();
      render();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<p class="msg">${e.code === 'permission-denied'
        ? 'The database refused the request. Publish firestore.rules in the Firebase console first.'
        : esc(e.message)}</p>`;
    } finally {
      refreshBtn.disabled = false;
    }
  }
  refreshBtn.addEventListener('click', () => { if (Cloud.isAdmin) load(); });

  Cloud.onChange((u) => {
    who.innerHTML = u ? `<span class="chip">${avatar(u.photoURL)} ${esc((u.displayName || u.email).split(' ')[0])} <button class="btn" id="out">Sign out</button></span>` : '';
    if (u) document.getElementById('out').onclick = () => Cloud.signOut();
    if (!Cloud.available) { app.innerHTML = '<p class="msg">Firebase could not be loaded.</p>'; return; }
    if (!u) return signInScreen('Sign in with the owner account to see the stats.');
    if (!Cloud.isAdmin) return signInScreen(`Only ${esc(ADMIN_EMAIL)} can see the stats.`);
    app.innerHTML = '<p class="msg">Loading…</p>';
    load();
  });

  // ---------------- collapsible panes ----------------
  const closed = new Set(store.get('closed', []));
  const pane = (id, title, sub, body) => `
    <details class="pane" data-pane="${id}" ${closed.has(id) ? '' : 'open'}>
      <summary><h2>${title}</h2><span class="sub">${sub}</span></summary>
      <div class="pane-body">${body}</div>
    </details>`;
  app.addEventListener('toggle', (e) => {
    const d = e.target.closest && e.target.closest('details.pane');
    if (!d) return;
    if (d.open) closed.delete(d.dataset.pane); else closed.add(d.dataset.pane);
    store.set('closed', [...closed]);
  }, true);

  // ---------------- sortable tables ----------------
  const tables = {};
  function table(id, cols, rows, o = {}) {
    const st = tables[id] && tables[id].sort ? tables[id].sort : store.get('sort.' + id, o.sort || { key: cols[0].key, dir: -1 });
    tables[id] = { cols, rows, o, sort: st };
    return `<div class="table-wrap" data-table="${id}">${tableHtml(id)}</div>`;
  }
  function tableHtml(id) {
    const { cols, rows, o, sort } = tables[id];
    const col = cols.find((c) => c.key === sort.key) || cols[0];
    const val = col.sortVal || ((r) => r[col.key]);
    const shown = (o.filter ? rows.filter(o.filter) : rows).slice().sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === y) return 0;
      if (x === undefined || x === null || x === '') return 1;
      if (y === undefined || y === null || y === '') return -1;
      return (x > y ? 1 : -1) * sort.dir;
    });
    if (!shown.length) return `<p class="empty">${o.empty || 'Nothing here yet.'}</p>`;
    const head = cols.map((c) => `<th class="${c.num ? 'num' : ''}" aria-sort="${c.key === sort.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">
      <button data-sort="${c.key}">${c.label}<span class="arrow">${c.key === sort.key ? (sort.dir > 0 ? '▲' : '▼') : '↕'}</span></button></th>`).join('');
    const body = shown.map((r) => {
      const open = o.expand && o.isOpen && o.isOpen(r);
      return `<tr class="${o.expand ? 'clickable' : ''}" ${o.rowId ? `data-row="${esc(o.rowId(r))}"` : ''}>
        ${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.fmt ? c.fmt(r) : esc(r[c.key])}</td>`).join('')}</tr>
        ${open ? `<tr class="detail"><td colspan="${cols.length}">${o.expand(r)}</td></tr>` : ''}`;
    }).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function redraw(id) {
    const el = app.querySelector(`[data-table="${id}"]`);
    if (el) el.innerHTML = tableHtml(id);
  }
  app.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-sort]');
    if (sb) {
      const id = sb.closest('[data-table]').dataset.table, t = tables[id];
      t.sort = { key: sb.dataset.sort, dir: t.sort.key === sb.dataset.sort ? -t.sort.dir : -1 };
      store.set('sort.' + id, t.sort);
      return redraw(id);
    }
    const row = e.target.closest('tr[data-row]');
    if (row) {
      const id = row.closest('[data-table]').dataset.table, t = tables[id];
      if (t.o.toggle) { t.o.toggle(row.dataset.row); redraw(id); }
    }
    const pg = e.target.closest('[data-page]');
    if (pg && !pg.disabled) { recentPage += pg.dataset.page === 'next' ? 1 : -1; renderRecent(); }
  });

  // ---------------- bar chart (one series, shared scale) ----------------
  function barChart({ title, days, values, fmt, green }) {
    const W = 560, H = 210, L = 46, B = 30, T = 10;
    const max = Math.max(1, ...values);
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= max) return k * p; return max; })();
    const bw = (W - L) / days.length;
    const y = (v) => T + (H - T - B) * (1 - v / nice);
    const ticks = [0, nice / 2, nice];
    const grid = ticks.map((v) => `<line class="gridline" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"></line>
      <text class="axis" x="${L - 8}" y="${y(v) + 5}" text-anchor="end">${fmt(v, true)}</text>`).join('');
    const bars = values.map((v, i) => {
      const x = L + i * bw, h = (H - T - B) * (v / nice), d = new Date(days[i]);
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      return `<g data-tip="${esc(`${label}: ${fmt(v)}`)}">
        <rect class="hit" x="${x}" y="${T}" width="${bw}" height="${H - T - B}"></rect>
        ${v > 0 ? `<path class="bar" d="M${x + 2},${y(0)} V${y(v) + Math.min(4, h)} q0,-4 4,-4 H${x + bw - 6} q4,0 4,4 V${y(0)} Z"></path>` : ''}
      </g>`;
    }).join('');
    const xl = days.map((d, i) => (i % 7 === 0 || i === days.length - 1)
      ? `<text class="axis" x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>` : '').join('');
    return `<div class="chart${green ? ' green' : ''}"><h3>${title}</h3>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${grid}${bars}${xl}</svg></div>`;
  }

  // ---------------- render ----------------
  const openPlayers = new Set();
  let recent = [], recentPage = 0;
  const PAGE = 50;

  function render() {
    const { players, runs, sessions, sessionsError } = data;
    const now = Date.now(), from = rangeStart(), today = startOfDay(now), week = today - 6 * DAY;
    const inRange = (ms) => ms >= from;
    const runsR = runs.filter((r) => inRange(r.at));
    const sessR = sessions.filter((s) => inRange(s.lastBeat) && s.seconds > 0);

    // ---- per player ----
    const byUid = {};
    for (const p of players) byUid[p.uid] = { ...p, runs: [], sessions: [] };
    for (const r of runs) (byUid[r.uid] = byUid[r.uid] || { uid: r.uid, name: r.name, runs: [], sessions: [] }).runs.push(r);
    for (const s of sessions) (byUid[s.uid] = byUid[s.uid] || { uid: s.uid, name: s.name, runs: [], sessions: [] }).sessions.push(s);
    const people = Object.values(byUid).map((p) => {
      const secs = (since) => sum(p.sessions.filter((s) => s.lastBeat >= since), (s) => s.seconds);
      const lastActive = Math.max(p.lastSeen || 0, ...p.sessions.map((s) => s.lastBeat), ...p.runs.map((r) => r.at));
      const best = p.runs.filter((r) => r.completed);
      return {
        ...p,
        name: p.fullName || p.name || '—',
        total: secs(0), today: secs(today), week: secs(week), inRange: secs(from),
        sessionCount: p.sessions.filter((s) => s.seconds > 0).length,
        runCount: p.runs.length, deaths: sum(p.runs, (r) => r.deaths), clears: best.length,
        lastActive: lastActive > 0 ? lastActive : null,
        activeInRange: p.runs.some((r) => inRange(r.at)) || p.sessions.some((s) => inRange(s.lastBeat)),
      };
    });

    // ---- overview ----
    const active = people.filter((p) => p.activeInRange);
    const newcomers = people.filter((p) => p.joinedAt && inRange(p.joinedAt));
    const playSecs = sum(sessR, (s) => s.seconds);
    const withTime = people.filter((p) => p.inRange > 0);
    const clears = runsR.filter((r) => r.completed), quits = runsR.filter((r) => !r.completed);
    const kpi = (v, l, d = '') => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;
    const overview = `<div class="kpis">
        ${kpi(num(active.length), 'Active players', `of ${num(people.length)} signed up`)}
        ${kpi(num(newcomers.length), 'New players')}
        ${kpi(dur(playSecs), 'Time played')}
        ${kpi(dur(withTime.length ? playSecs / withTime.length : 0), 'Time per player', 'average')}
        ${kpi(num(sessR.length), 'Play sessions')}
        ${kpi(dur(sessR.length ? playSecs / sessR.length : 0), 'Session length', `median ${dur(median(sessR.map((s) => s.seconds)))}`)}
        ${kpi(num(clears.length), 'Levels cleared')}
        ${kpi(num(quits.length), 'Gave up')}
        ${kpi(pct(clears.length, runsR.length), 'Completion rate', 'cleared ÷ attempts')}
        ${kpi(num(sum(runsR, (r) => r.deaths)), 'Deaths')}
        ${kpi(num(sum(clears, (r) => r.stars)), 'Cans collected', 'in cleared runs')}
        ${kpi(`<span class="stars">★</span> ${num(sum(people, (p) => p.totalStars))}`, 'Stars owned', 'all players, all time')}
      </div>
      ${sessionsError ? `<p class="note">Play time is not available yet: ${sessionsError === 'permission-denied' ? 'publish the updated firestore.rules in the Firebase console.' : esc(sessionsError)}</p>`
        : '<p class="note">Play time counts time spent inside a level with the game tab visible, for signed-in players. It started being recorded with this version of the stats page.</p>'}`;

    // ---- daily charts (always the last 30 days) ----
    const days = Array.from({ length: 30 }, (_, i) => today - (29 - i) * DAY);
    const dayIdx = (ms) => Math.floor((startOfDay(ms) - days[0]) / DAY);
    const activeSets = days.map(() => new Set()), minutes = days.map(() => 0), clearsPerDay = days.map(() => 0);
    for (const s of sessions) { const i = dayIdx(s.lastBeat); if (i >= 0 && i < 30) { activeSets[i].add(s.uid); minutes[i] += (s.seconds || 0) / 60; } }
    for (const r of runs) { const i = dayIdx(r.at); if (i >= 0 && i < 30) { activeSets[i].add(r.uid); if (r.completed) clearsPerDay[i]++; } }
    const daily = `<div class="charts">
        ${barChart({ title: 'Active players per day', days, values: activeSets.map((s) => s.size), fmt: (v, axis) => (axis ? num(Math.round(v)) : `${v} player${v === 1 ? '' : 's'}`) })}
        ${barChart({ title: 'Minutes played per day', days, values: minutes.map((m) => Math.round(m * 10) / 10), fmt: (v, axis) => (axis ? num(Math.round(v)) : dur(v * 60)), green: true })}
        ${barChart({ title: 'Levels cleared per day', days, values: clearsPerDay, fmt: (v, axis) => (axis ? num(Math.round(v)) : `${v} cleared`) })}
      </div><p class="note">Hover a bar for the exact numbers. These charts always show the last 30 days.</p>`;

    // ---- players ----
    const playerCols = [
      { key: 'name', label: 'Player', fmt: (p) => `${avatar(p.photo)} ${esc(p.name)}`, sortVal: (p) => (p.name || '').toLowerCase() },
      { key: 'email', label: 'Email', fmt: (p) => `<span class="muted">${esc(p.email || '—')}</span>` },
      { key: 'total', label: 'Total time', num: true, fmt: (p) => dur(p.total) },
      { key: 'today', label: 'Today', num: true, fmt: (p) => dur(p.today) },
      { key: 'week', label: 'This week', num: true, fmt: (p) => dur(p.week) },
      { key: 'sessionCount', label: 'Sessions', num: true, fmt: (p) => num(p.sessionCount) },
      { key: 'levelsCleared', label: 'Levels', num: true, fmt: (p) => num(p.levelsCleared || 0) },
      { key: 'totalStars', label: 'Stars', num: true, fmt: (p) => `<span class="stars">★</span> ${num(p.totalStars || 0)}` },
      { key: 'deaths', label: 'Deaths', num: true, fmt: (p) => num(p.deaths) },
      { key: 'lastActive', label: 'Last active', num: true, fmt: (p) => ago(p.lastActive) },
      { key: 'joinedAt', label: 'Joined', num: true, fmt: (p) => (p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : '—') },
    ];
    let query = '';
    const playersTable = table('players', playerCols, people, {
      sort: { key: 'lastActive', dir: -1 },
      empty: 'Nobody has signed in yet.',
      rowId: (p) => p.uid,
      isOpen: (p) => openPlayers.has(p.uid),
      toggle: (uid) => (openPlayers.has(uid) ? openPlayers.delete(uid) : openPlayers.add(uid)),
      filter: (p) => !query || `${p.name} ${p.email || ''}`.toLowerCase().includes(query),
      expand: playerDetail,
    });

    // ---- levels ----
    const perLevel = LEVELS.map((l, i) => {
      const lr = runsR.filter((r) => r.level === l.name);
      const c = lr.filter((r) => r.completed);
      return {
        i, name: l.name, tried: new Set(lr.map((r) => r.uid)).size, cleared: new Set(c.map((r) => r.uid)).size,
        attempts: lr.length, completions: c.length, quits: lr.length - c.length,
        rate: lr.length ? c.length / lr.length : null,
        perClear: c.length ? lr.length / c.length : null,
        deathsPerClear: c.length ? sum(lr, (r) => r.deaths) / c.length : null,
        spent: c.length ? median(c.map((r) => r.played || r.time)) : null,
        record: c.length ? Math.min(...c.map((r) => r.time)) : null,
        perfect: c.filter((r) => r.stars === 3).length,
      };
    });
    const maxCleared = Math.max(1, ...perLevel.map((l) => l.cleared));
    const funnel = `<div class="funnel">${perLevel.map((l) => `<div class="row" data-tip="${esc(`${l.i + 1}. ${l.name}: ${l.cleared} cleared · ${l.tried} tried · ${l.quits} give-ups`)}">
        <div class="name">${l.i + 1}. ${esc(l.name)}</div>
        <div class="track"><div class="bar" style="width:${(l.cleared / maxCleared) * 100}%"></div><span class="val" style="left:${(l.cleared / maxCleared) * 100}%">${l.cleared}</span></div>
      </div>`).join('')}</div>`;
    const levelCols = [
      { key: 'i', label: 'Level', fmt: (l) => `${l.i + 1}. ${esc(l.name)}`, sortVal: (l) => l.i },
      { key: 'tried', label: 'Players tried', num: true, fmt: (l) => num(l.tried) },
      { key: 'cleared', label: 'Cleared', num: true, fmt: (l) => num(l.cleared) },
      { key: 'rate', label: 'Completion', num: true, fmt: (l) => (l.rate === null ? '—' : `${Math.round(l.rate * 100)}%`) },
      { key: 'perClear', label: 'Attempts / clear', num: true, fmt: (l) => num(l.perClear) },
      { key: 'deathsPerClear', label: 'Deaths / clear', num: true, fmt: (l) => num(l.deathsPerClear) },
      { key: 'spent', label: 'Time to clear', num: true, fmt: (l) => dur(l.spent) },
      { key: 'record', label: 'Record', num: true, fmt: (l) => fmtTime(l.record) },
      { key: 'perfect', label: '★★★ runs', num: true, fmt: (l) => num(l.perfect) },
    ];
    const levels = `<p class="note">Players who cleared each level ${rangeLabel()}. Hover a bar for details.</p>${funnel}
      <p class="note">Hardest levels: low completion, many attempts or deaths per clear. "Time to clear" is the median time spent in the level including retries. Click a column to sort.</p>
      ${table('levels', levelCols, perLevel, { sort: { key: 'i', dir: 1 } })}`;

    recent = runsR.slice(0, 200);
    recentPage = Math.min(recentPage, Math.max(0, Math.ceil(recent.length / PAGE) - 1));

    app.innerHTML = [
      pane('overview', 'Overview', rangeLabel(), overview),
      pane('daily', 'Daily activity', 'last 30 days', daily),
      pane('players', 'Players', `${num(people.length)} signed up · click a player for details`,
        `<div class="toolbar"><input id="search" type="search" placeholder="Search by name or email" aria-label="Search players"></div>${playersTable}`),
      pane('levels', 'Levels', rangeLabel(), levels),
      pane('activity', 'Recent activity', `latest ${Math.min(200, runsR.length)} attempts ${rangeLabel()}`, '<div id="recent"></div>'),
    ].join('');

    const search = document.getElementById('search');
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); redraw('players'); });
    renderRecent();
  }

  function playerDetail(p) {
    const prog = p.progress || {};
    const levelRows = LEVELS.map((l, i) => {
      const key = Cloud.levelKey(l.name), b = prog[key];
      return b ? `<tr><td>${i + 1}. ${esc(l.name)}</td><td class="num">${fmtTime(b.t)}</td><td class="num stars">${'★'.repeat(b.s || 0)}</td></tr>` : '';
    }).join('');
    const last = p.runs.slice(0, 10).map((r) => `<tr><td>${ago(r.at)}</td><td>${r.levelIdx + 1}. ${esc(r.level)}</td>
      <td>${r.completed ? '✅' : '🏳️'}</td><td class="num">${dur(r.played || r.time)}</td><td class="num">${r.deaths}</td></tr>`).join('');
    const sess = p.sessions.filter((s) => s.seconds > 0).slice(0, 6).map((s) => `<tr><td>${new Date(s.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      <td class="num">${dur(s.seconds)}</td><td class="num">${num(s.levels || 0)}</td></tr>`).join('');
    return `<div class="detail-grid">
      <div><h4>Best times</h4>${levelRows ? `<table class="mini"><tbody>${levelRows}</tbody></table>` : '<p class="note">No levels cleared yet.</p>'}</div>
      <div><h4>Last 10 attempts</h4>${last ? `<table class="mini"><thead><tr><th>When</th><th>Level</th><th></th><th class="num">Time spent</th><th class="num">Deaths</th></tr></thead><tbody>${last}</tbody></table>` : '<p class="note">No attempts yet.</p>'}</div>
      <div><h4>Recent sessions</h4>${sess ? `<table class="mini"><thead><tr><th>Started</th><th class="num">Played</th><th class="num">Levels</th></tr></thead><tbody>${sess}</tbody></table>` : '<p class="note">No play sessions recorded yet.</p>'}</div>
    </div>`;
  }

  function renderRecent() {
    const box = document.getElementById('recent');
    if (!box) return;
    if (!recent.length) { box.innerHTML = '<p class="empty">No games played in this period.</p>'; return; }
    const pages = Math.ceil(recent.length / PAGE), start = recentPage * PAGE;
    const rows = recent.slice(start, start + PAGE);
    box.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>When</th><th>Player</th><th>Level</th><th>Result</th><th class="num">Time</th><th class="num">Time spent</th><th class="num">Stars</th><th class="num">Deaths</th><th class="num">Throws</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td title="${esc(new Date(r.at).toLocaleString())}">${ago(r.at)}</td><td>${esc(r.name)}</td><td>${r.levelIdx + 1}. ${esc(r.level)}</td>
          <td>${r.completed ? '✅ cleared' : '🏳️ gave up'}</td>
          <td class="num">${fmtTime(r.time)}</td><td class="num">${dur(r.played)}</td><td class="num stars">${'★'.repeat(r.stars || 0)}</td>
          <td class="num">${r.deaths}</td><td class="num">${r.throws}</td></tr>`).join('')}</tbody>
      </table></div>
      ${pages > 1 ? `<div class="pager">
        <button class="btn" data-page="prev" ${recentPage === 0 ? 'disabled' : ''}>◀ Newer</button>
        <span>${start + 1}–${start + rows.length} of ${recent.length} · page ${recentPage + 1} / ${pages}</span>
        <button class="btn" data-page="next" ${recentPage >= pages - 1 ? 'disabled' : ''}>Older ▶</button></div>` : ''}`;
  }

  // hover tooltips (funnel rows and chart bars)
  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { tip.style.opacity = 0; return; }
    tip.textContent = el.dataset.tip;
    tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${e.clientY + 14}px`;
    tip.style.opacity = 1;
  });
})();
