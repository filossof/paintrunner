const B = require('./bot.js');
const { World, T, BLUE, RED, GREEN, YELLOW, PURPLE, NONE, S, target, run, lvl, toward, DONE } = B;
const { bounce } = require('./blue.js');
const { runJump } = require('./red.js');
const { becomeSize } = require('./yellow.js');
const { enter } = require('./purple.js');
const R = {};
const tr = (name) => (process.env.TRACE === name ? { trace: B.tracer(2) } : {});

// stand on platform i (centered) until pred(w) is true
const ride = (i, pred, timeout = 900) => (w, m) => {
  const p = w.player, pl = w.platforms[i], cx = p.x + p.w / 2, mid = pl.x + pl.w / 2;
  if (p.ride === pl && pred(w, pl)) return DONE;
  if ((m.t = (m.t || 0) + 1) > timeout) return { fail: `ride ${i} timeout` };
  return { right: cx < mid - 3, left: cx > mid + 3, down: true };
};
// wait at the edge (x) until the platform is at a spot, then step on
const board = (i, edgeX, pred) => (w, m) => {
  const p = w.player, pl = w.platforms[i], cx = p.x + p.w / 2;
  if (p.ride === pl) return DONE;
  if ((m.t = (m.t || 0) + 1) > 900) return { fail: `never boarded ${i}` };
  if (pred(pl)) return { right: true, down: true };
  return { right: cx < edgeX - 2, left: cx > edgeX + 2, down: true };
};

// steer in the air to come down on platform i (aims a little ahead of it)
const onto = (i) => (w) => { const q = w.platforms[i]; return { ...toward(q.x + q.w / 2 + q.dx * 6)(w), down: true }; };

// ---------- 41. Lava Lake ----------
{
  const w = new World(lvl('Lava Lake'));
  R['Lava Lake'] = run(w, [
    S.paint(target.tile(6, 12, BLUE), BLUE, 'start pad'),
    S.walk(6.5 * T), S.wait(4),
    bounce(10.8 * T, 999),                                    // up onto the tall island, can (9,6)
    S.walk(11.5 * T), S.wait(8), S.jump(),                    // can (11,2)
    S.paint(target.tile(16, 4, GREEN), GREEN, 'pillar face top'),
    S.paint(target.tile(16, 7, GREEN), GREEN, 'pillar face'),
    S.walk(12.5 * T), S.wait(4),
    S.jump(() => ({ right: true }), { untilCling: true }),
    S.climb(3 * T),
    S.walk(17 * T), S.wait(4),
    S.jump(toward(20.8 * T)),                                 // onto the last ledge
    S.walk(21.5 * T), S.wait(8), S.jump(),                    // can (21,1)
    S.fn(becomeSize('small', 22, 5)),
    S.toFlag(),                                               // through the gap
  ], process.env.ARC === 'lake' ? { trace: B.arcTracer([3]) } : tr('lake'));
}

// ---------- 42. Lava Ferry ----------
{
  const w = new World(lvl('Lava Ferry'));
  R['Lava Ferry'] = run(w, [
    S.fn(board(0, 3.5 * T, (pl) => pl.x < 5 * T + 4)),       // step on the first ferry at the dock
    S.fn(ride(0, (w, pl) => pl.x > 7.5 * T && pl.dx > 0)),
    S.jump(onto(0)),                                          // hop on the ferry: can (8,9)
    S.fn(ride(0, (w, pl) => pl.x > 10 * T && w.platforms[1].x < 13.6 * T && w.platforms[1].dx <= 0.3)),
    S.jump((w) => { const q = w.platforms[1]; return toward(q.x + q.w / 2 + q.dx * 10)(w); }),   // up onto ferry 2
    S.paint(target.stun(0), BLUE, 'stun the washer'),
    S.paint(target.platform(1, BLUE), BLUE, 'paint ferry 2'),
    S.fn(ride(1, (w, pl) => pl.x > 16.5 * T && pl.x < 17.5 * T && pl.dx > 0)),
    S.jump(onto(1)),                                          // bounce on ferry 2: can (17,7)
    S.fn(ride(1, (w, pl) => pl.x > 20.6 * T)),
    S.jump(toward(25.4 * T)),                                 // bounce over to the island
    S.walk(25.5 * T), S.wait(8), S.jump(),                    // can (25,4)
    S.toFlag(),
  ], tr('ferry'));
}

// ---------- 43. Gauntlet ----------
{
  const w = new World(lvl('Gauntlet'));
  R['Gauntlet'] = run(w, [
    S.stompAll([0, 3]),
    S.paint(target.tile(8, 14, RED), RED, 'runway end'),
    S.paint(target.tile(5, 14, RED), RED, 'runway'),
    S.walk(2.5 * T), S.wait(2),
    S.fn(runJump(10 * T)),                                    // over the lava, can (12,10)
    S.paint(target.stun(2), BLUE, 'stun the washer'),
    S.paint(target.tile(20, 14, BLUE), BLUE, 'pad'),
    S.walk(20.5 * T), S.wait(4),
    bounce(25 * T, 9 * T - 4),                                // over the wall, can (23,6)
    S.paint(target.tile(27, 12, GREEN), GREEN, 'pillar low'),
    S.paint(target.tile(27, 9, GREEN), GREEN, 'pillar mid'),
    S.paint(target.tile(27, 6, GREEN), GREEN, 'pillar high'),
    S.paint(target.tile(27, 4, GREEN), GREEN, 'pillar top'),
    S.walk(26.3 * T), S.wait(4),
    S.jump(() => ({ right: true }), { untilCling: true }),
    S.climb(4 * T),                                           // can (26,5)
    S.toFlag(),
  ], tr('gaunt'));
}

// ---------- 45. Masterpiece ----------
{
  const w = new World(lvl('Masterpiece'));
  R['Masterpiece'] = run(w, [
    S.stompAll([0]),
    S.paint(target.tile(7, 14, RED), RED, 'runway end'),
    S.paint(target.tile(4, 14, RED), RED, 'runway'),
    S.walk(1.5 * T), S.wait(2),
    S.fn(runJump(9 * T)),                                     // over the lava, can (11,10)
    S.fn(becomeSize('small', 17, 14)),                        // shrink for the tunnel
    S.walk(21.5 * T),                                         // through it
    S.fn(becomeSize('big', 22, 14)),
    S.paint(target.stun(1), GREEN, 'stun the washer'),
    S.paint(target.tile(20, 11, GREEN), GREEN, 'wall low'),
    S.paint(target.tile(20, 8, GREEN), GREEN, 'wall mid'),
    S.paint(target.tile(20, 5, GREEN), GREEN, 'wall high'),
    S.walk(21.4 * T), S.wait(4),
    S.jump(() => ({ left: true }), { untilCling: true }),
    S.climb(4 * T, { dir: -1 }),                              // can (21,6)
    S.paint(target.portalInto(24, 28), PURPLE, 'into the gallery'),
    S.paint(target.portal(20, 4, 'top'), PURPLE, 'under our feet'),
    S.fn(enter(20)),
    S.walk(25.5 * T), S.wait(8), S.jump(),                    // can (25,10)
    S.toFlag(),
  ], tr('master'));
}

module.exports = { R };
if (require.main === module) console.log(R);
