'use strict';

/* ============================================================
   Cloud: Google sign-in, leaderboards and progress sync (Firebase).

   Firestore layout (Paint Runner's own Firebase project, collections prefixed pr_):
     pr_players/{uid}                      public profile + progress (for the star ranking)
     pr_private/{uid}                      email; only the admin can read it
     pr_levels/{levelKey}/pr_scores/{uid}  one row per player per level: their bests
     pr_runs/{autoId}                      every finished or abandoned attempt (admin stats)

   The game never depends on this: if Firebase can't be reached, or the rules
   haven't been published yet, everything keeps working locally.
   ============================================================ */

const Cloud = (() => {
  let auth = null, db = null, user = null, available = false;
  const listeners = new Set();

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    available = true;
  } catch (e) {
    console.warn('Paint Runner: online features unavailable', e);
  }

  const levelKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const scores = (name) => db.collection('pr_levels').doc(levelKey(name)).collection('pr_scores');

  // Leaderboards are public, so only show "First L." rather than a full name.
  function publicName(u) {
    const parts = (u.displayName || 'Painter').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  }

  // Saves still on their way to the server. Leaderboard reads wait for these, so you
  // always see your own latest result.
  let pending = Promise.resolve();
  const track = (p) => { pending = Promise.all([pending, p.catch(() => { })]); return p; };

  const emit = () => listeners.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });

  if (available) {
    auth.getRedirectResult().catch(() => { });
    auth.onAuthStateChanged((u) => {
      user = u;
      if (u) {
        db.collection('pr_private').doc(u.uid).set({
          email: u.email || '', fullName: u.displayName || '', lastSeen: Date.now(),
        }, { merge: true }).catch((e) => console.warn('pr_private', e.code || e));
      }
      emit();
    });
  }

  const min = (a, b) => (a === undefined || a === null ? b : b === undefined || b === null ? a : Math.min(a, b));
  const dropUndefined = (o) => { Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]); return o; };
  const round2 = (t) => Math.round(t * 100) / 100;

  /* Merges one result into a score row. Returns the new row. */
  function mergeScore(old, r, countPlay) {
    const d = old || {};
    return dropUndefined({
      uid: user.uid,
      name: publicName(user),
      photo: user.photoURL || '',
      level: r.level,
      levelIdx: r.levelIdx,
      bestTime: round2(min(d.bestTime, r.time)),
      bestStars: Math.max(d.bestStars || 0, r.stars || 0),
      best3Time: r.stars === 3 && r.time ? round2(min(d.best3Time, r.time)) : d.best3Time,
      fewestThrows: min(d.fewestThrows, r.throws),
      plays: (d.plays || 0) + (countPlay ? 1 : 0),
      updatedAt: Date.now(),
    });
  }

  async function rankIn(name, field) {
    const snap = await scores(name).orderBy(field).limit(100).get();
    const i = snap.docs.findIndex((d) => d.id === user.uid);
    return i < 0 ? null : i + 1;
  }

  return {
    get available() { return available; },
    get user() { return user; },
    get isAdmin() { return !!(user && user.email === ADMIN_EMAIL && user.emailVerified); },
    publicName,
    levelKey,
    onChange(fn) { listeners.add(fn); fn(user); return () => listeners.delete(fn); },

    async signIn() {
      if (!available) throw new Error('offline');
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await auth.signInWithPopup(provider);
      } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(provider);
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
        throw e;
      }
    },
    signOut() { return auth && auth.signOut(); },

    /* A level was finished (completed=true) or abandoned. Logged for the stats dashboard. */
    async logRun(run) {
      if (!user) return;
      await db.collection('pr_runs').add(dropUndefined({
        uid: user.uid, name: publicName(user),
        level: run.level, levelIdx: run.levelIdx, completed: !!run.completed,
        time: round2(run.time), stars: run.stars || 0, throws: run.throws || 0, deaths: run.deaths || 0,
        at: Date.now(),
      }));
    },

    /* Posts a completed run to the level's leaderboards and returns this player's ranks. */
    submitScore(r) {
      if (!user) return Promise.resolve(null);
      return track(this._submitScore(r));
    },

    async _submitScore(r) {
      const ref = scores(r.level).doc(user.uid);
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
      if (!user) return Promise.resolve(null);
      return track(this._saveProfile(local, levels));
    },

    async _saveProfile(local, levels) {
      const ref = db.collection('pr_players').doc(user.uid);
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
      await ref.set({
        name: publicName(user), photo: user.photoURL || '',
        joinedAt: cloud.joinedAt || Date.parse(user.metadata.creationTime) || Date.now(),
        lastSeen: Date.now(),
        unlocked: Math.max(local.unlocked || 0, cloud.unlocked || 0),
        progress: merged, totalStars, levelsCleared: Object.keys(merged).length,
      });
      return { merged, unlocked: Math.max(local.unlocked || 0, cloud.unlocked || 0) };
    },

    async syncProgress(local, levels) {
      if (!user) return null;
      const { merged, unlocked } = await this.saveProfile(local, levels);

      // Backfill leaderboards with any local bests the cloud doesn't know about yet.
      await Promise.all(levels.map(async (l, i) => {
        const p = merged[levelKey(l.name)];
        if (!p) return;
        const sref = scores(l.name).doc(user.uid);
        const s = await sref.get();
        const old = s.exists ? s.data() : null;
        const row = mergeScore(old, { level: l.name, levelIdx: i, time: p.t, stars: p.s, throws: p.th }, false);
        if (p.t3 !== undefined) row.best3Time = round2(min(row.best3Time, p.t3));
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
      return { progress, unlocked };
    },

    /* The three boards for one level. */
    async leaderboard(name, limit = 10) {
      await pending;
      const top = async (field) => (await scores(name).orderBy(field).limit(limit).get()).docs.map((d) => d.data());
      const [fastest, perfect, efficient] = await Promise.all([top('bestTime'), top('best3Time'), top('fewestThrows')]);
      let me = null;
      if (user) {
        const s = await scores(name).doc(user.uid).get();
        if (s.exists) me = s.data();
      }
      return { fastest, perfect, efficient, me };
    },

    /* Overall ranking by stars collected. */
    async starBoard(limit = 20) {
      await pending;
      const snap = await db.collection('pr_players').orderBy('totalStars', 'desc').limit(limit).get();
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    },

    // ---- admin dashboard ----
    async adminData() {
      const [players, privates, runs] = await Promise.all([
        db.collection('pr_players').get(),
        db.collection('pr_private').get(),
        db.collection('pr_runs').orderBy('at', 'desc').limit(5000).get(),
      ]);
      // Someone who signed in but never synced only has a private row, so merge both.
      const byUid = {};
      players.docs.forEach((d) => { byUid[d.id] = { uid: d.id, ...d.data() }; });
      privates.docs.forEach((d) => { byUid[d.id] = { uid: d.id, ...(byUid[d.id] || {}), ...d.data() }; });
      return { players: Object.values(byUid), runs: runs.docs.map((d) => d.data()) };
    },
  };
})();
