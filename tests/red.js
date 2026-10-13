const B = require('./bot.js');
const { World, T, BLUE, RED, NONE, S, target, run, lvl, toward, DONE } = B;
const { bounce } = require('./blue.js');
const R = {};
const tr = (name) => (process.env.TRACE === name ? { trace: B.tracer(2) } : {});

// run right (from where you are) and jump when your right edge reaches edgeX; keep holding right in the air.
// o.rebounce: don't hold down on landing (so blue paint bounces you)
const runJump = (edgeX, o = {}) => (w, m) => {
  const p = w.player;
  if (!m.jumped) {
    if (p.x + p.w >= edgeX - (o.early || 2) && p.grounded) { m.jumped = true; m.t = 0; return { right: true, jump: true }; }
    return { right: true };
  }
  m.t++;
  if (m.t > 3 && p.grounded) return DONE;
  if (m.t > 300) return { fail: 'run-jump never landed' };
  const s = o.steer ? o.steer(w) : { right: true };
  return { jump: p.vy < 0, down: !o.rebounce && p.vy > 0, ...s };
};

// ---------- 10. Lava Run ----------
{
  const w = new World(lvl('Lava Run'));
  R['Lava Run'] = run(w, [
    S.paint(target.tile(6, 14, RED), RED, 'runway end'),
    S.paint(target.tile(3, 14, RED), RED, 'runway start'),
    S.paint(target.tile(17, 14, RED), RED, 'island B'),
    S.paint(target.tile(19, 14, RED), RED, 'island B edge'),
    S.walk(1.5 * T), S.wait(4),
    S.fn(runJump(8 * T)),                         // over the first lava, cans (11,10) and (15,12)
    S.fn(runJump(20 * T)),                        // second lava, can (22,10)
    S.toFlag(),
  ], tr('lavarun'));
}

// ---------- 12. Hot Bounce ----------
{
  const w = new World(lvl('Hot Bounce'));
  R['Hot Bounce'] = run(w, [
    S.paint(target.tile(5, 14, RED), RED, 'runway end'),
    S.paint(target.tile(2, 14, RED), RED, 'runway start'),
    S.paint(target.tile(15, 14, BLUE), BLUE, 'bounce island left'),
    S.paint(target.tile(16, 14, BLUE), BLUE, 'bounce island right'),
    S.walk(1.5 * T), S.wait(4),
    S.fn(runJump(7 * T, { rebounce: true,         // red leap onto blue: bounce up onto the ledge, cans (10,10) (19,7)
      steer: (w) => { const p = w.player; return p.y + p.h < 9 * T && p.vy > 0 ? toward(22.5 * T)(w) : { right: true }; } })),
    S.walk(24.5 * T), S.jump(),                   // can (24,5)
    S.toFlag(),
  ], tr('hot'));
}

// ---------- 13. Red Alert ----------
{
  const w = new World(lvl('Red Alert'));
  R['Red Alert'] = run(w, [
    S.stompAll([0, 1]),                           // deal with both Inkies first
    S.walk(6.5 * T), S.jump(),                    // can (6,10)
    S.paint(target.tile(11, 14, RED), RED, 'runway end'),
    S.paint(target.tile(8, 14, RED), RED, 'runway'),
    S.walk(4.5 * T), S.wait(4),
    S.fn(runJump(13 * T)),                        // over the lava, can (16,10)
    S.paint(target.tile(22, 14, BLUE), BLUE, 'pad'),
    S.walk(22.5 * T), S.wait(4),
    bounce(26.5 * T, 9 * T - 4),                  // over the wall, can (24,7)
    S.toFlag(),
  ], tr('alert'));
}

// ---------- 15. Speed Wash ----------
{
  const w = new World(lvl('Speed Wash'));
  R['Speed Wash'] = run(w, [
    S.walk(3.5 * T), S.jump(),                    // can (3,10)
    S.paint(target.tile(9, 14, RED), RED, 'runway end'),
    S.paint(target.tile(6, 14, RED), RED, 'runway'),
    S.paint(target.stun(0), RED, 'stun the washer'),
    S.walk(2.5 * T), S.wait(2),
    S.fn(runJump(11 * T)),                        // over the lava, can (14,10)
    S.paint(target.tile(21, 14, BLUE), BLUE, 'pad'),
    S.walk(21.5 * T), S.wait(4),
    bounce(26.5 * T, 10 * T - 4),                 // over the wall, can (21,7)
    S.toFlag(),
  ], tr('wash'));
}

// ---------- 16. Red Hat Riot ----------
{
  const w = new World(lvl('Red Hat Riot'));
  R['Red Hat Riot'] = run(w, [
    S.paint(target.tile(5, 14, BLUE), BLUE, 'pad A'),
    S.walk(5.5 * T), S.wait(4),
    bounce(12 * T, 999),                          // onto B, can (9,10)
    S.stomp(2),
    S.paint(target.tile(16, 12, BLUE), BLUE, 'pad B'),
    S.walk(16.5 * T), S.wait(2),
    bounce(22.5 * T, 999),                        // onto C, can (19,8)
    S.walk(24.5 * T), S.jump(),                   // can (24,7)
    S.toFlag(),
  ], process.env.ARC === 'riot' ? { trace: (w, a, f, i) => { if (!w.player.grounded) console.log('ARC', i, Math.floor((w.player.x + 11) / 32), Math.floor(w.player.y / 32), Math.floor((w.player.y + 39) / 32)); } } : tr('riot'));
}

module.exports = { R, runJump };
if (require.main === module) console.log(R);
