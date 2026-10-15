'use strict';

// ============================================================
//  Achievements: 30 goals in four tiers, each paying Paint Drops.
//  Unlocking all of them gives the Golden Trophy hat (it can't be bought).
//
//  Getting all of them also pays a 1,500 Drops bonus (ALL_BONUS).
//
//  Three kinds:
//   - events  : unlocked by main.js the moment something happens (unlock(id))
//   - counters: a running count reaches `goal` (add(key) / max(key, v))
//   - computed: derived from progress, stars, the wallet... (check(ctx), `value(ctx)`)
//  Saved in this browser and merged into the player's account like the wallet
//  (unlocked = union, counters = max), so nothing is lost between devices.
// ============================================================

const Achievements = (() => {
  const TIERS = {
    easy: { name: 'Easy', color: '#1fc160', reward: 25 },
    medium: { name: 'Medium', color: '#2f7bff', reward: 75 },
    hard: { name: 'Hard', color: '#9b5de5', reward: 200 },
    funny: { name: 'Funny', color: '#ff8c1a', reward: 50 },
  };
  const ALL_BONUS = 1500;
  const LIST = [
    // ---- easy ----
    { id: 'first-splash', tier: 'easy', icon: '🎨', name: 'First Splash', desc: 'Throw your first paint' },
    { id: 'off-we-go', tier: 'easy', icon: '🏁', name: 'Off We Go', desc: 'Clear level 1' },
    { id: 'can-collector', tier: 'easy', icon: '🪣', name: 'Can Collector', desc: 'Collect your first paint can' },
    { id: 'stomp', tier: 'easy', icon: '👟', name: 'Stomp!', desc: 'Stomp a monster' },
    { id: 'window-shopper', tier: 'easy', icon: '🛍️', name: 'Window Shopper', desc: 'Buy your first item in the store' },
    { id: 'paintball', tier: 'easy', icon: '🎯', name: 'Paintball', desc: 'Hit a monster with paint' },
    { id: 'now-you-see-me', tier: 'easy', icon: '✨', name: 'Now You See Me', desc: 'Go through a portal' },
    { id: 'hop-skip', tier: 'easy', icon: '🐇', name: 'Hop, Skip', desc: 'Jump 100 times', goal: 100, count: 'jumps' },
    { id: 'shiny', tier: 'easy', icon: '✴️', name: 'Shiny', desc: 'Collect 10 stars', goal: 10, value: (c) => c.stars },
    { id: 'new-look', tier: 'easy', icon: '🎭', name: 'New Look', desc: 'Unlock a new character', goal: 2, value: (c) => c.charsUnlocked },
    // ---- medium ----
    { id: 'rainbow-hands', tier: 'medium', icon: '🌈', name: 'Rainbow Hands', desc: 'Use all 5 colors in one level' },
    { id: 'bounce-house', tier: 'medium', icon: '🦘', name: 'Bounce House', desc: 'Bounce on blue 100 times', goal: 100, count: 'bounces' },
    { id: 'spider-painter', tier: 'medium', icon: '🕷️', name: 'Spider-Painter', desc: 'Hang from a green ceiling for 5 seconds' },
    { id: 'portal-tourist', tier: 'medium', icon: '🌀', name: 'Portal Tourist', desc: 'Teleport 50 times', goal: 50, count: 'teleports' },
    { id: 'monster-taxi', tier: 'medium', icon: '🚕', name: 'Monster Taxi', desc: 'Send a monster through your portal' },
    { id: 'shrink-inky', tier: 'medium', icon: '🔬', name: 'Honey, I Shrunk the Inky', desc: 'Shrink a monster with yellow' },
    { id: 'perfectionist', tier: 'medium', icon: '⭐', name: 'Perfectionist', desc: 'Get all 3 cans in 10 levels', goal: 10, value: (c) => c.perfectLevels },
    { id: 'world-tour', tier: 'medium', icon: '🗺️', name: 'World Tour', desc: 'Clear the first level of every world', goal: 6, value: (c) => c.worldFirsts },
    { id: 'on-a-roll', tier: 'medium', icon: '📅', name: 'On a Roll', desc: 'Play 7 days in a row', goal: 7, count: 'bestStreak' },
    { id: 'halfway', tier: 'medium', icon: '🧭', name: 'Halfway There', desc: 'Clear 23 levels', goal: 23, value: (c) => c.cleared },
    { id: 'stompede', tier: 'medium', icon: '🐘', name: 'Stompede', desc: 'Stomp 25 monsters', goal: 25, count: 'stomps' },
    { id: 'can-do', tier: 'medium', icon: '🥫', name: 'Can Do', desc: 'Collect 100 paint cans', goal: 100, count: 'cans' },
    // ---- hard ----
    { id: 'masterpiece', tier: 'hard', icon: '🖼️', name: 'Masterpiece', desc: 'Clear all 45 levels', goal: 45, value: (c) => c.cleared },
    { id: 'star-collector', tier: 'hard', icon: '🌟', name: 'Star Collector', desc: 'Collect all 135 stars', goal: 135, value: (c) => c.stars },
    { id: 'flawless', tier: 'hard', icon: '💎', name: 'Flawless', desc: 'Clear a level from World 4 or later without dying' },
    { id: 'minimalist', tier: 'hard', icon: '☝️', name: 'Minimalist', desc: 'Clear a level using only 1 throw' },
    { id: 'speed-painter', tier: 'hard', icon: '⚡', name: 'Speed Painter', desc: 'Beat 5 levels in under 10 seconds each', goal: 5, value: (c) => c.fastLevels },
    { id: 'fashionista', tier: 'hard', icon: '👑', name: 'Fashionista', desc: 'Wear a hat, trail, color, splat and flag all at once', goal: 5, value: (c) => c.outfit },
    { id: 'top-board', tier: 'hard', icon: '🥇', name: 'Top of the Board', desc: 'Hold 1st place on any level leaderboard' },
    { id: 'collector', tier: 'hard', icon: '🧳', name: 'Collector', desc: 'Own 20 items from the store', goal: 20, value: (c) => c.owned },
    { id: 'clean-sweep', tier: 'hard', icon: '🧹', name: 'Clean Sweep', desc: 'Clear 20 levels without dying', goal: 20, count: 'cleanRuns' },
    { id: 'lava-lord', tier: 'hard', icon: '🌶️', name: 'Lava Lord', desc: 'Get all 3 cans in every lava finale level', goal: 5, value: (c) => c.finalePerfect },
    // ---- funny ----
    { id: 'floor-is-lava', tier: 'funny', icon: '🌋', name: 'The Floor Is Lava', desc: 'Fall into lava 25 times', goal: 25, count: 'lavaDeaths' },
    { id: 'so-close', tier: 'funny', icon: '😩', name: 'So Close!', desc: 'Die within 2 tiles of the finish flag' },
    { id: 'paint-everything', tier: 'funny', icon: '🎉', name: 'Paint Everything', desc: 'Throw 200 paint blobs in a single level', goal: 200, count: 'mostThrows' },
    { id: 'clean-freak', tier: 'funny', icon: '🧽', name: 'Clean Freak', desc: 'Wash paint off 50 times', goal: 50, count: 'washes' },
    { id: 'lava-taxi', tier: 'funny', icon: '🔥', name: 'Lava Taxi', desc: 'Send a monster through a portal straight into lava' },
    { id: 'bounce-danger', tier: 'funny', icon: '🤕', name: 'Bounce Into Danger', desc: 'Bounce on blue paint right into spikes' },
    { id: 'dinner-time', tier: 'funny', icon: '🤷', name: '6, 7...', desc: 'Play between 6 and 7 pm' },
    { id: 'try-again', tier: 'funny', icon: '🔁', name: 'Try, Try Again', desc: 'Fall 100 times', goal: 100, count: 'deaths' },
    { id: 'pancake', tier: 'funny', icon: '🥞', name: 'Pancake', desc: 'Get squashed by a moving platform' },
    { id: 'big-spender', tier: 'funny', icon: '💸', name: 'Big Spender', desc: 'Spend 2,000 Paint Drops', goal: 2000, value: (c) => c.spent },
    { id: 'hoarder', tier: 'funny', icon: '🐉', name: 'Hoarder', desc: 'Have 1,500 Paint Drops saved up at once', goal: 1500, value: (c) => c.drops },
  ];
  const byId = Object.fromEntries(LIST.map((a) => [a.id, a]));

  const KEY = 'paintRunner.ach';
  const blank = () => ({ unlocked: {}, counts: {} });
  let st = blank();
  try { st = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };

  let onUnlock = () => { };
  let lastCtx = null;

  function unlock(id) {
    const a = byId[id];
    if (!a || st.unlocked[id]) return false;
    st.unlocked[id] = Date.now();
    save();
    onUnlock(a, TIERS[a.tier].reward, allDone());
    return true;
  }
  const allDone = () => LIST.every((a) => st.unlocked[a.id]);

  // counters
  // the play streak: a day you play right after the last one adds 1, a gap starts again at 1
  function playedToday() {
    const now = new Date();
    const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);   // local day number
    const last = st.counts.lastDay || 0;
    if (day <= last) return;
    st.counts.streak = day === last + 1 ? (st.counts.streak || 0) + 1 : 1;
    st.counts.lastDay = day;
    save();
    max('bestStreak', st.counts.streak);
  }
  function add(key, n = 1) { st.counts[key] = (st.counts[key] || 0) + n; save(); checkCounts(key); }
  function max(key, v) { if (v > (st.counts[key] || 0)) { st.counts[key] = v; save(); checkCounts(key); } }
  function checkCounts(key) { for (const a of LIST) if (a.count === key && (st.counts[key] || 0) >= a.goal) unlock(a.id); }

  // computed ones, from what main.js knows (progress, stars, wallet...)
  function check(ctx) {
    lastCtx = ctx;
    for (const a of LIST) if (a.value && a.value(ctx) >= a.goal) unlock(a.id);
  }

  // for the Achievements screen
  function list() {
    return LIST.map((a) => {
      const done = !!st.unlocked[a.id];
      const progress = a.count ? (st.counts[a.count] || 0) : a.value && lastCtx ? a.value(lastCtx) : null;
      return { ...a, reward: TIERS[a.tier].reward, tierName: TIERS[a.tier].name, tierColor: TIERS[a.tier].color,
        done, at: st.unlocked[a.id] || 0, progress: progress === null ? null : Math.min(progress, a.goal || progress) };
    });
  }

  // two devices: everything unlocked anywhere stays unlocked (earliest time), counters take the max
  function mergeInto(a = {}, b = {}) {
    const unlocked = { ...(b.unlocked || {}) };
    for (const [k, t] of Object.entries(a.unlocked || {})) unlocked[k] = unlocked[k] ? Math.min(unlocked[k], t) : t;
    const counts = { ...(b.counts || {}) };
    for (const [k, v] of Object.entries(a.counts || {})) counts[k] = Math.max(counts[k] || 0, v);
    return { unlocked, counts };
  }
  // take in what the account has (no rewards for these: the account already paid them out)
  function apply(other) {
    st = mergeInto(st, other);
    save();
  }
  function reset() { st = blank(); save(); }

  return {
    TIERS, LIST, ALL_BONUS, byId, unlock, add, max, playedToday, check, list, apply, reset, mergeInto, allDone,
    state: () => JSON.parse(JSON.stringify(st)),
    count: () => Object.keys(st.unlocked).filter((k) => byId[k]).length,
    set onUnlock(fn) { onUnlock = fn; },
  };
})();

if (typeof module !== 'undefined') module.exports = { Achievements };
