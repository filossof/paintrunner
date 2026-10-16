'use strict';

// ============================================================
//  Ghosts: a see-through runner replaying a recorded run of the level, to race against.
//
//  Every attempt is recorded (where the hero is every other frame). Finishing a level keeps the
//  recording of your fastest run: on this device, and in your account when signed in, where it
//  becomes the ghost other players race. The setting (Settings window, or the question after your
//  first cleared level) picks which ghost you see:
//    'top'  - the fastest recorded run of the level (the #1 record, once its holder has a recording)
//    'mine' - your own best run
//    'off'  - no ghost
//  Until the player has chosen, there is no ghost (`chosen()` is false).
// ============================================================

const Ghost = (() => {
  const STEP = 2;                       // one sample every 2 frames (30 a second); drawing fills the gaps
  const MAX_SAMPLES = 60 * 60 * 5 / STEP;   // 5 minutes is plenty for any level
  const KEY = 'paintRunner.ghost';
  const MODES = ['top', 'mine', 'off'];

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  let mode = store.get(KEY);
  if (!MODES.includes(mode)) mode = null;

  // ---------- recording ----------
  // a sample: x, y (pixels) and a few flags for drawing the pose
  const SMALL = 1, LEFT = 2, AIR = 4, MOVING = 8, CLING = 16;   // CLING: 2 bits (16, 32): 1 right wall, 2 left wall, 3 ceiling
  let rec = [];
  function flagsOf(p) {
    const cling = p.cling === 1 ? 1 : p.cling === -1 ? 2 : p.cling === 2 ? 3 : 0;
    const moving = p.cling ? Math.abs(p.vx) + Math.abs(p.vy) > 0.3 : p.grounded && Math.abs(p.vx) > 0.6;
    return (p.size === 'small' ? SMALL : 0) | ((p.cling ? p.cling === -1 : p.face < 0) ? LEFT : 0) |
      (!p.grounded && p.cling !== 2 ? AIR : 0) | (moving ? MOVING : 0) | cling * CLING;
  }
  // after every world step: the level timer (w.frame) says where in the run we are; it starts again
  // from 0 when a death restarts the level, and so does the recording
  function record(w) {
    if (w.state !== 'play' && w.state !== 'won') return;
    if (w.frame % STEP || w.frame / STEP > MAX_SAMPLES) return;
    const i = w.frame / STEP, p = w.player;
    if (i < rec.length) rec.length = i;
    const s = [Math.round(p.x), Math.round(p.y), flagsOf(p)];
    while (rec.length <= i) rec.push(s);   // (fills a gap, e.g. a level that started mid-step)
  }
  function resetRecording() { rec = []; }

  // compact text form: little-endian int16 triples, base64
  function encode(samples) {
    const a = new Int16Array(samples.length * 3);
    samples.forEach((s, i) => { a[i * 3] = s[0]; a[i * 3 + 1] = s[1]; a[i * 3 + 2] = s[2]; });
    const bytes = new Uint8Array(a.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function decode(str) {
    const bin = atob(str), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
    const out = [];
    for (let i = 0; i + 2 < a.length; i += 3) out.push([a[i], a[i + 1], a[i + 2]]);
    return out;
  }

  // the finished run, ready to keep: { time, data, char, hat, skin }
  function finished(time, look) {
    if (rec.length < 10) return null;
    return { time, data: encode(rec), char: look.char || 'blob', hat: look.hat || '', skin: look.skin || '', at: Date.now() };
  }

  // ---------- your own best runs, on this device ----------
  const localKey = (name) => `${KEY}.${name}`;
  const loadMine = (name) => store.get(localKey(name));
  // keeps it if it's your fastest recording of this level; returns true if it was kept
  function keepMine(name, g) {
    const old = loadMine(name);
    if (old && old.time <= g.time) return false;
    return store.set(localKey(name), g);
  }

  // ---------- playback ----------
  // the ghost being raced: { time, samples, char, hat, skin, label } (or null)
  let current = null;
  function use(g, label) {
    current = g ? { ...g, samples: g.samples || decode(g.data), label } : null;
    return current;
  }
  // where the ghost is at level frame f (interpolated between samples); null once it has finished
  function at(f) {
    if (!current) return null;
    const s = current.samples, i = f / STEP, a = Math.floor(i);
    if (a >= s.length - 1) return a < s.length + 45 ? { x: s[s.length - 1][0], y: s[s.length - 1][1], fl: s[s.length - 1][2], done: true } : null;
    const k = i - a, p = s[a], q = s[a + 1];
    return { x: p[0] + (q[0] - p[0]) * k, y: p[1] + (q[1] - p[1]) * k, fl: k < 0.5 ? p[2] : q[2], done: false };
  }

  // your own runs that haven't reached your account yet (e.g. saved while offline, or before the
  // database accepted ghosts): [levelName, ghost]
  function pending(names) {
    return names.map((n) => [n, loadMine(n)]).filter(([, g]) => g && !g.up);
  }
  function markUploaded(name, g) {
    const cur = loadMine(name);
    if (cur && cur.time === g.time) store.set(localKey(name), { ...cur, up: true });
  }

  return {
    MODES, pending, markUploaded, SMALL, LEFT, AIR, MOVING, CLING,
    get mode() { return mode || 'off'; },
    chosen: () => mode !== null,
    setMode(m) { if (MODES.includes(m)) { mode = m; store.set(KEY, m); } },
    record, resetRecording, finished, encode, decode,
    loadMine, keepMine,
    use, at,
    get current() { return current; },
  };
})();

if (typeof module !== 'undefined') module.exports = { Ghost };
