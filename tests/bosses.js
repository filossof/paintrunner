// The chases (the first level and the bosses): can each be beaten with the Eraser chasing, using real throws only?
// The bot's route is built from the level's pieces (levels.js: chaseLevel / PIECES).
// Run: node tests/bosses.js
const B = require('./bot.js');
const { World, T, BLUE, RED, GREEN, YELLOW, PURPLE, S, target, run, DONE } = B;
const { bounce } = require('./blue.js');
const { runJump } = require('./red.js');
const { becomeSize } = require('./yellow.js');
const { enter } = require('./purple.js');
const { BOSSES, FIRST_CHASE } = require('../levels.js');

// paint while hanging from a green ceiling (no "down": that would let go)
const hangPaint = (ok, color, label) => (w, m) => {
  if (!m.thrown) {
    if (w.player.throwCd > 0) return {};
    const aim = B.findThrow(w, color, ok);
    if (!aim) return { fail: `no throw found (hanging): ${label}` };
    m.thrown = true; m.wait = 0;
    return { throw: aim, color };
  }
  if (w.blobs.some((b) => b.owner === 'player') && m.wait++ < 300) return {};
  return ok(w) ? DONE : { fail: `paint did not stick: ${label}` };
};

// get past a stretch's Inkies by stomping each: wait for one that's coming at us (the usual bot
// stomp), or chase one that's walking away and jump onto it once we're running at full speed
const fight = (ids, xEnd) => (w, m) => {
  const p = w.player, cx = p.x + p.w / 2;
  if ((m.t = (m.t || 0) + 1) > 2400) return { fail: 'stuck among the monsters' };
  // a low step right ahead: hop it
  const stepAhead = p.grounded && w.solid(Math.floor((p.x + p.w + 6) / T), Math.floor((p.y + p.h - 6) / T));
  // only Inkies still ahead of us matter (one we've already jumped past is left behind)
  const alive = ids.filter((i) => w.monsters[i].alive && w.monsters[i].x + w.monsters[i].w > p.x - 4);
  if (!alive.length) return cx >= xEnd && p.grounded ? DONE : { right: cx < xEnd, down: !stepAhead, jump: stepAhead || (!p.grounded && p.vy < 0) };
  const i = alive.sort((a, b) => Math.abs(w.monsters[a].x - p.x) - Math.abs(w.monsters[b].x - p.x))[0], q = w.monsters[i];
  const qx = q.x + q.w / 2, d = qx - cx;
  if (p.grounded) {
    // hop the fence only when the Inky behind it is out of the way
    if (stepAhead && d > 0) return (d > 7 * T || (d > 3.6 * T && q.vx > 0)) ? { jump: true, right: true } : { down: true };
    const closing = Math.max(0.5, p.vx - q.vx);         // how fast the gap shrinks (it may be coming at us)
    if (Math.abs(p.vx) > 3.2 && d > 0 && d < closing * 30 + 6) return { jump: true, right: true };
    return { right: d > 0, left: d < 0, down: true };
  }
  const g = 0.6, dy = q.y - (p.y + p.h);
  const tLand = p.vy < 0 ? (-p.vy / g) + Math.sqrt(Math.max(0, 2 * Math.max(1, -dy) / g)) : Math.sqrt(Math.max(0, 2 * Math.max(1, dy) / g));
  const aim = qx + q.vx * Math.min(tLand, 40);
  return { jump: p.vy < 0, right: aim > cx + 2, left: aim < cx - 2 };
};

// all of these rows of a wall's face painted green
const face = (c, rows) => target.tiles(rows.map((r) => [c, r]), GREEN);

const ROUTE = {
  run: (o, p) => [S.walk((o + p.w - 1) * T)],
  wall: (o) => [
    S.paint(target.tile(o + 2, 14, BLUE), BLUE, `pad ${o + 2}`),
    S.walk((o + 2.5) * T), S.wait(4),
    bounce((o + 7.5) * T, 9 * T - 4),
    S.walk((o + 8) * T),                                       // (off the top, if we landed on it)
  ],
  pit: (o) => [
    S.paint(target.tile(o + 5, 14, RED), RED, `runway end ${o + 5}`),
    S.paint(target.tile(o + 2, 14, RED), RED, `runway ${o + 2}`),
    S.walk((o + 0.5) * T), S.wait(2),
    S.fn(runJump((o + 8) * T, { early: 26 })),
  ],
  climb: (o) => [
    S.paint(face(o + 4, [11, 12, 13]), GREEN, `climb low ${o + 4}`),
    S.paint(face(o + 4, [8, 9, 10]), GREEN, `climb mid ${o + 4}`),
    S.paint(face(o + 4, [6, 7]), GREEN, `climb top ${o + 4}`),
    S.walk((o + 3.5) * T),
    S.jump(() => ({ right: true }), { untilCling: true }),
    S.climb(6 * T),
    S.walk((o + 8) * T),
    S.waitFor((w) => w.player.grounded, 200, { down: true }),
  ],
  ceiling: (o) => [
    S.paint(face(o + 2, [11, 12, 13]), GREEN, 'ceiling wall low'),
    S.paint(face(o + 2, [8, 9, 10]), GREEN, 'ceiling wall mid'),
    S.paint(face(o + 2, [7, 8]), GREEN, 'ceiling wall top'),
    S.walk((o + 0.5) * T),
    S.jump(() => ({ right: true }), { untilCling: true }),
    S.climb(7 * T),
    S.walk((o + 3.4) * T),
    ...[4, 7, 10].map((k) => S.paint(target.row(3, o + k - 1, o + k + 1, GREEN), GREEN, `ceiling ${o + k}`)),
    S.jump(() => ({}), { untilCling: true }),
    S.waitFor((w) => w.player.x > (o + 8) * T, 300, { right: true }),
    hangPaint(target.tile(o + 13, 3, GREEN), GREEN, 'ceiling ahead 1'),
    S.waitFor((w) => w.player.x > (o + 11.5) * T, 300, { right: true }),
    hangPaint(target.tile(o + 16, 3, GREEN), GREEN, 'ceiling ahead 2'),
    S.waitFor((w) => w.player.x > (o + 14.5) * T, 300, { right: true }),
    hangPaint(target.tile(o + 18, 3, GREEN), GREEN, 'ceiling end'),
    S.waitFor((w) => w.player.x > (o + 18.4) * T, 900, { right: true }),
    S.waitFor((w) => w.player.grounded, 200, { down: true }),
  ],
  tunnel: (o) => [
    S.fn(becomeSize('small', o + 2, 14)),
    S.walk((o + 11) * T),
    S.fn(becomeSize('big', o + 12, 14)),
  ],
  portal: (o) => [
    S.walk((o + 1.5) * T),
    // the exit first, then the entrance: so the new entrance never pairs with an old exit behind us
    S.paint(target.portalInto(o + 7, o + 13), PURPLE, `portal out ${o}`),
    S.paint(target.portal(o + 2, 14, 'top'), PURPLE, `portal in ${o + 2}`),
    S.fn(enter(o + 2)),
  ],
  monsters: (o, p, i) => [S.fn(fight(i, (o + p.w) * T))],
  end: () => [S.toFlag()],
};

// plays one chase level with the bot; returns the run result plus how far behind the Eraser was
function runChase(def, trace) {
  const w = new World(def);
  let mi = 0;
  const steps = def.parts.flatMap((p) => {
    const fn = ROUTE[p.kind];
    const w2 = p.w || { run: 7, wall: 10, pit: 18, climb: 11, ceiling: 22, tunnel: 15, portal: 15, monsters: 15, end: 8 }[p.kind];
    if (p.kind === 'monsters') { const n = p.one ? 1 : 2, ids = [...Array(n).keys()].map((k) => mi + k); mi += n; return fn(p.o, { w: w2 }, ids); }
    return fn(p.o, { w: w2 });
  });
  const r = run(w, steps, { max: 40000, trace });
  r.lead = ((w.player.x - w.chaseX()) / T).toFixed(1);
  r.secs = (w.frame / 60).toFixed(1);
  return r;
}

const R = {};
for (const def of [FIRST_CHASE, ...BOSSES]) {
  R[def.name] = runChase(def, process.env.TRACE === def.name ? (w, a, f, i) => { if (f % (+process.env.EVERY || 30) === 0) console.log(f, i, JSON.stringify(a), (w.player.x / T).toFixed(1), (w.player.y / T).toFixed(1), 'eraser', (w.chaseX() / T).toFixed(1)); } : undefined);
}
module.exports = { R, runChase };
if (require.main === module) for (const [n, r] of Object.entries(R)) console.log(r.won ? `PASS  ${n}: ${r.secs}s, cans ${r.cans}/3, Eraser ${r.lead} columns behind` : `FAIL  ${n}: ${JSON.stringify(r)}`);
