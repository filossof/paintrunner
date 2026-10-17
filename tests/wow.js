// The WOW test level (Eraser Chase): can it be beaten, with the Eraser chasing, using real throws only?
// Run: node tests/wow.js
const B = require('./bot.js');
const { World, T, BLUE, RED, GREEN, S, target, run, DONE } = B;
const { bounce } = require('./blue.js');
const { runJump } = require('./red.js');
const { WOW_LEVEL } = require('../levels.js');

// paint while hanging from the ceiling (no "down": that would let go)
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

const w = new World(WOW_LEVEL);
const r = run(w, [
  S.paint(target.tile(12, 14, BLUE), BLUE, 'launch pad'),
  S.walk(12.3 * T), S.wait(4),
  bounce(14.5 * T, 8 * T - 4),                                  // up onto the plateau
  S.paint(target.tile(23, 8, RED), RED, 'runway end'),
  S.paint(target.tile(20, 8, RED), RED, 'runway'),
  S.paint(target.tile(17, 8, RED), RED, 'runway start'),
  S.walk(14.5 * T), S.wait(2),
  S.fn(runJump(25 * T)),                                        // over the spike pit
  S.paint(target.tile(47, 12, GREEN), GREEN, 'wall low'),
  S.paint(target.tile(47, 9, GREEN), GREEN, 'wall mid'),
  S.paint(target.tile(47, 7, GREEN), GREEN, 'wall top'),
  S.walk(45.5 * T),
  S.jump(() => ({ right: true }), { untilCling: true }),
  S.climb(7 * T),
  S.walk(48.4 * T),
  ...[49, 52, 55].map((c) => S.paint(target.row(3, c - 1, c + 1, GREEN), GREEN, `ceiling ${c}`)),
  S.jump(() => ({}), { untilCling: true }),                     // up onto the green ceiling
  S.waitFor((w) => w.player.x > 53 * T, 300, { right: true }),   // hand over hand...
  hangPaint(target.tile(58, 3, GREEN), GREEN, 'ceiling 58'),  // ...painting the way ahead
  S.waitFor((w) => w.player.x > 56.5 * T, 300, { right: true }),
  hangPaint(target.tile(61, 3, GREEN), GREEN, 'ceiling 61'),
  S.waitFor((w) => w.player.x > 59.5 * T, 300, { right: true }),
  hangPaint(target.tile(63, 3, GREEN), GREEN, 'ceiling 63'),
  S.waitFor((w) => w.player.x > 63.4 * T, 900, { right: true }), // above the lava
  S.waitFor((w) => w.player.grounded, 200, { down: true }),       // let go
  S.stompAll([0, 1]),
  S.paint(target.tile(79, 14, BLUE), BLUE, 'last pad'),
  S.walk(79.5 * T), S.wait(4),
  bounce(86 * T, 9 * T - 4),                                    // over the last wall
  S.toFlag(),
], { max: 12000, trace: process.env.TRACE ? (w, a, f, i) => { if (f > 560 && f % 4 === 0) console.log(f, i, JSON.stringify(a), (w.player.x / T).toFixed(2), (w.player.y / T).toFixed(2), "cling", w.player.cling, w.level.paint[3].slice(46, 64).join("")); } : undefined });
const eraserAt = (w.chaseX() / T).toFixed(1), heroAt = (w.player.x / T).toFixed(1);
console.log(r.won ? `PASS  Eraser Chase won in ${(w.frame / 60).toFixed(1)}s, cans ${r.cans}/3 (the Eraser was at column ${eraserAt}, you at ${heroAt})`
  : `FAIL  Eraser Chase: ${JSON.stringify(r)} (eraser at column ${eraserAt})`);
module.exports = { R: { 'Eraser Chase': r } };
