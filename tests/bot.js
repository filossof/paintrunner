// Level-testing bot for Paint Runner. Plays through world.js like a player would:
// paint is only ever applied by real throws, aimed by searching in a cloned world.
const G = require('../world.js');
const { World, LEVELS, T, NONE, BLUE, RED, GREEN, YELLOW, PURPLE } = G;

const DONE = Symbol('done');
const lvl = (name) => {
  const l = LEVELS.find((x) => x.name === name);
  if (!l) throw new Error('no level ' + name);
  return l;
};

function cloneWorld(w) {
  const c = Object.create(World.prototype);
  for (const k of Object.keys(w)) if (typeof w[k] !== 'function') c[k] = k === 'def' ? w[k] : structuredClone(w[k]);
  c.platforms = c.level.platforms;
  c.events = [];
  return c;
}

// Sweep throw angles until one makes ok(clone) true. Returns an aim point or null.
function findThrow(w, color, ok, prefer = null) {
  const p = w.player, cx = p.x + p.w / 2, cy = p.y + p.h * 0.25;
  const angles = [];
  for (let a = 0; a < 360; a += 0.5) angles.push(a);
  if (prefer !== null) angles.sort((a, b) => Math.abs(((a - prefer + 540) % 360) - 180) - Math.abs(((b - prefer + 540) % 360) - 180)).reverse();
  for (const deg of angles) {
    const a = deg * Math.PI / 180;
    const c = cloneWorld(w);
    c.player.throwCd = 0; c.state = 'play';
    const tx = cx + Math.cos(a) * 300, ty = cy + Math.sin(a) * 300;
    if (!c.throwPaint(tx, ty, color)) continue;
    let n = 0;
    while (c.blobs.length && n++ < 400) c.stepBlobs();
    if (ok(c, w)) return [tx, ty];
  }
  return null;
}

// What a paint step should achieve.
const target = {
  tile: (c, r, color) => (cw) => cw.level.paint[r][c] === color,
  tiles: (list, color) => (cw) => list.every(([c, r]) => cw.level.paint[r][c] === color),
  any: (list, color) => (cw) => list.some(([c, r]) => cw.level.paint[r][c] === color),
  row: (r, c0, c1, color) => (cw) => { for (let c = c0; c <= c1; c++) if (cw.level.paint[r][c] !== color) return false; return true; },
  portal: (c, r, face) => (cw) => cw.portals.some((q) => q.c === c && q.r === r && q.face === face),
  // the newest portal's exit leads into columns c0..c1 (floor, ceiling or wall - any face)
  portalInto: (c0, c1) => (cw, w0) => {
    const q = cw.portals[cw.portals.length - 1];
    if (!q) return false;
    if (w0 && w0.portals.some((o) => o.c === q.c && o.r === q.r && o.face === q.face)) return false;
    const ex = q.face === 'left' ? q.c - 1 : q.face === 'right' ? q.c + 1 : q.c;
    return ex >= c0 && ex <= c1;
  },
  // the newest portal landed anywhere in columns c0..c1 of row r, on the given face
  portalIn: (c0, c1, r, face) => (cw, w0) => {
    const q = cw.portals[cw.portals.length - 1];
    const fresh = !w0 || !w0.portals.some((o) => o.c === q.c && o.r === q.r && o.face === q.face);
    return !!q && fresh && q.r === r && q.face === face && q.c >= c0 && q.c <= c1;
  },
  stun: (i) => (cw) => cw.monsters[i].alive && cw.monsters[i].stun > 0,
  platform: (i, color) => (cw) => cw.platforms[i].color === color,
};

// ---------------- steps ----------------
const S = {
  // walk to a center x on the ground
  walk: (x, o = {}) => (w) => {
    const p = w.player, cx = p.x + p.w / 2;
    if (Math.abs(cx - x) <= (o.tol || 2) && (p.grounded || o.air)) return DONE;
    return { right: cx < x, left: cx > x, down: o.down !== false };
  },
  wait: (n) => (w, m) => ((m.n = (m.n || 0) + 1) > n ? DONE : { down: true }),
  waitFor: (pred, timeout = 900, input = { down: true }) => (w, m) => {
    if (pred(w)) return DONE;
    if ((m.n = (m.n || 0) + 1) > timeout) return { fail: 'waitFor timeout' };
    return typeof input === 'function' ? input(w) : input;
  },
  // walk to the middle of the painted tiles of a color in row r between c0..c1 (the player stands on row r)
  walkToPaint: (r, c0, c1, color, o = {}) => (w, m) => {
    if (m.x === undefined) {
      const cols = [];
      for (let c = c0; c <= c1; c++) if (w.level.paint[r][c] === color) cols.push(c);
      if (!cols.length) return { fail: `nothing painted in row ${r}` };
      const pick = o.pick === 'left' ? cols[0] : o.pick === 'right' ? cols[cols.length - 1] : cols[Math.floor(cols.length / 2)];
      m.x = pick * T + T / 2;
    }
    const p = w.player, cx = p.x + p.w / 2;
    if (Math.abs(cx - m.x) <= 2 && p.grounded) return DONE;
    return { right: cx < m.x, left: cx > m.x, down: true };
  },
  // throw paint so that `ok` becomes true (searching aims), wait for it to land, verify
  paint: (ok, color, label = '', prefer = null) => (w, m) => {
    const p = w.player;
    if (!m.thrown) {
      if (p.throwCd > 0 || !p.grounded && !p.cling && !m.air) return { down: true };
      // let any monster shot that's already flying land first (it might wash our paint)
      if (w.blobs.some((b) => b.owner === 'monster') && (m.waitShot = (m.waitShot || 0) + 1) < 120) return { down: true };
      const aim = findThrow(w, color, ok, prefer);
      if (!aim) {
        if (process.env.DEBUG) console.log('DEBUG', label, 'blobs', JSON.stringify(w.blobs), 'monsters', JSON.stringify(w.monsters.map((q) => ({ x: q.x | 0, y: q.y | 0, warning: q.warning, cd: q.cooldown, stun: q.stun }))), 'player', w.player.x, w.player.y, 'paint14', w.level.paint[14].join(''));
        return { fail: `no throw found: ${label}` };
      }
      m.thrown = true; m.wait = 0;
      return { throw: aim, color, down: true };
    }
    if (w.blobs.some((b) => b.owner === 'player') && m.wait++ < 300) return { down: true };
    if (ok(w)) return DONE;
    m.tries = (m.tries || 0) + 1;
    if (m.tries > 3) return { fail: `paint did not stick: ${label}` };
    m.thrown = false;
    return { down: true };
  },
  // same, but allowed while airborne (e.g. at the top of a bounce) - fires immediately
  paintNow: (ok, color, label = '') => (w, m) => {
    if (!m.thrown) {
      const aim = findThrow(w, color, ok);
      if (!aim) return { fail: `no throw found (air): ${label}` };
      w.player.throwCd = 0;
      m.thrown = true;
      return { throw: aim, color };
    }
    return DONE;
  },
  // press jump, then steer in the air until grounded again (or clinging, if asked)
  jump: (steer = () => ({}), o = {}) => (w, m) => {
    const p = w.player;
    if (!m.started) { m.started = true; m.t = 0; return { jump: true, ...steer(w, m) }; }
    m.t++;
    if (m.t > 2 && (p.grounded || (o.untilCling && p.cling))) return DONE;
    if (m.t > (o.timeout || 400)) return { fail: 'jump never landed' };
    const s = steer(w, m) || {};
    // hold down while falling so blue paint doesn't bounce us again (unless asked to)
    return { jump: o.holdJump !== false && p.vy < 0 && !p.cling, down: !o.rebounce && p.vy > 0, ...s };
  },
  // wash a tile if it's painted a given color (e.g. before jumping off it)
  unpaint: (c, r, color) => (w, m) => {
    if (!m.inner) {
      if (w.level.paint[r][c] !== color) return DONE;
      m.inner = S.paint((cw) => cw.level.paint[r][c] === NONE, NONE, `wash ${c},${r}`);
      m.im = {};
    }
    return m.inner(w, m.im);
  },
  // stomp every listed Inky, always going for whichever is closest
  stompAll: (list, o = {}) => (w, m) => {
    const p = w.player, cx = p.x + p.w / 2;
    const alive = list.map((i) => w.monsters[i]).filter((q) => q.alive);
    if (!alive.length) return p.grounded ? DONE : { down: true };
    const q = alive.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (m.q !== q) { m.q = q; m.inner = S.stomp(w.monsters.indexOf(q), o); m.im = {}; }
    const r = m.inner(w, m.im);
    if (r === DONE) { m.q = null; return { down: true }; }
    return r;
  },
  // wait for an Inky to come close, then jump onto it (aiming where it will be when we land)
  stomp: (i, o = {}) => (w, m) => {
    const q = w.monsters[i], p = w.player;
    const cx = p.x + p.w / 2, qx = q.x + q.w / 2;
    // after the stomp, steer back over where we jumped from so the rebound doesn't carry us off a ledge
    if (!q.alive) return p.grounded ? DONE : { down: true, ...(m.jx !== undefined ? { right: cx < m.jx - 2, left: cx > m.jx + 2 } : {}) };
    const speed = Math.abs(q.vx) || 1.2;
    if (!m.jumping) {
      const d = qx - cx;
      const approaching = q.vx === 0 || Math.sign(q.vx) === -Math.sign(d);
      const trigger = speed * 22 + 14;
      if (approaching && Math.abs(d) < trigger && Math.abs(q.y + q.h - (p.y + p.h)) < 8 && p.grounded) { m.jumping = true; m.jx = cx; return { jump: true }; }
      if ((m.t = (m.t || 0) + 1) > (o.timeout || 900)) return { fail: 'inky never came' };
      return { down: true };
    }
    if (p.grounded && m.jumping && (m.air = (m.air || 0) + 1) > 2) { m.jumping = false; m.air = 0; return { down: true }; }
    // predict where the Inky's middle will be when we come down
    const g = 0.6, dy = (q.y) - (p.y + p.h);
    const tLand = p.vy < 0 ? (-p.vy / g) + Math.sqrt(Math.max(0, 2 * Math.max(1, -dy) / g)) : Math.sqrt(Math.max(0, 2 * Math.max(1, dy) / g));
    let aim = qx + q.vx * Math.min(tLand, 40);
    // the Inky turns around at edges, so never aim past the ground it patrols
    const gr = Math.floor((q.y + q.h + 1) / T), qc = Math.floor(qx / T);
    let lo = qc, hi = qc;
    while (w.solid(lo - 1, gr) && !w.solid(lo - 1, gr - 1)) lo--;
    while (w.solid(hi + 1, gr) && !w.solid(hi + 1, gr - 1)) hi++;
    aim = Math.max(lo * T + 12, Math.min((hi + 1) * T - 12, aim));
    return { jump: p.vy < 0, right: aim > cx + 2, left: aim < cx - 2 };
  },
  // walk (and hop if needed) to the flag
  toFlag: () => (w, m) => {
    const f = w.level.flag, p = w.player, cx = p.x + p.w / 2, fx = f.c * T + T / 2;
    if ((m.t = (m.t || 0) + 1) > 600) return { fail: 'could not reach the flag' };
    return { right: cx < fx - 2, left: cx > fx + 2, down: true };
  },
  // climb the wall you're stuck to until you stand on top (feet at or above topY)
  climb: (topY, o = {}) => (w, m) => {
    const p = w.player;
    if (p.grounded && p.y + p.h <= topY + 1) return DONE;
    if ((m.t = (m.t || 0) + 1) > (o.timeout || 900)) return { fail: 'climb timeout' };
    if (p.cling === 1 || p.cling === -1) return { up: true, right: p.cling === 1, left: p.cling === -1 };
    // just hopped over the lip: keep pushing toward the wall's top
    const dir = o.dir || 1;
    return { right: dir > 0, left: dir < 0, down: p.vy > 0 };
  },
  // stop, then jump straight up (optionally steering)
  hop: (steer) => S.jump(steer || (() => ({}))),
  // custom step: fn returns input, DONE or {fail}
  fn: (fn) => (w, m) => fn(w, m),
};

// steer helpers
const toward = (x, o = {}) => (w) => {
  const p = w.player, cx = p.x + p.w / 2;
  if (o.above !== undefined && p.y + p.h > o.above) return { down: o.down };
  if (Math.abs(cx - x) < 3) return { down: o.down };
  return { right: cx < x, left: cx > x, down: o.down };
};

// ---------------- runner ----------------
function run(w, steps, o = {}) {
  let i = 0, mem = {}, prevJump = false;
  const max = o.max || 9000;
  const deaths0 = w.deaths;
  let lastDeath = null;
  for (let f = 0; f < max; f++) {
    if (w.state === 'won') return { won: true, f, cans: w.cansCollected, missed: w.cans.filter((c) => !c.got).map((c) => `${c.c},${c.r}`).join(' ') || undefined };
    let a = {};
    if (i < steps.length) {
      const r = steps[i](w, mem, f);
      if (r === DONE) { i++; mem = {}; f--; continue; }
      if (r && r.fail) return { won: false, fail: r.fail, step: i, f, cans: w.cansCollected, pos: pos(w) };
      a = r || {};
    }
    if (a.throw) w.throwPaint(a.throw[0], a.throw[1], a.color);
    const jump = !!(a.jump || a.up);
    w.step({ left: !!a.left, right: !!a.right, up: !!a.up, down: !!a.down, jump,
      jumpPressed: jump && !prevJump, spacePressed: !!a.space });
    prevJump = jump;
    if (o.trace) o.trace(w, a, f, i);
    for (const e of w.events) {
      if (e.type === 'die') lastDeath = e.cause || 'hit';
      if (e.type === 'teleport') { w._tpFrame = f; w._tpX = e.x; }
    }
    w._frame = f;
    w.events.length = 0;
    if (w.deaths > deaths0 && !o.allowDeath) return { won: false, died: lastDeath, step: i, f, cans: w.cansCollected, pos: pos(w) };
  }
  return { won: false, fail: 'timeout', step: i, cans: w.cansCollected, pos: pos(w) };
}
const pos = (w) => `x=${w.player.x.toFixed(0)} y=${w.player.y.toFixed(0)} ${w.player.size}${w.player.cling ? ' cling' + w.player.cling : ''}`;

// Can a greedy no-paint bot win? (It shouldn't.)
function noPaintWin(def) {
  const w = new World(def);
  const r = run(w, [S.fn((w, m) => ({ right: true, jump: (m.k = (m.k || 0) + 1) % 40 < 20 }))], { max: 1500, allowDeath: true });
  return r.won;
}

// prints, per step, which columns the player passes through in the air and at which rows
const arcTracer = (steps) => (w, a, f, i) => { const p = w.player; if (!p.grounded && steps.includes(i)) console.log('ARC', i, Math.floor((p.x + p.w / 2) / 32), Math.floor(p.y / 32), Math.floor((p.y + p.h - 1) / 32)); };
const arcSummary = (lines) => { const s = {}; for (const l of lines) { const [, i, c, r0, r1] = l.split(' ').map(Number); const k = i + ' col ' + c; s[k] = s[k] || [99, -1]; s[k][0] = Math.min(s[k][0], r0); s[k][1] = Math.max(s[k][1], r1); } return Object.entries(s).map(([k, v]) => `${k}: rows ${v[0]}-${v[1]}`); };

const tracer = (every = 3) => (w, a, f, i) => { const p = w.player; if (f % every === 0 || w.events.length) console.log(`f${f} s${i}`, p.x.toFixed(0), p.y.toFixed(0), p.vx.toFixed(1), p.vy.toFixed(1), p.grounded ? 'G' : '-', p.groundColor, p.cling, JSON.stringify(a).slice(0, 50), w.events.map((e) => e.type).join()); };

module.exports = { arcTracer, arcSummary, tracer, G, World, LEVELS, T, NONE, BLUE, RED, GREEN, YELLOW, PURPLE, DONE, lvl, cloneWorld, findThrow, target, S, toward, run, noPaintWin };
