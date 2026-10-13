const B = require('./bot.js');
const { World, T, BLUE, RED, GREEN, NONE, S, target, run, lvl, toward, DONE } = B;
const { bounce } = require('./blue.js');
const { runJump } = require('./red.js');
const R = {};
const tr = (name) => (process.env.TRACE === name ? { trace: B.tracer(2) } : {});

// ---------- 20. Green Bounce ----------
{
  const w = new World(lvl('Green Bounce'));
  R['Green Bounce'] = run(w, [
    S.paint(target.tile(11, 7, GREEN), GREEN, 'pillar face top'),
    S.paint(target.tile(11, 10, GREEN), GREEN, 'pillar face middle'),
    S.paint(target.tile(5, 14, BLUE), BLUE, 'pad'),
    S.walk(5.5 * T), S.wait(4),
    S.jump((w) => ({ right: true }), { untilCling: true }),           // bounce over the lava onto the green face, can (8,8)?
    S.climb(6 * T),
    S.paint(target.tile(12, 6, BLUE), BLUE, 'pillar top'),
    S.paint(target.row(0, 13, 15, GREEN), GREEN, 'ceiling 1'),
    S.paint(target.row(0, 16, 18, GREEN), GREEN, 'ceiling 2'),
    S.paint(target.row(0, 19, 21, GREEN), GREEN, 'ceiling 3'),
    S.paint(target.row(0, 22, 24, GREEN), GREEN, 'ceiling 4'),
    S.walk(13.5 * T), S.wait(4),
    S.jump(() => ({}), { untilCling: true, rebounce: true }),       // bounce straight up into the green ceiling, can (13,4)
    S.waitFor((w) => w.player.x > 23.6 * T, 600, { right: true }),   // hand over hand, can (18,2)
    S.waitFor((w) => w.player.grounded, 120, { down: true }),         // let go above the ledge
    S.toFlag(),
  ], process.env.ARC === 'gb' ? { trace: B.arcTracer([5]) } : tr('gb'));
}

// ---------- 24. Green Hat ----------
{
  const w = new World(lvl('Green Hat'));
  R['Green Hat'] = run(w, [
    S.paint(target.stun(0), RED, 'stun the hat'),
    S.paint(target.tile(7, 14, RED), RED, 'runway end'),
    S.paint(target.tile(4, 14, RED), RED, 'runway'),
    S.walk(2.5 * T), S.wait(2),
    S.fn(runJump(9 * T)),                                           // over the lava, can (12,10)
    S.walk(19.5 * T), S.wait(12), S.jump(),                         // can (19,10)
    S.walk(22.3 * T),
    // keep jumping at the wall; the hat's shots at us paint it green; climb as far as the green goes
    S.fn((w, m) => {
      const p = w.player;
      if (p.grounded && p.y + p.h <= 4 * T + 1) return DONE;
      if ((m.t = (m.t || 0) + 1) > 4000) return { fail: 'never got up the wall' };
      if (p.cling === 1) return { up: true, right: true };
      if (p.grounded) return { jump: (m.t % 20) < 10, right: true };
      return { right: true, jump: p.vy < 0 };
    }),
    S.walk(24.5 * T), S.jump(),                                     // can (24,1)
    S.toFlag(),
  ], tr('gh'));
}

module.exports = { R };
if (require.main === module) console.log(R);
