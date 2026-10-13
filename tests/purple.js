const B = require('./bot.js');
const { World, T, BLUE, RED, GREEN, YELLOW, PURPLE, NONE, S, target, run, lvl, toward, DONE } = B;
const { bounce } = require('./blue.js');
const { runJump } = require('./red.js');
const R = {};
const tr = (name) => (process.env.TRACE === name ? { trace: B.tracer(2) } : {});

// walk onto a portal (by tile column) until we get teleported somewhere else
const enter = (c) => (w, m) => {
  const p = w.player, cx = p.x + p.w / 2, cy = p.y;
  // teleported (a sudden jump in position)? then wait to land and we're done.
  // (placing the second portal while standing on the first one teleports you right away, too)
  if (m.done || (m.lastX !== undefined && (Math.abs(cx - m.lastX) > 2 * T || Math.abs(cy - m.lastY) > 2 * T))) {
    if (!m.done) { m.done = true; m.exitX = cx; m.t0 = 0; }
    if (p.grounded && (m.t0 = m.t0 + 1) > 1) return DONE;
    // steer back over the exit while falling (cancel any sideways speed we carried through)
    return { right: cx < m.exitX - 2, left: cx > m.exitX + 2, down: true };
  }
  if (m.lastX === undefined && w._tpFrame !== undefined && w._frame - w._tpFrame < 60) {
    // we already went through (placing the second portal while standing on the first does that)
    m.done = true; m.exitX = w._tpX; m.t0 = 0;
    return { down: true };
  }
  m.lastX = cx; m.lastY = cy;
  if ((m.t = (m.t || 0) + 1) > 400) return { fail: `never teleported via portal at col ${c}` };
  const x = c * T + T / 2;
  return { right: cx < x, left: cx > x, down: true };
};
// step off the portal we're standing on and back onto it
const reenter = (c, side = -1) => [S.walk((c + side) * T + T / 2), S.wait(4), S.fn(enter(c))];

// ---------- 34. Portal Hop ----------
{
  const w = new World(lvl('Portal Hop'));
  R['Portal Hop'] = run(w, [
    S.walk(5.5 * T), S.wait(8), S.jump(),                        // can (5,11)
    S.paint(target.portal(7, 15, 'top'), PURPLE, 'room 1 floor'),
    S.paint(target.portalInto(11, 19), PURPLE, 'room 2 (over the wall)'),
    S.fn(enter(7)),
    S.walk(15.5 * T), S.wait(8), S.jump(),                       // can (15,11)
    S.paint(target.portal(13, 15, 'top'), PURPLE, 'room 2 floor'),   // replaces the oldest
    S.paint(target.portalInto(21, 28), PURPLE, 'room 3'),            // replaces the next oldest
    S.fn(enter(13)),
    S.walk(23.5 * T), S.wait(8), S.jump(),                       // can (23,11)
    S.toFlag(),
  ], tr('hop'));
}

// ---------- 36. Lava Leap ----------
{
  const w = new World(lvl('Lava Leap'));
  R['Lava Leap'] = run(w, [
    S.walk(3.5 * T), S.wait(8), S.jump(),                        // can (3,8)
    S.paint(target.portal(4, 12, 'top'), PURPLE, 'start island'),
    S.paint(target.portal(13, 10, 'top'), PURPLE, 'middle island'),
    S.fn(enter(4)),
    S.walk(12.5 * T), S.wait(8), S.jump(),                       // can (13,7)? jump from the island's left part
    S.paint(target.portal(24, 8, 'top'), PURPLE, 'far island'),
    ...reenter(13, -1),
    S.walk(24.5 * T), S.wait(8), S.jump(),                       // can (24,5)
    S.toFlag(),
  ], tr('leap'));
}

// ---------- 37. Portal Climb ----------
{
  const w = new World(lvl('Portal Climb'));
  R['Portal Climb'] = run(w, [
    S.walk(5.5 * T), S.wait(8), S.jump(),                        // can (5,11)
    S.paint(target.tile(13, 12, GREEN), GREEN, 'pillar low'),
    S.paint(target.tile(13, 9, GREEN), GREEN, 'pillar mid'),
    S.paint(target.tile(13, 6, GREEN), GREEN, 'pillar high'),
    S.paint(target.tile(13, 4, GREEN), GREEN, 'pillar top'),
    S.walk(12.3 * T), S.wait(4),
    S.jump(() => ({ right: true }), { untilCling: true }),
    S.climb(3 * T),                                              // can (12,4) on the way up
    S.paint(target.portalInto(17, 28), PURPLE, 'over the wall'),
    S.paint(target.portal(14, 3, 'top'), PURPLE, 'pillar top'),
    S.fn(enter(14)),
    S.walk(20.5 * T), S.wait(8), S.jump(),                       // can (20,11)
    S.toFlag(),
  ], tr('climb'));
}

// ---------- 38. Portal Patrol ----------
{
  const w = new World(lvl('Portal Patrol'));
  R['Portal Patrol'] = run(w, [
    S.walk(3.5 * T), S.wait(8), S.jump(),                        // can (3,11)
    S.walk(12.5 * T), S.wait(8), S.jump(),                       // can (12,11)
    S.paint(target.stun(0), PURPLE, 'stun the washer'),
    S.paint(target.portal(11, 15, 'top'), PURPLE, 'left floor'),
    S.paint(target.portalInto(16, 28), PURPLE, 'right room'),
    S.fn(enter(11)),
    S.stompAll([1]),
    S.walk(22.5 * T), S.wait(8), S.jump(),                       // can (22,11)
    S.toFlag(),
  ], tr('patrol'));
}

// ---------- 39. Portal Hats ----------
{
  const w = new World(lvl('Portal Hats'));
  R['Portal Hats'] = run(w, [
    S.paint(target.tile(3, 15, BLUE), BLUE, 'pad'),
    S.walk(3.5 * T), S.wait(8), S.jump(),                        // bounce: can (3,7)
    S.walk(10.5 * T), S.wait(8), S.jump(),                       // can (10,11)
    S.paint(target.portal(12, 15, 'top'), PURPLE, 'left floor'),
    S.paint(target.portalInto(16, 28), PURPLE, 'right room'),
    S.fn(enter(12)),
    // the yellow hat may shrink us; we need to be big for can (22,11) and the step
    S.fn((w, m) => {
      const p = w.player, cx = p.x + p.w / 2, x = 22.5 * T;
      if (w.cans[2].got && p.size === 'big' && p.grounded) return DONE;
      if ((m.t = (m.t || 0) + 1) > 2000) return { fail: 'never got can (22,11) as big' };
      if (!p.grounded) return { down: p.vy > 0, jump: p.vy < 0 };
      if (Math.abs(cx - x) > 2) return { right: cx < x, left: cx > x, down: true };
      if (p.size === 'big' && !w.cans[2].got && Math.abs(p.vx) < 0.5) return { jump: true };
      return { down: true };
    }),
    S.walk(23 * T), S.wait(4),
    S.jump(toward(25 * T)),                                      // onto the step
    S.toFlag(),
  ], tr('hats'));
}

// ---------- 40. Purple Rain ----------
{
  const w = new World(lvl('Purple Rain'));
  R['Purple Rain'] = run(w, [
    S.stompAll([0]),
    S.paint(target.tile(7, 14, RED), RED, 'runway end'),
    S.paint(target.tile(4, 14, RED), RED, 'runway'),
    S.walk(1.5 * T), S.wait(2),
    S.fn(runJump(9 * T)),                                        // over the lava, can (12,10)
    S.walk(18.5 * T), S.wait(8), S.jump(),                       // can (18,10) under the washer's post
    S.walk(16.6 * T),
    S.paint(target.stun(2), RED, 'stun the washer'),
    S.paint(target.portalInto(23, 28), PURPLE, 'into the vault (away from the washer)'),
    S.paint(target.portal(17, 14, 'top'), PURPLE, 'here'),
    S.fn(enter(17)),
    S.walk(24.5 * T), S.wait(8), S.jump(),                       // can (24,11)
    S.toFlag(),
  ], tr('rain'));
}

module.exports = { R, enter };
if (require.main === module) console.log(R);
