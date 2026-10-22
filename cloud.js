'use strict';

/* ============================================================
   Cloud: Google sign-in, leaderboards and progress sync (Firebase).

   Firestore layout (Paint Runner's own Firebase project, collections prefixed pr_):
     pr_players/{uid}                      public profile + progress (for the star ranking)
     pr_private/{uid}                      email; only the admin can read it
     pr_levels/{levelKey}/pr_scores/{uid}  one row per player per level: their bests
     pr_levels/{levelKey}/pr_ghosts/{uid}  each player's fastest recorded run of the level (ghost.js)
     pr_daily/{day}/pr_scores/{uid}        the Daily Chase: each player's best time that day
     pr_names/{lowercase nickname}         who owns each nickname (so no two players share one)
     pr_runs/{autoId}                      every finished or abandoned attempt (admin stats)
     pr_sessions/{id}                      one per visit: how long the player actually played (admin stats)

   Guests (not signed in) get an anonymous Firebase account, so their runs and visits still
   reach the stats dashboard. A guest who picks a nickname (pr_names/{lowercase name} -> uid, one
   owner each) is on the leaderboards under it, just like a Google account (`player`). Signing in
   with Google links the guest account to Google, so it keeps its history and nickname; if the
   Google account already exists, it simply signs in to that one.

   The game never depends on this: if Firebase can't be reached, or the rules
   haven't been published yet, everything keeps working locally.
   ============================================================ */

const Cloud = (() => {
  let auth = null, db = null, user = null, available = false;
  let account = null;   // whoever Firebase has signed in, guests included (user = Google accounts only)
  let nick = null;      // this account's nickname on the leaderboards, if it picked one
  let tracking = false; // the game turns this on (trackVisits); the stats page doesn't, so it never makes guests
  const listeners = new Set();

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    available = true;
  } catch (e) {
    console.warn('Paint Runner: online features unavailable', e);
  }

  const rankCache = {};

  // ---- where players come from (the stats page groups players by it) ----
  // A link tagged ?src=reddit-ad (or ?utm_source=...) names its source. Otherwise: the site the game is
  // embedded in (itch.io, a games portal), else the site that linked here, else 'Direct'. Each browser
  // keeps the first source it came from (firstSource), so a return visit from a bookmark still credits it.
  const SITES = [
    [/(^|\.)itch\.(io|zone)$/, 'itch.io'], [/(^|\.)reddit\.com$|(^|\.)redd\.it$/, 'Reddit'], [/(^|\.)google\./, 'Google'],
    [/(^|\.)(bing|duckduckgo|yahoo|yandex|ecosia)\./, 'Other search'], [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
    [/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X / Twitter'], [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'], [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)discord(app)?\.(com|gg)$/, 'Discord'],
    [/(^|\.)whatsapp\.(com|net)$/, 'WhatsApp'], [/(^|\.)crazygames\./, 'CrazyGames'], [/(^|\.)poki\./, 'Poki'],
    [/(^|\.)(newgrounds\.com|ungrounded\.net)$/, 'Newgrounds'], [/(^|\.)github\.com$/, 'GitHub'],
  ];
  const siteName = (host) => { const h = host.replace(/^www\./, ''); const m = SITES.find(([re]) => re.test(h)); return m ? m[1] : h; };
  const hostOf = (url) => { try { return new URL(url).hostname; } catch (e) { return ''; } };
  function visitSource() {
    try {
      const q = new URLSearchParams(location.search), tag = q.get('src') || q.get('utm_source');
      if (tag) return tag.slice(0, 40);
      const ref = hostOf(document.referrer), embedded = window.top !== window.self;
      if (embedded) return siteName(ref || location.hostname);
      if (ref && ref !== location.hostname) return siteName(ref);
      if (/itch\.zone$/.test(location.hostname)) return 'itch.io';
    } catch (e) { /* fall through */ }
    return 'Direct';
  }
  let source = null, firstSource = null;
  function noteSource() {
    source = visitSource();
    try {
      firstSource = localStorage.getItem('paintRunner.firstSource');
      if (!firstSource) { firstSource = source; localStorage.setItem('paintRunner.firstSource', source); }
    } catch (e) { firstSource = source; }
  }
  const levelKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const scores = (name) => db.collection('pr_levels').doc(levelKey(name)).collection('pr_scores');
  const ghosts = (name) => db.collection('pr_levels').doc(levelKey(name)).collection('pr_ghosts');

  // Leaderboards are public, so only show "First L." rather than a full name.
  function publicName(u) {
    const parts = (u.displayName || 'Painter').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  }

  // Saves still on their way to the server. Leaderboard reads wait for these, so you
  // always see your own latest result.
  let pending = Promise.resolve();
  const track = (p) => { pending = Promise.all([pending, p.catch(() => { })]); return p; };

  const session = { id: null, uid: null, startedAt: 0, base: 0, saved: false };
  // what guests did with the sign-in prompts this visit (stats page): shown, clicked, signed in
  const funnel = { claimShown: 0, claimClick: 0, signinClick: 0, signedIn: 0, via: '' };
  let lastSeconds = 0;   // play time so far this visit, as last reported by the game
  let lastReport = null; // and the rest of that report (levels played, the last one)
  const guestName = (u) => `Guest ${u.uid.slice(0, 4)}`;
  // Who you are on the leaderboards: a Google account, or a guest with a nickname (else null).
  const me = () => (account && (user || nick)
    ? { uid: account.uid, name: nick || publicName(user), photo: user ? user.photoURL || '' : '', guest: !user } : null);
  const nameOf = () => (me() ? me().name : guestName(account));

  const emit = () => listeners.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });

  // `ready` resolves once we know whether someone is signed in (Firebase restores the session async)
  let markReady; const ready = new Promise((r) => { markReady = r; });
  let isReady = !available;
  if (!available) markReady();
  // don't wait forever (slow network, blocked storage): after a few seconds, treat it as signed out
  setTimeout(() => { if (!isReady) { isReady = true; markReady(); emit(); } }, 4000);
  if (available) {
    auth.getRedirectResult().catch((e) => {
      // a guest signed in with a Google account that already exists: switch to that account
      if (e.code === 'auth/credential-already-in-use' && e.credential) auth.signInWithCredential(e.credential).catch(() => { });
    });
    auth.onAuthStateChanged((u) => {
      setAccount(u);
      if (!isReady) { isReady = true; markReady(); }
      // nobody signed in: continue as a guest (needs "Anonymous" turned on in the Firebase console)
      if (!u && tracking) signInGuest();
    });
  }

  const signInGuest = () => auth.signInAnonymously().catch((e) => console.warn('guest', e.code || e));

  function setAccount(u) {
    account = u;
    const was = user;
    user = u && !u.isAnonymous ? u : null;
    if (user) {
      db.collection('pr_private').doc(user.uid).set({
        email: user.email || '', fullName: user.displayName || '', lastSeen: Date.now(),
      }, { merge: true }).catch((e) => console.warn('pr_private', e.code || e));
    }
    if (tracking && account && session.uid !== account.uid) startSession();   // a visit: logged even before any play
    const nickWas = nick;
    if (account && account.uid !== nickFor) loadNick();
    if (!account) nick = null;
    if (user !== was || (user && was && user.uid !== was.uid) || nick !== nickWas) emit();
  }

  // ---- nicknames ----
  // Letters, digits and _, 3 to 16 long; no rude words (kids play too). Unique, ignoring case.
  const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;
  const RUDE = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'sex', 'porn', 'nigg', 'fag', 'retard', 'rape', 'nazi', 'hitler', 'whore', 'slut', 'asshole', 'bastard', 'kill', 'kys', 'zona', 'sharmut', 'kus', 'admin', 'moderator', 'paintrunner', 'filossof'];
  const unleet = (n) => n.toLowerCase().replace(/0/g, 'o').replace(/[1!]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/_/g, '');
  function nickProblem(n) {
    if (!NICK_RE.test(n)) return n.length < 3 ? 'At least 3 characters' : n.length > 16 ? 'At most 16 characters' : 'Only English letters, digits and _';
    const u = unleet(n);
    if (RUDE.some((w) => u.includes(w)) || /^guest/.test(u)) return 'Please pick another name';
    return null;
  }
  const names = () => db.collection('pr_names');
  let nickFor = null;   // the account whose nickname we have (or are fetching)
  function loadNick() {
    const uid = account.uid;
    nickFor = uid;
    try { nick = localStorage.getItem('paintRunner.nick.' + uid) || null; } catch (e) { nick = null; }
    names().where('uid', '==', uid).limit(1).get().then((snap) => {
      if (nickFor !== uid) return;
      const n = snap.empty ? null : snap.docs[0].data().name;
      keepNick(uid, n);
    }).catch((e) => console.warn('nick', e.code || e));
  }
  function keepNick(uid, n) {
    try { if (n) localStorage.setItem('paintRunner.nick.' + uid, n); else localStorage.removeItem('paintRunner.nick.' + uid); } catch (e) { /* ignore */ }
    if (n !== nick) { nick = n; emit(); }
  }

  // One session per visit and account. Switching accounts part-way starts a new one from that moment.
  function startSession() {
    session.base = session.uid ? lastSeconds : 0;
    session.uid = account.uid;
    session.id = `${account.uid.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    session.startedAt = Date.now();
    session.saved = false;
    writeSession({ seconds: lastSeconds, levels: 0, lastLevel: '' });
  }
  function writeSession(d) {
    session.saved = true; session.wrote = Math.round(d.seconds);
    return db.collection('pr_sessions').doc(session.id).set({
      uid: account.uid, name: nameOf(), guest: !user,
      startedAt: session.startedAt, lastBeat: Date.now(),
      seconds: Math.max(0, Math.round(d.seconds - session.base)), levels: d.levels, lastLevel: d.lastLevel || '', device: DEVICE,
      host: location.hostname.includes('itch') ? 'itch' : location.hostname, funnel: { ...funnel },
      source: source || '', firstSource: firstSource || '',
    }).catch((e) => console.warn('session', e.code || e));
  }

  // Paint Drops wallet: earned/spent only grow, so the bigger one wins; owned items combine;
  // equipped comes from whichever device changed it last.
  function mergeWallet(a = {}, b = {}) {
    const clears = { ...(b.clears || {}) };
    for (const [k, v] of Object.entries(a.clears || {})) clears[k] = Math.max(clears[k] || 0, v);
    const newer = (a.equippedAt || 0) >= (b.equippedAt || 0) ? a : b;
    return {
      earned: Math.max(a.earned || 0, b.earned || 0),
      spent: Math.max(a.spent || 0, b.spent || 0),
      owned: [...new Set([...(a.owned || []), ...(b.owned || [])])],
      equipped: { ...(newer.equipped || {}) },
      equippedAt: newer.equippedAt || 0,
      clears,
      daily: (a.daily || '') > (b.daily || '') ? a.daily : (b.daily || ''),
      // the play streak: whichever device played most recently has it right
      streak: newerStreak(a.streak, b.streak),
      // when this account got its sign-in gift (once ever)
      signinGift: Math.max(a.signinGift || 0, b.signinGift || 0),
    };
  }

  function newerStreak(a, b) {
    if (!a || !a.last) return b ? { ...b } : undefined;
    if (!b || !b.last) return { ...a };
    const pick = a.last > b.last || (a.last === b.last && (a.count || 0) >= (b.count || 0)) ? a : b;
    return { ...pick, best: Math.max(a.best || 0, b.best || 0), saverAt: (a.saverAt || '') > (b.saverAt || '') ? a.saverAt : (b.saverAt || '') };
  }

  const min = (a, b) => (a === undefined || a === null ? b : b === undefined || b === null ? a : Math.min(a, b));
  const dropUndefined = (o) => { Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]); return o; };
  const round3 = (t) => Math.round(t * 1000) / 1000;   // times are kept to the millisecond

  /* Merges one result into a score row. Returns the new row. */
  function mergeScore(old, r, countPlay) {
    const d = old || {};
    const now = Date.now();
    const bestTime = round3(min(d.bestTime, r.time));
    const best3Time = r.stars === 3 && r.time ? round3(min(d.best3Time, r.time)) : d.best3Time;
    const fewestThrows = min(d.fewestThrows, r.throws);
    // When each record was set, so ties go to whoever got there first.
    // (Records from before this existed count as earliest: 0.)
    const since = (value, oldValue, oldAt) =>
      value === undefined ? undefined : oldValue === undefined || value < oldValue ? now : (oldAt || 0);
    return dropUndefined({
      uid: me().uid,
      name: me().name,
      photo: me().photo,
      level: r.level,
      levelIdx: r.levelIdx,
      bestTime,
      bestTimeAt: since(bestTime, d.bestTime, d.bestTimeAt),
      bestStars: Math.max(d.bestStars || 0, r.stars || 0),
      best3Time,
      best3TimeAt: since(best3Time, d.best3Time, d.best3TimeAt),
      fewestThrows,
      fewestThrowsAt: since(fewestThrows, d.fewestThrows, d.fewestThrowsAt),
      plays: (d.plays || 0) + (countPlay ? 1 : 0),
      updatedAt: Date.now(),
    });
  }

  /* Top rows for one board, lowest value first. Equal values share a place ("1, 1, 3")
     and, within a tie, whoever set it first is listed first. */
  async function topOf(name, field, limit) {
    const snap = await scores(name).orderBy(field).limit(limit + 40).get();
    const rows = snap.docs.map((d) => d.data())
      .sort((a, b) => a[field] - b[field] || (a[field + 'At'] || 0) - (b[field + 'At'] || 0));
    return withRanks(rows, (r) => r[field], (a, b) => a < b).slice(0, limit);
  }

  // Competition ranking: rank = 1 + how many rows are strictly better.
  function withRanks(rows, value, better) {
    return rows.map((r) => ({ ...r, rank: 1 + rows.filter((o) => better(value(o), value(r))).length }));
  }

  async function rankIn(name, field) {
    const mine = await scores(name).doc(me().uid).get();
    const v = mine.exists ? mine.data()[field] : undefined;
    if (v === undefined) return null;
    const snap = await scores(name).orderBy(field).limit(100).get();
    const better = snap.docs.filter((d) => d.data()[field] < v).length;
    return better >= 100 ? null : better + 1;
  }

  // A new nickname: your rows on every board (and your profile) show it from now on.
  async function renameRows(n) {
    const uid = account.uid, refs = [db.collection('pr_players').doc(uid)];
    if (typeof LEVELS !== 'undefined') for (const l of LEVELS) refs.push(scores(l.name).doc(uid), ghosts(l.name).doc(uid));
    if (typeof Daily !== 'undefined') refs.push(db.collection('pr_daily').doc(Daily.key()).collection('pr_scores').doc(uid));
    await Promise.all(refs.map(async (ref) => {
      const d = await ref.get();
      if (d.exists && d.data().name !== n) await ref.update({ name: n });
    }));
  }

  // ---- leaderboards, 10 rows at a time ----
  // Rows are read a page at a time, only when asked for, up to the top 100. Ranks stay right because
  // every better row came on an earlier page. Equal values share a place ("1, 1, 3"); within a tie,
  // whoever set it first is listed first.
  const PAGE = 10, TOP = 100;
  function pager(query, value, better, atField) {
    const rows = [];
    let last = null, done = false, loading = null;
    async function more() {
      let q = query.limit(PAGE);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      for (const d of snap.docs) rows.push({ uid: d.id, ...d.data() });
      if (snap.docs.length) last = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < PAGE || rows.length >= TOP) done = true;
      rows.sort((a, b) => (better(value(a), value(b)) ? -1 : better(value(b), value(a)) ? 1 : (a[atField] || 0) - (b[atField] || 0)));
      for (const r of rows) r.rank = 1 + rows.filter((o) => better(value(o), value(r))).length;
    }
    async function ensure(n) {
      await pending;
      while (!done && rows.length < n) {
        loading = loading || more().finally(() => { loading = null; });
        await loading;
      }
    }
    return {
      /* page p (0 = the top 10): { rows, from, hasPrev, hasNext } */
      async page(p) {
        await ensure((p + 1) * PAGE + 1);   // one more row tells whether there's a next page
        const from = p * PAGE;
        return { rows: rows.slice(from, Math.min(from + PAGE, TOP)), from, hasPrev: p > 0, hasNext: rows.length > from + PAGE && from + PAGE < TOP };
      },
      /* where this player is in the top 100 (0-based), or -1 */
      async find(uid) { await ensure(TOP); return rows.slice(0, TOP).findIndex((r) => r.uid === uid); },
    };
  }

  // A guest signing in keeps the same account (and its history), now with Google attached.
  // If that Google account already exists, sign in to it instead.
  async function linkGuest(guest, provider) {
    let res;
    try {
      res = await guest.linkWithPopup(provider);
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use' && e.credential) return auth.signInWithCredential(e.credential);
      throw e;
    }
    const u = res.user, g = u.providerData.find((p) => p.providerId === 'google.com');
    if (g && (!u.displayName || !u.photoURL)) await u.updateProfile({ displayName: u.displayName || g.displayName, photoURL: u.photoURL || g.photoURL }).catch(() => { });
    await u.getIdToken(true).catch(() => { });   // a fresh token that says "Google" for the database rules
    setAccount(u);   // linking doesn't fire onAuthStateChanged
    return res;
  }

  return {
    get available() { return available; },
    get source() { return { source, firstSource }; },
    get user() { return user; },
    /* You on the leaderboards: { uid, name, photo, guest } for a Google account or a guest with a nickname, else null. */
    get player() { return me(); },
    get nick() { return nick; },
    nickProblem,
    /* Is this nickname free (or already yours)? */
    async nickFree(n) {
      const d = await names().doc(n.toLowerCase()).get();
      return !d.exists || (account && d.data().uid === account.uid);
    },
    /* Takes a nickname (and lets go of your old one). Your rows on the boards are renamed. */
    async setNick(n) {
      const problem = nickProblem(n);
      if (problem) throw Object.assign(new Error(problem), { code: 'bad-name' });
      if (!account) throw Object.assign(new Error('offline'), { code: 'offline' });
      const key = n.toLowerCase(), uid = account.uid, old = nick;
      const ref = names().doc(key), d = await ref.get();
      if (d.exists && d.data().uid !== uid) throw Object.assign(new Error('taken'), { code: 'taken' });
      if (!d.exists) await ref.set({ uid, name: n, at: Date.now() });
      else if (d.data().name !== n) { await ref.delete(); await ref.set({ uid, name: n, at: Date.now() }); }   // a new capitalization
      if (old && old.toLowerCase() !== key) await names().doc(old.toLowerCase()).delete().catch(() => { });
      keepNick(uid, n);
      if (old) await track(renameRows(n));
      return n;
    },
    get isAdmin() { return !!(user && user.email === ADMIN_EMAIL && user.emailVerified); },
    publicName,
    levelKey,
    onChange(fn) { listeners.add(fn); fn(user); return () => listeners.delete(fn); },
    ready,
    get isReady() { return isReady; },
    // true when the game runs inside another page, e.g. on itch.io
    embedded: (() => { try { return window.top !== window.self; } catch (e) { return true; } })(),
    HOME_URL: 'https://filossof.github.io/paintrunner/',

    /* The sign-in prompts, for the stats: 'claimShown', 'claimClick', 'signinClick', or 'signedIn' (with where from). */
    note(what, via) {
      funnel[what] = (funnel[what] || 0) + 1;
      if (via) funnel.via = via;
      if (account && tracking && session.id) writeSession(lastReport || { seconds: lastSeconds, levels: 0, lastLevel: '' });
    },

    /* Where a guest's time would land on a level's fastest board (or today's Daily): { rank } within
       the top 20, else { gap } to 10th place. Looked up once every few minutes per board. */
    async wouldRank(name, time, day) {
      const key = day ? 'daily:' + day : name, c = rankCache[key];
      let times = c && Date.now() - c.at < 3 * 60000 ? c.times : null;
      if (!times) {
        const q = day ? db.collection('pr_daily').doc(day).collection('pr_scores').orderBy('time').limit(20)
          : scores(name).orderBy('bestTime').limit(20);
        times = (await q.get()).docs.map((d) => (day ? d.data().time : d.data().bestTime));
        rankCache[key] = { times, at: Date.now() };
      }
      const better = times.filter((t) => t < time).length;
      if (better < times.length || times.length < 20) return { rank: better + 1, total: times.length };
      return { rank: null, gap: time - times[Math.min(9, times.length - 1)] };
    },

    async signIn(via = 'menu') {
      if (!available) throw new Error('offline');
      this.note('signinClick', via);
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const guest = account && account.isAnonymous ? account : null;
      try {
        if (guest) await linkGuest(guest, provider);
        else await auth.signInWithPopup(provider);
        this.note('signedIn', via);
      } catch (e) {
        const cantPopup = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/unauthorized-domain', 'auth/web-storage-unsupported'].includes(e.code);
        // inside another site's frame (itch.io) a redirect would leave the game, and Google won't load in a frame
        if (cantPopup && Cloud.embedded) { const err = new Error('embedded'); err.code = 'embedded'; throw err; }
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return guest ? guest.linkWithRedirect(provider) : auth.signInWithRedirect(provider);
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
        throw e;
      }
    },
    signOut() { return auth && auth.signOut(); },
    // The game: log every visit and give signed-out players a guest account, for the stats.
    trackVisits() {
      if (!available || tracking) return;
      tracking = true;
      noteSource();
      if (account) { if (session.uid !== account.uid) startSession(); } else if (isReady) signInGuest();
    },
    // resolves once every save started so far has reached the server
    flush() { return pending; },

    /* A level was finished (completed=true) or abandoned. Logged for the stats dashboard. */
    async logRun(run) {
      if (!account) return;
      await db.collection('pr_runs').add(dropUndefined({
        uid: account.uid, name: nameOf(), guest: !user,
        level: run.level, levelIdx: run.levelIdx, completed: !!run.completed,
        time: round3(run.time), stars: run.stars || 0, throws: run.throws || 0, deaths: run.deaths || 0,
        played: round3(run.played || run.time || 0),
        device: DEVICE,
        at: Date.now(),
      }));
    },

    /* Play time for this visit. `seconds` counts only time spent in a level with the tab
       visible. A session belongs to the current account (guests too); see startSession. */
    saveSession(d) {
      lastSeconds = d.seconds; lastReport = d;
      if (!account || !tracking) return Promise.resolve();
      if (session.uid !== account.uid) startSession();
      if (Math.round(d.seconds) === session.wrote) return Promise.resolve();   // nothing new (e.g. idle on the menu)
      return writeSession(d);
    },

    /* Posts a completed run to the level's leaderboards and returns this player's ranks. */
    submitScore(r) {
      if (!me()) return Promise.resolve(null);
      return track(this._submitScore(r));
    },

    async _submitScore(r) {
      const ref = scores(r.level).doc(me().uid);
      const before = await ref.get();
      const old = before.exists ? before.data() : null;
      const row = mergeScore(old, r, true);
      await ref.set(row);
      const improved = {
        fastest: !old || row.bestTime < old.bestTime,
        perfect: r.stars === 3 && (!old || old.best3Time === undefined || row.best3Time < old.best3Time),
        efficient: !old || row.fewestThrows < old.fewestThrows,
      };
      const [fastest, perfect, efficient] = await Promise.all([
        rankIn(r.level, 'bestTime'), r.stars === 3 || row.best3Time !== undefined ? rankIn(r.level, 'best3Time') : null, rankIn(r.level, 'fewestThrows'),
      ]);
      return { fastest, perfect, efficient, improved };
    },

    /* Merges local and cloud progress (best of both), saves it back, and makes sure every
       local best is on the leaderboards. Returns the merged progress. */
    /* Merges local and cloud progress into the public profile (stars ranking). Returns the merged map. */
    saveProfile(local, levels) {
      if (!me()) return Promise.resolve(null);
      return track(this._saveProfile(local, levels));
    },

    async _saveProfile(local, levels) {
      const ref = db.collection('pr_players').doc(me().uid);
      const snap = await ref.get();
      const cloud = snap.exists ? snap.data() : {};
      const cp = cloud.progress || {};
      const merged = {};
      for (const l of levels) {
        const key = levelKey(l.name);
        const a = local.progress[l.name] || {}, b = cp[key] || {};
        const m = dropUndefined({
          t: min(a.t, b.t), s: Math.max(a.s || 0, b.s || 0), t3: min(a.t3, b.t3), th: min(a.th, b.th),
        });
        if (m.t !== undefined) merged[key] = m;
      }
      const totalStars = Object.values(merged).reduce((n, p) => n + (p.s || 0), 0);
      const wallet = mergeWallet(local.wallet, cloud.wallet);
      // achievements: everything unlocked on any device, counters at their highest
      const ach = typeof Achievements !== 'undefined' ? Achievements.mergeInto(local.ach, cloud.ach) : (cloud.ach || { unlocked: {}, counts: {} });
      await ref.set({
        name: me().name, photo: me().photo, nick: nick || '', google: !!user,
        joinedAt: cloud.joinedAt || Date.parse(account.metadata.creationTime) || Date.now(),
        lastSeen: Date.now(),
        unlocked: Math.max(local.unlocked || 0, cloud.unlocked || 0),
        progress: merged, totalStars, levelsCleared: Object.keys(merged).length,
        wallet, drops: wallet.earned - wallet.spent,
        ach, achCount: Object.keys(ach.unlocked || {}).length,
        // when this star total was first reached (ties in the star ranking go to whoever got there first)
        starsAt: totalStars > (cloud.totalStars || 0) ? Date.now() : (cloud.starsAt || 0),
      });
      return { merged, unlocked: Math.max(local.unlocked || 0, cloud.unlocked || 0), wallet, ach };
    },

    async syncProgress(local, levels) {
      if (!me()) return null;
      const { merged, unlocked, wallet, ach } = await this.saveProfile(local, levels);

      // Backfill leaderboards with any local bests the cloud doesn't know about yet.
      await Promise.all(levels.map(async (l, i) => {
        const p = merged[levelKey(l.name)];
        if (!p) return;
        const sref = scores(l.name).doc(me().uid);
        const s = await sref.get();
        const old = s.exists ? s.data() : null;
        const row = mergeScore(old, { level: l.name, levelIdx: i, time: p.t, stars: p.s, throws: p.th }, false);
        if (p.t3 !== undefined) row.best3Time = round3(min(row.best3Time, p.t3));
        if (!old || row.bestTime !== old.bestTime || row.bestStars !== old.bestStars ||
            row.best3Time !== old.best3Time || row.fewestThrows !== old.fewestThrows) {
          await sref.set(row);
        }
      }));

      const progress = {};
      for (const l of levels) {
        const p = merged[levelKey(l.name)];
        if (p) progress[l.name] = p;
      }
      return { progress, unlocked, wallet, ach };
    },

    /* The boards, a page at a time (see pager): one level's fastest / perfect / fewest throws,
       the star collectors, and one day's Daily. */
    levelPager(name, field) { return pager(scores(name).orderBy(field), (r) => r[field], (a, b) => a < b, field + 'At'); },
    starPager() { return pager(db.collection('pr_players').orderBy('totalStars', 'desc'), (r) => r.totalStars || 0, (a, b) => a > b, 'starsAt'); },
    dailyPager(day) { return pager(db.collection('pr_daily').doc(day).collection('pr_scores').orderBy('time'), (r) => r.time, (a, b) => a < b, 'at'); },
    /* Your own row on a level's boards (null if you have none). */
    async myScore(name) {
      if (!me()) return null;
      await pending;
      const s = await scores(name).doc(me().uid).get();
      return s.exists ? s.data() : null;
    },

    /* The three boards for one level. */
    async leaderboard(name, limit = 10) {
      await pending;
      const [fastest, perfect, efficient] = await Promise.all(
        ['bestTime', 'best3Time', 'fewestThrows'].map((f) => topOf(name, f, limit)));
      let me = null;
      if (me()) {
        const s = await scores(name).doc(me().uid).get();
        if (s.exists) me = s.data();
      }
      return { fastest, perfect, efficient, me };
    },

    /* Keeps this run as your ghost for the level if it's faster than the one you have there.
       (The database only accepts it after the run is on the leaderboard, never faster than your best.) */
    saveGhost(name, g) {
      if (!me()) return Promise.resolve(false);
      return track((async () => {
        const ref = ghosts(name).doc(me().uid);
        const old = await ref.get();
        if (old.exists && old.data().time <= g.time) return false;
        await ref.set({
          uid: me().uid, name: me().name, time: round3(g.time), data: g.data,
          char: g.char || 'blob', hat: g.hat || '', skin: g.skin || '', at: Date.now(),
        });
        return true;
      })());
    },
    /* The fastest recorded run of a level, and the level's #1 time (to tell whether that ghost is the record). */
    async fastestGhost(name) {
      const [g, top] = await Promise.all([
        ghosts(name).orderBy('time').limit(1).get(),
        scores(name).orderBy('bestTime').limit(1).get(),
      ]);
      return { ghost: g.empty ? null : g.docs[0].data(), recordTime: top.empty ? null : top.docs[0].data().bestTime };
    },
    /* Your own ghost for a level, from your account (e.g. recorded on another device). */
    async myGhost(name) {
      if (!me()) return null;
      const d = await ghosts(name).doc(me().uid).get();
      return d.exists ? d.data() : null;
    },

    /* The Daily Chase: keeps your best time today (and its recording, the ghost others race),
       returns your place on today's board. */
    async submitDaily(day, r) {
      if (!me()) return { rank: null };
      const ref = db.collection('pr_daily').doc(day).collection('pr_scores').doc(me().uid);
      const old = await ref.get();
      const time = round3(r.time);
      if (!old.exists || time < old.data().time) {
        const row = { uid: me().uid, name: me().name, photo: me().photo, time, stars: r.stars || 0, at: Date.now() };
        if (r.ghost) Object.assign(row, { data: r.ghost.data, char: r.ghost.char || 'blob', hat: r.ghost.hat || '', skin: r.ghost.skin || '' });
        await track(ref.set(row));
      }
      const mine = Math.min(time, old.exists ? old.data().time : Infinity);
      const better = await db.collection('pr_daily').doc(day).collection('pr_scores').where('time', '<', mine).limit(50).get();
      return { rank: better.size >= 50 ? null : better.size + 1 };
    },
    /* The fastest recorded run of today's Daily, to race as a ghost (and whether it's the #1 time). */
    async dailyGhost(day) {
      const snap = await db.collection('pr_daily').doc(day).collection('pr_scores').orderBy('time').limit(5).get();
      const rows = snap.docs.map((d) => d.data());
      const g = rows.find((x) => x.data);
      return g ? { ghost: g, isRecord: g === rows[0] } : null;
    },
    /* Today's fastest runs (ties: whoever got there first). */
    async dailyTop(day, limit = 10) {
      await pending;
      const snap = await db.collection('pr_daily').doc(day).collection('pr_scores').orderBy('time').limit(limit + 10).get();
      const rows = snap.docs.map((d) => d.data()).sort((a, b) => a.time - b.time || a.at - b.at);
      return { rows: withRanks(rows, (x) => x.time, (a, b) => a < b).slice(0, limit), me: me() ? rows.find((x) => x.uid === me().uid) || null : null };
    },

    /* Overall ranking by stars collected. */
    async starBoard(limit = 20) {
      await pending;
      const snap = await db.collection('pr_players').orderBy('totalStars', 'desc').limit(limit + 40).get();
      const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (b.totalStars || 0) - (a.totalStars || 0) || (a.starsAt || 0) - (b.starsAt || 0));
      return withRanks(rows, (r) => r.totalStars || 0, (a, b) => a > b).slice(0, limit);
    },

    // ---- admin dashboard ----
    async adminData() {
      const [players, privates, runs, sessions] = await Promise.all([
        db.collection('pr_players').get(),
        db.collection('pr_private').get(),
        db.collection('pr_runs').orderBy('at', 'desc').limit(5000).get(),
        db.collection('pr_sessions').orderBy('lastBeat', 'desc').limit(5000).get().catch((e) => {
          console.warn('sessions', e.code || e); return { docs: [], error: e.code || String(e) };
        }),
      ]);
      // Someone who signed in but never synced only has a private row, so merge both.
      const byUid = {};
      players.docs.forEach((d) => { byUid[d.id] = { uid: d.id, ...d.data() }; });
      privates.docs.forEach((d) => { byUid[d.id] = { uid: d.id, ...(byUid[d.id] || {}), ...d.data() }; });
      return {
        players: Object.values(byUid),
        runs: runs.docs.map((d) => d.data()),
        sessions: sessions.docs.map((d) => d.data()),
        sessionsError: sessions.error || null,
      };
    },
  };
})();
