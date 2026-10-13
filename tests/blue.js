const B = require('./bot.js');
const { World, T, BLUE, NONE, S, target, run, lvl, toward, DONE, noPaintWin } = B;
const R = {};

// shared: bounce from where you stand. While rising below `clearY`, hold the launch x;
// once your feet are above it, steer to x; land holding down (no re-bounce).
const bounce = (x, clearY, o = {}) => S.jump((w, m) => {
  const p = w.player, cx = p.x + p.w / 2;
  if (m.lx === undefined) m.lx = cx;
  const tx = typeof x === 'function' ? x(w) : x;
  const goal = p.y + p.h > clearY && p.vy < 0 ? m.lx : tx;
  return { right: cx < goal - 2, left: cx > goal + 2, down: p.vy > 0 };
}, o);

// ---------- 2. Up and Up (now with a lava floor) ----------
{
  const w = new World(lvl('Up and Up'));
  R['Up and Up'] = run(w, [
    S.paint(target.any([[4, 15], [5, 15], [6, 15]], BLUE), BLUE, 'floor pad'),
    S.paint(target.any([[8, 9], [9, 9]], BLUE), BLUE, 'platform 1'),
    S.walkToPaint(15, 4, 6, BLUE, { pick: 'left' }), S.wait(8),
    bounce(8.5 * T, 9 * T - 4),                // up onto platform 1
    S.paint(target.tile(10, 9, BLUE), BLUE, 'platform 1 far end'),
    S.paint(target.any([[13, 6], [14, 6], [15, 6], [16, 6]], BLUE), BLUE, 'platform 2'),
    S.walk(8.5 * T), S.wait(8),
    bounce(8.5 * T, 0),                        // straight up for can (8,1)
    S.walk(10.5 * T), S.wait(8),
    bounce(14.5 * T, 999),                     // onto platform 2
    S.paint(target.tile(16, 6, BLUE), BLUE, 'platform 2 far end'),
    S.walkToPaint(6, 13, 16, BLUE, { pick: 'right' }), S.wait(8),
    bounce(15.5 * T, 0),                       // up for can (15,2), back down on the pad
    S.walkToPaint(6, 13, 16, BLUE, { pick: 'right' }), S.wait(8),
    bounce(18.5 * T, 999),                     // up to the top platform, through can (18,1)
    S.walk(20.5 * T),
  ], process.env.TRACE === 'up' ? { trace: B.tracer(2) } : {});
}
// ---------- 4. Wash Day (washer) ----------
{
  const w = new World(lvl('Wash Day'));
  R['Wash Day'] = run(w, [
    S.walk(3.5 * T), S.jump(),                                         // can (3,11)
    S.paint(target.tile(5, 15, BLUE), BLUE, 'floor pad'),
    S.walk(5.5 * T), S.wait(4),
    bounce(10 * T, 10 * T - 4),                                        // up onto ledge A
    S.paint(target.tile(12, 10, BLUE), BLUE, 'A far end'),
    S.walk(12.5 * T), S.wait(4),
    bounce(12.5 * T, 0),                                               // straight up: can (12,7)
    S.paint(target.tile(12, 10, BLUE), BLUE, 'A far end again (washer)'),
    S.walk(12.5 * T), S.wait(4),
    bounce(18 * T, 999),                                               // over to ledge B
    S.paint(target.tile(20, 6, BLUE), BLUE, 'B far end'),
    S.walk(20.5 * T), S.wait(4),
    bounce(24.5 * T, 999),                                             // up to ledge C through can (22,3)
    S.toFlag(),
  ], process.env.TRACE === 'wash' ? { trace: B.tracer(2) } : {});
}

// ---------- 5. Hat Check (blue hat in a spiky corridor) ----------
{
  const w = new World(lvl('Hat Check'));
  R['Hat Check'] = run(w, [
    S.walk(8.3 * T), S.unpaint(8, 15, BLUE),
    S.jump(toward(11.6 * T)),                                          // over the first lava gap, can (10,12)
    S.walk(14.3 * T), S.unpaint(14, 15, BLUE),
    S.jump(toward(17.6 * T)),                                          // second gap, can (16,12)
    S.walk(18.6 * T), S.unpaint(18, 15, BLUE),
    S.jump(toward(20.5 * T)),                                          // land on the hat: stomp
    S.paint(target.tile(22, 15, BLUE), BLUE, 'pad'),
    S.walk(22.5 * T), S.wait(4),
    bounce(26.5 * T, 9 * T - 4),                                       // over the wall, can (22,7) on the way up
    S.toFlag(),
  ], process.env.TRACE === 'hat' ? { trace: B.tracer(2) } : {});
}

// ---------- 7. Monster Mash ----------
{
  const w = new World(lvl('Monster Mash'));
  R['Monster Mash'] = run(w, [
    S.walk(5.5 * T), S.jump(),                                         // can (5,11)
    S.paint(target.any([[7, 15], [8, 15], [9, 15]], BLUE), BLUE, 'pad 1'),
    S.walkToPaint(15, 7, 9, BLUE, { pick: 'left' }), S.wait(4),
    bounce(12.5 * T, 11 * T - 4),                                      // over wall 1
    S.stomp(2),                                                        // the Inky
    S.walk(12.5 * T), S.jump(),                                        // can (12,11)
    S.paint(target.any([[17, 15], [18, 15], [19, 15]], BLUE), BLUE, 'pad 2'),
    S.paint(target.tile(18, 15, BLUE), BLUE, 'pad 2 middle'),
    S.walk(18.5 * T), S.wait(4),
    bounce(26.5 * T, 11 * T - 4),                                      // over wall 2, can (18,7)
    S.toFlag(),
  ], process.env.TRACE === 'mash' ? { trace: B.tracer(2) } : {});
}

// ---------- 8. Ink Storm ----------
{
  const w = new World(lvl('Ink Storm'));
  R['Ink Storm'] = run(w, [
    S.paint(target.tile(5, 12, BLUE), BLUE, 'A edge'),
    S.walk(5.5 * T), S.wait(2),
    bounce(10.6 * T, 999),                                             // onto the near end of B
    S.stomp(0),                                                        // the Inky walks into a stomp
    S.walk(12 * T),
    S.paint(target.tile(13, 10, BLUE), BLUE, 'B edge'),
    S.walk(13.5 * T), S.wait(2),
    bounce(19.5 * T, 999),                                             // to C
    S.paint(target.tile(21, 8, BLUE), BLUE, 'C edge'),
    S.walk(21.5 * T), S.wait(2),
    bounce(25.6 * T, 999),                                             // to D, through can (23,1)
    S.toFlag(),
  ], process.env.TRACE === 'storm' ? { trace: B.tracer(1) } : {});
}

module.exports = { R, bounce };
if (require.main === module) console.log(R);
